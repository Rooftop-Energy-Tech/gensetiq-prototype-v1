import {gensetDetail, sfcLitresPerKwh} from '@/modules/genset/data/detail';
import {gensetRuns, lossLitresIn} from '@/modules/genset/data/history';
import {flowMeterSilent, instrumentsOf} from '@/modules/genset/data/fuelInstruments';
import {engineHoursOf, scheduleOf} from '@/modules/genset/data/services';
import {canReconcile} from '@/modules/genset/types/fuelIntegrity.type';
import {serviceStatus} from '@/modules/genset/types/service.type';
import type {ServiceRecord, ServiceStatus} from '@/modules/genset/types/service.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import type {GensetRun} from '@/modules/genset/types/run.type';
import type {SiteSummary} from '@/modules/site/data/sites';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * The Genset report's arithmetic, one row per machine over one window.
 *
 * ## Why it reads the run log and nothing else
 *
 * `hybrid.ts` also holds a genset-hours figure, and it is a *different* number
 * derived a different way: it models what an engine at a site of that
 * configuration must have run to cover the load the arrays did not. This module
 * reads the seeded run log, which is what the machine's own pages draw. The two
 * do not reconcile — `hybrid.ts` says so at length — and the rule the data layer
 * has always followed is that they never appear on one screen. The Overall tab
 * is the modelled one; this one is the logged one, and no figure here is derived
 * from both.
 *
 * ## Everything is clipped to the window, not attributed to it
 *
 * A run that started before the window opened is counted for the part that falls
 * inside it, at the load it held throughout. Counting a run to whichever end of it
 * lands in the period would put a fourteen-hour shift into a day it mostly did not
 * happen in, and the tables this feeds are read across sets whose runs start at
 * different times of day.
 *
 * ## Pure, and given its clock
 *
 * No hooks and no `Date.now()`: the page takes one clock reading and every row in
 * one render is measured against it. A table where each row asked the browser for
 * the time separately can put a set's service counter on the far side of a minute
 * boundary from its neighbour's.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type GensetReportRow = {
  genset: Genset;
  /** The site it stands at, or `undefined` in the depot. */
  site: SiteSummary | undefined;
  /** Its duty, which is the site's. `undefined` in the depot — see `fleetSummary`. */
  role: SitePowerRole | undefined;
  ratedKw: number;
  /** Hours the engine was turning inside the window. */
  runHours: number;
  /** Starts inside the window. A run that began before it does not count again. */
  starts: number;
  energyKwh: number;
  /** What the flow meter passed — the burn, with no loss term. */
  litres: number;
  /**
   * The gap between the two instruments, **as litres a day**, signed.
   *
   * **Positive is diesel gone missing; negative is a tank that gained.** Both
   * happen — a level probe drifting high and a delivery nobody wrote down look
   * identical from here — and the sign is kept rather than taken because they are
   * different findings and only one of them is theft.
   *
   * Zero on a healthy set and zero on one that cannot be reconciled at all; those
   * two are told apart by `reconcilable`, not by the figure.
   *
   * ## Why a rate, when every other figure on this row is a window total
   *
   * Because a rate is what the instruments establish and a total is not. The
   * detector reconciles a **24-hour** window (`FUEL_INTEGRITY.windowHours`) and
   * reports the discrepancy it finds in it; carrying that across thirty days
   * produces a number the rest of the app contradicts. A 20 kVA set losing six
   * litres an hour comes to over four thousand litres a month — more than its
   * tank holds many times over, against a refuel log that records no such
   * deliveries. Two screens disagreeing about the same diesel is the one failure
   * this data layer is built to prevent, so the report quotes the rate and lets
   * the reader multiply it by however long they think it has been standing.
   */
  lossLitresPerDay: number;
  /**
   * Whether a loss figure means anything on this row.
   *
   * Both instruments **fitted and reporting** — not merely fitted. A set whose
   * flow meter has gone silent has half a reconciliation and no verdict, and
   * `canReconcile` alone would have printed "0 L · Reconciled" against it, which
   * is a clean bill of health nobody issued.
   */
  reconcilable: boolean;
  /** Average load while turning, as a fraction of nameplate. `0` if it never ran. */
  loadFraction: number;
  /** Litres per kWh actually achieved. `0` if it never ran. */
  litresPerKwh: number;
  service: ServiceStatus;
};

