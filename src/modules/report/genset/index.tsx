import {Link} from '@tanstack/react-router';
import {SearchIcon, SearchXIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import type {ReactNode} from 'react';

import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';

import {cn} from '@/lib/utils';
import {useFleet} from '@/modules/genset/data/deployment';
import {useServiceRecords} from '@/modules/genset/data/services';
import {SERVICE_SEVERITY_META} from '@/modules/genset/components/service/serviceMeta';
import {ReportColumnHead, ReportTile} from '@/modules/report/components/ReportTile';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {SITE_POWER_ROLE_LABEL} from '@/modules/site/types/site.type';
import {
  REFERENCE_LOAD_FRACTION,
  gensetReportRow,
  gensetReportTotals,
} from './data/gensetReport';
import type {GensetReportRow} from './data/gensetReport';

/**
 * `/report/genset` — the engines, over thirty days.
 *
 * ## The tab this section was missing
 *
 * The estate reported on its plant twice and its engines nowhere. `Overall`
 * counts diesel as a *saving* — litres a battery and an array took off a
 * generator — and `Solar` holds the arrays to the design they were bought on.
 * Between them the gensets appeared only as a litre column inside somebody else's
 * argument, and everything a fleet is actually read *down* was legible one
 * machine at a time: how long each set turned, what it cost per kilowatt-hour at
 * the loading it held, whether its tank gave up diesel that never reached the
 * engine, and what is falling due.
 *
 * ## It reads the run log, and only the run log
 *
 * `hybrid.ts` also holds a genset-hours figure. It is a different number arrived
 * at a different way — modelled from the load an array did not cover — and the
 * data layer's standing rule is that the two never appear on one screen. The
 * consolidation does not weaken that: a tab strip is a set of screens, not one
 * screen in three bands, and no figure here is derived from both. See
 * `gensetReport.ts`, which is where the arithmetic lives and where the split is
 * argued.
 *
 * ## Why loading is the figure the page is built around
 *
 * Because it is the one an operator can act on and the one nobody sees. A set's
 * fuel rate is not a property of the machine; it is a property of how hard it is
 * being worked, and `sfcLitresPerKwh` is steep in exactly the region this estate
 * lives in — a 20 kVA set carrying a 4 kW tower pays close to double per
 * kilowatt-hour what the same engine pays properly loaded. That is invisible on a
 * litre total, which is why the fuel-rate tile is quoted against what the same
 * output would have cost at {@link REFERENCE_LOAD_FRACTION} of nameplate.
 *
 * ## Nothing here grows with the estate
 *
 * The same construction the other two tabs are built on. Five tiles, always; one
 * table, searched and scrolled. This demo has a dozen sets and the carrier has
 * thousands, and the page has to draw the same at either end.
 */

/** Thirty days, matching the window the other two tabs report over. */
const WINDOW_DAYS = 30;

const COLUMNS: Array<{label: string; width: string; note?: ReactNode}> = [
  {label: 'Genset', width: '17%'},
  {label: 'Site', width: '15%'},
  {
    label: 'Duty',
    width: '12%',
    note: "The site's configuration, which is what decides how much this engine turns. A set at a diesel-prime site never stops; one behind an array and a bank runs to cover the shortfall, and one at a grid-backed site runs only when the mains fail or somebody exercises it.",
  },
  {
    label: 'Run hours',
    width: '11%',
    note: 'Hours the engine was turning inside the window, from the run log. A run that began before the window opened is counted only for the part inside it.',
  },
  {
    label: 'Diesel',
    width: '12%',
    note: 'What the flow meter passed through the engine, costed on the same fuel curve the run log and the tank chart use. The energy raised for it is underneath.',
  },
  {
    label: 'Fuel rate',
    width: '12%',
    note: 'Litres per kilowatt-hour actually achieved, and the average loading that earned it. A lightly loaded engine pays far more per kilowatt-hour than the same engine worked properly — near double at a tenth of nameplate — which is most of what a battery beside it fixes.',
  },
  {
    label: 'Unaccounted',
    width: '10%',
    note: 'Diesel the tank is giving up that the flow meter never sees, as a daily rate — the reconciliation works a day at a time, so a window total would claim more than the tank holds. It needs a level sensor and a flow meter both reporting; a set without them reads “—” rather than zero, because those are different answers.',
  },
  {
    label: 'Service',
    width: '11%',
    note: 'The worse of the two counters — run hours since the last service, and time since it — against this set’s own intervals.',
  },
];

const litres = (value: number): string => `${Math.round(value).toLocaleString('en-MY')} L`;

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const hours = (value: number): string => `${Math.round(value).toLocaleString('en-MY')} h`;

const kwh = (value: number): string => {
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString('en-MY')} MWh`;
  return `${Math.round(value).toLocaleString('en-MY')} kWh`;
};

/**
 * The service column, in one cell.
 *
 * It reuses `SERVICE_SEVERITY_META` rather than colouring by hand, which is the
 * point of that table existing: red means "deal with this" everywhere in the app,
 * and a set three months late should read the same here as it does on its own
 * service tab.
 */
const ServiceCell = ({row}: {row: GensetReportRow}) => {
  if (row.service.kind === 'never-serviced') {
    return (
      <>
        <span className="block truncate text-secondary">No record</span>
        <span className="block truncate text-xs text-tertiary">
          {row.service.schedule.intervalHours} h interval
        </span>
      </>
    );
  }

  const meta = SERVICE_SEVERITY_META[row.service.severity];
  const counter = row.service.binding === 'hours' ? row.service.hours : row.service.calendar;

  return (
    <>
      <span className={cn('block truncate', meta.textClassName)}>{meta.label}</span>
      <span className="block truncate text-xs text-tertiary tabular-nums">
        {/* The binding counter, not both. Which one put the set into this state is
            the useful second line; printing the other beside it is a number that
            did not decide anything. */}
        {Math.round(counter.elapsed).toLocaleString('en-MY')} of {counter.interval}{' '}
        {row.service.binding === 'hours' ? 'h' : 'months'}
      </span>
    </>
  );
};

export const GensetReport = () => {
  const fleet = useFleet();
  const roles = useSitePowerRoles();
  const summaries = useSiteSummaries();
  const services = useServiceRecords();

  const [now] = useState(() => Date.now());
  const [q, setQ] = useState('');

  const from = now - WINDOW_DAYS * 24 * 3_600_000;

  /** Site by id, so a row can name where its machine stands without a scan. */
  const sites = useMemo(
    () => Object.fromEntries(summaries.map((summary) => [summary.site.id, summary])),
    [summaries],
  );

  const rows = useMemo(
    () =>
      fleet
        .map((genset) => gensetReportRow(genset, {sites, roles, services, from, to: now, now}))
        // Thirstiest first. This page is read down its diesel column — the sets
        // worth an hour of anybody's attention are the ones burning the most, and
        // the fuel-rate column beside it is what says whether that is the duty or
        // the loading. Ties fall to the tag so the order is total and the table
        // does not reshuffle between renders.
        .sort((left, right) =>
          right.litres === left.litres
            ? left.genset.tag.localeCompare(right.genset.tag)
            : right.litres - left.litres,
        ),
    [fleet, sites, roles, services, from, now],
  );

  const totals = useMemo(() => gensetReportTotals(rows), [rows]);

  /** `26 Jul`, the day the window opened. */
  const windowLabel = new Date(from).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  });

  /**
   * The table's rows after the search box.
   *
   * Matches what the row actually shows — the tag, the model, the site and its
   * placename — which is the rule `searchGensets` already follows one module
   * over, for the reason it gives there: a reader searching a table expects to
   * find the words they can see in it.
   */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle === '') return rows;
    return rows.filter((row) =>
      [
        row.genset.tag,
        row.genset.model,
        row.site?.site.name ?? '',
        row.site?.site.locationLabel ?? row.genset.locationLabel,
        row.role === undefined ? 'Depot' : SITE_POWER_ROLE_LABEL[row.role],
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  /**
   * What the fleet's loading is costing, in litres.
   *
   * The difference between what these engines burned and what the same
   * kilowatt-hours would have cost at {@link REFERENCE_LOAD_FRACTION} of
   * nameplate. Floored at zero: a fleet running above the reference load is not
   * making diesel, and a negative "excess" is a phrase with no meaning on a page
   * about waste.
   */
  const excessLitres = Math.max(0, totals.litres - totals.litresAtRatedLoad);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-3 pb-24 md:pb-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-none font-semibold text-primary tabular-nums">
            {totals.sets}
          </span>
          <span className="text-sm text-secondary">
            {totals.sets === 1 ? 'genset' : 'gensets'}
          </span>
        </p>
        <p className="text-sm text-secondary">
          {totals.ran} turned in the window, {totals.sets - totals.ran} did not
        </p>
        <p className="text-sm text-secondary">
          {totals.reconcilable} of {totals.sets} can be reconciled for fuel loss
        </p>
      </header>

      <section aria-label="Thirty days" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Thirty days</h2>
          <p className="text-xs text-tertiary">
            Since {windowLabel}, off the run log every genset page draws
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <ReportTile
            label="Engine hours"
            value={hours(totals.runHours)}
            detail={`${
              totals.ran === 0 ? '—' : hours(totals.runHours / totals.ran)
            } on each set that ran`}
            note="Hours the engines were turning inside the window, added across the fleet. Runs are clipped to the window rather than attributed to it, so a shift that straddles the opening date counts only for the part inside."
          />
          <ReportTile
            label="Diesel burned"
            value={litres(totals.litres)}
            detail={`${kwh(totals.energyKwh)} raised for it`}
            note="What the flow meters passed through the engines, costed on the loading each set held while it ran. It is the burn alone — diesel that left a tank without reaching an engine is the fourth tile."
          />
          <ReportTile
            label="Fuel rate"
            value={`${totals.litresPerKwh.toFixed(3)} L/kWh`}
            detail={`at ${percent(totals.loadFraction)} average loading`}
            note={`Fleet litres over fleet kilowatt-hours, not the average of the sets' own rates — a machine that ran for forty minutes should not weigh as much as one that ran all month. The loading beside it is what earned that rate: these engines are specified to sit near ${percent(
              REFERENCE_LOAD_FRACTION,
            )} of nameplate, and the curve is steep below it.`}
          />
          {/* The one tile on this page that is a verdict rather than a tally, and
              the only one allowed a colour. Diesel that left a tank without
              reaching an engine is not a quantity anybody is neutral about — but
              it stays uncoloured at zero, because a green nought is a claim that
              somebody checked, and on a fleet where most sets carry one
              instrument nobody could have. */}
          {/* The one tile here quoted as a **rate**, and the only one on the page
              not measured over the window in the heading. That is not an
              inconsistency to tidy away — see `gensetReport.ts`, where it is
              argued: a detector reconciles a day at a time, and thirty days of a
              standing loss comes to more diesel than these tanks hold. The unit
              is in the value so nobody has to open the tooltip to notice. */}
          <ReportTile
            label="Unaccounted"
            value={`${litres(totals.lossLitresPerDay)}/day`}
            tone={totals.lossLitresPerDay > 0 ? 'warning' : undefined}
            detail={`${totals.losing} of ${totals.reconcilable} reconcilable ${
              totals.reconcilable === 1 ? 'set' : 'sets'
            }${totals.gaining > 0 ? `, ${totals.gaining} gaining` : ''}`}
            note={
              <>
                The gap between the two instruments: the tank is falling by more than the
                flow meter passes. Quoted as a daily rate rather than a window total,
                because a rate is what the reconciliation establishes — it works a day at
                a time, and carrying one across a month claims more diesel than the tank
                could have held. Multiply it by however long the loss has been standing.
                {totals.gainLitresPerDay > 0 && (
                  <>
                    {' '}
                    A further {litres(totals.gainLitresPerDay)} a day is gained rather
                    than lost — a probe drifting high, or deliveries nobody recorded.
                    Reported separately rather than netted off: one tank filling itself on
                    paper must not cancel another being drained.
                  </>
                )}{' '}
                Only sets with both instruments reporting are counted, which is why the
                denominator is smaller than the fleet.
              </>
            }
          />
          <ReportTile
            label="Service"
            value={String(totals.overdue + totals.dueSoon)}
            tone={totals.overdue > 0 ? 'warning' : undefined}
            detail={`${totals.overdue} overdue · ${totals.dueSoon} due soon`}
            note="Sets past an interval or inside the last tenth of one, on the worse of their two counters — run hours since the last service, and time since it. Counted against each set's own intervals, which can be overridden per machine."
          />
        </div>
      </section>

      <section aria-label="Loading" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">What the loading costs</h2>
          <p className="text-xs text-tertiary">
            The same kilowatt-hours, priced at {percent(REFERENCE_LOAD_FRACTION)} of nameplate
            — where these sets are specified to sit, and where the fuel curve
            flattens out
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <ReportTile
            label="Burned"
            value={litres(totals.litres)}
            detail={`at ${percent(totals.loadFraction)} average loading`}
            note="What the fleet actually burned over the window — the same figure as the tile above, repeated here because this band is a comparison and a comparison with one of its terms on another row is arithmetic the reader has to do."
          />
          <ReportTile
            label="At specified loading"
            value={litres(totals.litresAtRatedLoad)}
            detail={`the same ${kwh(totals.energyKwh)}`}
            note={`What the same output would have cost with every engine held near ${percent(
              REFERENCE_LOAD_FRACTION,
            )} of nameplate. Not 100%: an engine at its plate has no headroom for the step load a tower's rectifiers present, so it is a figure nobody designs to and a saving nobody could bank.`}
          />
          {/* Warning-toned wherever there is a figure at all, unlike the
              unaccounted tile. Light loading is not a fault and nobody is
              spilling anything — but it is the single largest lever on this page
              and it does not announce itself in a litre total, which is the whole
              reason the band exists. */}
          <ReportTile
            label="Cost of part load"
            value={litres(excessLitres)}
            tone={excessLitres > 0 ? 'warning' : undefined}
            detail={
              totals.litres > 0
                ? `${percent(excessLitres / totals.litres)} of what was burned`
                : 'nothing burned in the window'
            }
            note="The difference between the two figures beside it. It is not waste anybody chose: a genset is sized for the load it must be able to pick up, not the load it usually carries, and this is what that headroom costs to keep turning. It is also the figure a battery beside the set is bought to remove."
          />
        </div>
      </section>

      <section aria-label="By genset" className="flex min-h-0 min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">By genset</h2>
          <p className="text-xs text-tertiary">
            Thirstiest first. The fuel-rate column is what says whether that is the duty
            or the loading
          </p>
        </header>

        {/* The one band on this page that grows with the estate, so it gets the
            control the other list screens have: the same search box, matching the
            same fields, with the count of what it left standing. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InputGroup className="w-full max-w-[373px]">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tag, model, site or duty"
              aria-label="Search gensets"
            />
          </InputGroup>

          <p className="text-sm text-secondary tabular-nums">
            {filtered.length} of {rows.length} {rows.length === 1 ? 'genset' : 'gensets'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">No gensets match “{q}”.</p>
          </div>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                Every genset on the estate, what it ran, what it burned and what is due
              </caption>
              <colgroup>
                {COLUMNS.map((column) => (
                  <col key={column.label} style={{width: column.width}} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                    >
                      <ReportColumnHead label={column.label} note={column.note} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const idle = row.runHours === 0;

                  return (
                    <tr key={row.genset.id}>
                      <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                        {/* Straight to the machine. A reader who has picked a set
                            out of a list of sets has already chosen; sending them
                            to the fleet screen with this row selected would ask
                            the same question twice. */}
                        <Link
                          to="/gensets/$gensetId"
                          params={{gensetId: row.genset.id}}
                          className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                        >
                          {row.genset.tag}
                        </Link>
                        <span className="block truncate text-xs text-tertiary">
                          {row.genset.model}
                        </span>
                      </td>

                      <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                        {row.site === undefined ? (
                          // In the depot, and that is a place rather than a
                          // missing value — the set has a location, it just has
                          // no site to link to.
                          <span className="block truncate text-secondary">Depot</span>
                        ) : (
                          <Link
                            to="/sites/$siteId"
                            params={{siteId: row.site.site.id}}
                            className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                          >
                            {row.site.site.name}
                          </Link>
                        )}
                        <span className="block truncate text-xs text-tertiary">
                          {row.site?.site.locationLabel ?? row.genset.locationLabel}
                        </span>
                      </td>

                      <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                        <span className="block truncate">
                          {row.role === undefined ? 'Unassigned' : SITE_POWER_ROLE_LABEL[row.role]}
                        </span>
                        <span className="block truncate text-xs text-tertiary tabular-nums">
                          {Math.round(row.ratedKw).toLocaleString('en-MY')} kW rated
                        </span>
                      </td>

                      {/* A set that never turned is set apart by weight rather
                          than by a badge, the same call the Overall tab makes for
                          a site it is quoting: the figures are the same figures
                          and they are all nought. The "Did not run" line is what
                          says which, and it is the honest reading — a standby set
                          that sat still all month is doing its job. */}
                      <td
                        className={cn(
                          'h-13 truncate border-b border-subtle p-2 tabular-nums',
                          idle ? 'text-secondary' : 'text-primary',
                        )}
                      >
                        {hours(row.runHours)}
                        <span className="block truncate text-xs text-tertiary tabular-nums">
                          {idle
                            ? 'Did not run'
                            : `${row.starts} ${row.starts === 1 ? 'start' : 'starts'}`}
                        </span>
                      </td>

                      <td
                        className={cn(
                          'h-13 truncate border-b border-subtle p-2 tabular-nums',
                          idle ? 'text-secondary' : 'text-primary',
                        )}
                      >
                        {litres(row.litres)}
                        <span className="block truncate text-xs text-tertiary tabular-nums">
                          {kwh(row.energyKwh)}
                        </span>
                      </td>

                      <td className="h-13 truncate border-b border-subtle p-2 tabular-nums">
                        {idle ? (
                          <span className="text-tertiary">—</span>
                        ) : (
                          <>
                            <span className="block truncate text-primary">
                              {row.litresPerKwh.toFixed(3)} L/kWh
                            </span>
                            {/* Amber below half nameplate, where the curve has
                                already added a quarter to the bill. Not a fault
                                and not a threshold anybody trips — a colour here
                                is a prompt to look at the site, which is where
                                the battery would go. */}
                            <span
                              className={cn(
                                'block truncate text-xs tabular-nums',
                                row.loadFraction < 0.5 ? 'text-severity-warning' : 'text-tertiary',
                              )}
                            >
                              {percent(row.loadFraction)} loaded
                            </span>
                          </>
                        )}
                      </td>

                      <td className="h-13 truncate border-b border-subtle p-2 tabular-nums">
                        {/* Three states, and the em dash is not the same as the
                            nought. A set with one instrument cannot be
                            reconciled at all, and printing "0 L" against it would
                            be a clean bill of health nobody issued. */}
                        {!row.reconcilable ? (
                          <>
                            <span className="block text-tertiary">—</span>
                            <span className="block truncate text-xs text-tertiary">
                              Not reconcilable
                            </span>
                          </>
                        ) : row.lossLitresPerDay > 0 ? (
                          <>
                            <span className="block truncate text-severity-warning">
                              {litres(row.lossLitresPerDay)}/day
                            </span>
                            <span className="block truncate text-xs text-tertiary tabular-nums">
                              {percent(
                                row.lossLitresPerDay /
                                  (row.litres / WINDOW_DAYS + row.lossLitresPerDay),
                              )}{' '}
                              of the draw
                            </span>
                          </>
                        ) : row.lossLitresPerDay < 0 ? (
                          // A tank that gained. Not amber — nothing is being lost, and
                          // colouring it would send somebody to a site over a probe
                          // reading high — but emphatically not "Reconciled" either,
                          // which is the reading it would get if the sign were dropped.
                          <>
                            <span className="block truncate text-primary">
                              +{litres(-row.lossLitresPerDay)}/day
                            </span>
                            <span className="block truncate text-xs text-tertiary">
                              Unexplained gain
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block truncate text-primary">0 L</span>
                            <span className="block truncate text-xs text-tertiary">Reconciled</span>
                          </>
                        )}
                      </td>

                      <td className="h-13 truncate border-b border-subtle p-2">
                        <ServiceCell row={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