export type GensetReportTotals = {
  /** Sets in the report, including the ones that never turned. */
  sets: number;
  /** Sets that turned at all inside the window. */
  ran: number;
  runHours: number;
  energyKwh: number;
  litres: number;
  /**
   * Diesel going missing, in litres a day, across every set losing it.
   *
   * **Losses only.** Summing the signed per-row figure would let one tank that
   * gained cancel another that was drained, and the arithmetic would quietly
   * report a fleet as tighter than any set on it. The gains are not discarded —
   * they are `gainLitresPerDay` — because a probe reading high is a fault of its
   * own, and netting it away is how it would never be looked at.
   */
  lossLitresPerDay: number;
  /** Diesel appearing: a probe drifting high, or an unrecorded delivery. */
  gainLitresPerDay: number;
  /** Sets carrying an unaccounted loss, out of `reconcilable`. */
  losing: number;
  /** Sets whose tanks gained. Reported beside the losses, never against them. */
  gaining: number;
  reconcilable: number;
  /** Fleet litres over fleet kWh — not the mean of the per-set rates. */
  litresPerKwh: number;
  /** Fleet kWh over what the running sets could have made — the fleet's loading. */
  loadFraction: number;
  overdue: number;
  dueSoon: number;
  /**
   * What the fleet would have burned at the same output on properly loaded
   * engines — the counterfactual the "fuel rate" tile is read against.
   *
   * At 80% of nameplate, which is where these sets are specified to sit and where
   * `sfcLitresPerKwh` is within a few percent of its floor. Not 100%: an engine
   * held at nameplate has no headroom for the step load a tower's rectifiers
   * present, so it is a number nobody would design to and a saving nobody could
   * bank.
   */
  litresAtRatedLoad: number;
};

/** Where the loading counterfactual is struck. See `litresAtRatedLoad`. */
export const REFERENCE_LOAD_FRACTION = 0.8;

/**
 * A run's contribution to a window — hours, energy and litres, prorated.
 *
 * Prorated rather than integrated because a run in this log holds one load
 * throughout, so the two agree exactly and this one does not walk a
 * fifteen-minute grid across sixty days for every machine on the estate.
 *
 * `undefined` where the run and the window do not actually overlap, which
 * `runsInWindow`'s half-open comparison can still let through at the edges.
 */
const clip = (
  run: GensetRun,
  from: number,
  to: number,
  now: number,
): {hours: number; kwh: number; litres: number} | undefined => {
  const started = new Date(run.startedAt).getTime();
  // An open run has not ended; it has reached the clock. Reading `endedAt` as
  // `Infinity` here would be right for "does it overlap" and wrong for "how long
  // is it", and this function is asked the second question.
  const ended = run.endedAt === null ? now : new Date(run.endedAt).getTime();

  const span = ended - started;
  const overlap = Math.min(ended, to) - Math.max(started, from);
  if (span <= 0 || overlap <= 0) return undefined;

  const fraction = overlap / span;
  return {
    hours: overlap / HOUR,
    kwh: run.energyProducedKwh * fraction,
    litres: run.fuelConsumedLitres * fraction,
  };
};

export const gensetReportRow = (
  genset: Genset,
  {
    sites,
    roles,
    services,
    from,
    to,
    now,
  }: {
    sites: Record<string, SiteSummary>;
    roles: Record<string, SitePowerRole>;
    services: Array<ServiceRecord>;
    from: number;
    to: number;
    now: number;
  },
): GensetReportRow => {
  const detail = gensetDetail(genset.id);
  const ratedKw = detail?.ratedKw ?? 0;

  let runHours = 0;
  let energyKwh = 0;
  let litres = 0;
  let starts = 0;

  for (const run of gensetRuns(genset.id)) {
    const startedAt = new Date(run.startedAt).getTime();
    if (startedAt >= from && startedAt < to) starts += 1;

    const part = clip(run, from, to, now);
    if (part === undefined) continue;
    runHours += part.hours;
    energyKwh += part.kwh;
    litres += part.litres;
  }

  const loadFraction =
    runHours > 0 && ratedKw > 0 ? Math.min(1, energyKwh / (runHours * ratedKw)) : 0;

  const history = services.filter((record) => record.gensetId === genset.id);

  return {
    genset,
    site: genset.siteId === null ? undefined : sites[genset.siteId],
    role: genset.siteId === null ? undefined : roles[genset.siteId],
    ratedKw,
    runHours,
    starts,
    energyKwh,
    litres,
    lossLitresPerDay: lossLitresIn(genset.id, from, to) / ((to - from) / DAY),
    // A panel that is not reporting at all takes both feeds down with it, which
    // is why the run state is part of the test and not just the instruments.
    reconcilable:
      canReconcile(instrumentsOf(genset.id)) &&
      !flowMeterSilent(genset.id) &&
      genset.runState !== 'OFFLINE',
    loadFraction,
    litresPerKwh: energyKwh > 0 ? litres / energyKwh : 0,
    service: serviceStatus(history[0], scheduleOf(genset.id), engineHoursOf(genset.id), now),
  };
};

/**
 * The fleet's figures, summed off the rows the table is drawing.
 *
 * Summed rather than derived independently, the rule the rest of this app's
 * summaries follow: a tile cannot claim a total the list below it does not
 * contain. That is also why every rate here is a **ratio of totals** rather than
 * a mean of the rows' own rates — a set that ran for forty minutes would
 * otherwise weigh as much in the fleet's fuel rate as one that ran all month.
 */
export const gensetReportTotals = (rows: Array<GensetReportRow>): GensetReportTotals => {
  const totals = rows.reduce(
    (sum, row) => ({
      ran: sum.ran + (row.runHours > 0 ? 1 : 0),
      runHours: sum.runHours + row.runHours,
      energyKwh: sum.energyKwh + row.energyKwh,
      litres: sum.litres + row.litres,
      // Only the sets that can actually be reconciled contribute. A loss the
      // instruments cannot see is a fact about the model, not a finding, and a
      // fleet figure that included it would not be checkable against anything.
      lossLitresPerDay:
        sum.lossLitresPerDay + (row.reconcilable ? Math.max(0, row.lossLitresPerDay) : 0),
      gainLitresPerDay:
        sum.gainLitresPerDay + (row.reconcilable ? Math.max(0, -row.lossLitresPerDay) : 0),
      losing: sum.losing + (row.reconcilable && row.lossLitresPerDay > 0 ? 1 : 0),
      gaining: sum.gaining + (row.reconcilable && row.lossLitresPerDay < 0 ? 1 : 0),
      reconcilable: sum.reconcilable + (row.reconcilable ? 1 : 0),
      // Nameplate-hours, not nameplate: a set that ran twice as long has twice
      // the say in what the fleet's loading was.
      capacityKwh: sum.capacityKwh + row.runHours * row.ratedKw,
      overdue:
        sum.overdue + (row.service.kind === 'tracked' && row.service.severity === 'OVERDUE' ? 1 : 0),
      dueSoon:
        sum.dueSoon +
        (row.service.kind === 'tracked' && row.service.severity === 'DUE_SOON' ? 1 : 0),
    }),
    {
      ran: 0,
      runHours: 0,
      energyKwh: 0,
      litres: 0,
      lossLitresPerDay: 0,
      gainLitresPerDay: 0,
      losing: 0,
      gaining: 0,
      reconcilable: 0,
      capacityKwh: 0,
      overdue: 0,
      dueSoon: 0,
    },
  );

  return {
    sets: rows.length,
    ran: totals.ran,
    runHours: totals.runHours,
    energyKwh: totals.energyKwh,
    litres: totals.litres,
    lossLitresPerDay: totals.lossLitresPerDay,
    gainLitresPerDay: totals.gainLitresPerDay,
    losing: totals.losing,
    gaining: totals.gaining,
    reconcilable: totals.reconcilable,
    litresPerKwh: totals.energyKwh > 0 ? totals.litres / totals.energyKwh : 0,
    loadFraction: totals.capacityKwh > 0 ? totals.energyKwh / totals.capacityKwh : 0,
    overdue: totals.overdue,
    dueSoon: totals.dueSoon,
    litresAtRatedLoad: totals.energyKwh * sfcLitresPerKwh(REFERENCE_LOAD_FRACTION),
  };
};
