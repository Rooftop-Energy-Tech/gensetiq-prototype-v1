import {GENSETS} from '@/modules/genset/data/fleet';
import {gensetRuns, refuelsIn} from '@/modules/genset/data/history';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {seededDeployments, seededMemberships} from '@/modules/deployment/data/seed';
import {gensetTotalsIn} from '@/modules/deployment/data/seed';

/**
 * The three exports, built here rather than in the component.
 *
 * ## Why the page is exports and not charts
 *
 * Every figure this app holds is already drawn somewhere — the tank curve on the
 * genset page, the totals on a posting, the runs in their own tab. A reporting
 * screen that re-plotted them would be a fourth place for the same numbers to
 * disagree, which is the argument the rail's own notes make against the screens that
 * were cut. What no screen can do is hand somebody a file: an invoice is settled in
 * a spreadsheet, and a fleet manager asked for last quarter cannot be answered with
 * a scroll position.
 *
 * ## Every row is clipped to the requested range, and says so
 *
 * A run that straddles the start of the range is *included and clipped*, and its
 * hours are the hours inside the window rather than the run's own. A file that
 * silently counted a 64-hour run against a day the machine turned for six of them
 * would overstate that day by an order of magnitude, and it is the sort of error
 * that survives review because the total looks plausible.
 */

/** One CSV field, quoted only when it must be — the rule `runsCsv` uses. */
const cell = (value: string | number): string => {
  const text = String(value);
  return /["\n,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const line = (...cells: Array<string | number>): string => cells.map(cell).join(',');

/** `2026-09-16T17:11:29+08:00` — local, with the offset stated. */
const stamp = (at: number): string => {
  const t = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -t.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const size = Math.abs(offset);
  return (
    `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` +
    `T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}` +
    `${sign}${pad(Math.floor(size / 60))}:${pad(size % 60)}`
  );
};

const hours = (ms: number): string => (ms / 3_600_000).toFixed(2);

export type ExportRange = {from: number; to: number};

export type ExportKind = 'runs' | 'postings' | 'deliveries';

export type ExportSpec = {
  kind: ExportKind;
  label: string;
  /** What the file answers, in the reader's words. */
  blurb: string;
  build: (range: ExportRange) => {csv: string; rows: number};
};

const runsExport = ({from, to}: ExportRange) => {
  const out = [
    line(
      'Genset',
      'Asset tag',
      'Started',
      'Ended',
      'Hours in range',
      'Energy kWh',
      'Fuel litres',
      'Clipped',
    ),
  ];
  let rows = 0;

  for (const genset of GENSETS) {
    for (const run of [...gensetRuns(genset.id)].reverse()) {
      const startMs = new Date(run.startedAt).getTime();
      const endMs = run.endedAt === null ? to : new Date(run.endedAt).getTime();
      if (endMs < from || startMs > to) continue;

      const clippedMs = Math.min(endMs, to) - Math.max(startMs, from);
      if (clippedMs <= 0) continue;
      const share = endMs > startMs ? clippedMs / (endMs - startMs) : 1;

      rows += 1;
      out.push(
        line(
          gensetLabel(genset),
          genset.tag,
          stamp(startMs),
          run.endedAt === null ? 'running' : stamp(endMs),
          hours(clippedMs),
          Math.round(run.energyProducedKwh * share),
          Math.round(run.fuelConsumedLitres * share),
          // Stated per row rather than in a footnote: a reader filtering the file
          // has to know which of these figures are partial.
          share < 0.999 ? 'yes' : 'no',
        ),
      );
    }
  }

  return {csv: out.join('\n'), rows};
};

const postingsExport = ({from, to}: ExportRange) => {
  const now = Date.now();
  const deployments = new Map(seededDeployments().map((d) => [d.id, d]));
  const out = [
    line(
      'Reference',
      'Genset',
      'Location',
      'Started',
      'Ended',
      'Days',
      'Run hours in range',
      'Energy kWh',
      'Fuel litres',
      'Start tank L',
      'End tank L',
    ),
  ];
  let rows = 0;

  for (const member of seededMemberships()) {
    const deployment = deployments.get(member.deploymentId);
    if (deployment === undefined) continue;

    const startMs = new Date(deployment.startsAt).getTime();
    const endMs = deployment.endsAt === null ? now : new Date(deployment.endsAt).getTime();
    if (endMs < from || startMs > to) continue;

    const genset = GENSETS.find((g) => g.id === member.gensetId);
    const totals = gensetTotalsIn(
      member.gensetId,
      Math.max(startMs, from),
      Math.min(endMs, to),
      now,
    );

    rows += 1;
    out.push(
      line(
        deployment.reference,
        genset === undefined ? member.gensetId : gensetLabel(genset),
        // A posting with no yard on the record prints its own words rather than a
        // blank: an empty cell in a file reads as data loss.
        deployment.locationLabel,
        stamp(startMs),
        deployment.endsAt === null ? 'open' : stamp(endMs),
        ((endMs - startMs) / 86_400_000).toFixed(1),
        totals.runtimeHours.toFixed(2),
        Math.round(totals.energyKwh),
        Math.round(totals.fuelBurnedLitres),
        member.startFuelLitres,
        member.endFuelLitres ?? '',
      ),
    );
  }

  return {csv: out.join('\n'), rows};
};

/**
 * Where a machine was standing at an instant — the posting that held it then.
 *
 * **Not `genset.locationLabel`.** That is where the set is *now*, and a delivery is
 * history: BRF 9540 took 1,057 L at a yard on the 16th and is in the workshop today,
 * so a file built from the current placename would put five deliveries in a workshop
 * that never saw a tanker. The refuel screen makes the same distinction for the same
 * reason — see `deliveryLocation` there.
 */
const placeAt = (gensetId: string, at: number): string => {
  const deployments = new Map(seededDeployments().map((d) => [d.id, d]));

  for (const member of seededMemberships()) {
    if (member.gensetId !== gensetId) continue;
    const deployment = deployments.get(member.deploymentId);
    if (deployment === undefined) continue;

    const startMs = new Date(deployment.startsAt).getTime();
    const endMs = deployment.endsAt === null ? Number.POSITIVE_INFINITY : new Date(deployment.endsAt).getTime();
    if (at >= startMs && at <= endMs) return deployment.locationLabel;
  }

  // A top-up between jobs is a real thing and not a gap in the record, so it says so
  // rather than falling back to a yard the machine was not at.
  return 'Between postings';
};

const deliveriesExport = ({from, to}: ExportRange) => {
  const out = [line('Genset', 'Asset tag', 'Delivered at', 'Litres', 'Location')];
  let rows = 0;

  for (const genset of GENSETS) {
    for (const refuel of refuelsIn(genset.id, from, to)) {
      rows += 1;
      out.push(
        line(
          gensetLabel(genset),
          genset.tag,
          stamp(refuel.at),
          Math.round(refuel.litres),
          placeAt(genset.id, refuel.at),
        ),
      );
    }
  }

  return {csv: out.join('\n'), rows};
};

export const EXPORTS: ReadonlyArray<ExportSpec> = [
  {
    kind: 'runs',
    label: 'Runs',
    blurb: 'Every run the fleet turned, clipped to the range, with hours, energy and litres.',
    build: runsExport,
  },
  {
    kind: 'postings',
    label: 'Postings',
    blurb: 'Deployments overlapping the range — yard, days, run hours and the tank at each edge.',
    build: postingsExport,
  },
  {
    kind: 'deliveries',
    label: 'Deliveries',
    blurb: 'Fuel that went into a tank inside the range, per machine.',
    build: deliveriesExport,
  },
];

/** `gensetiq-runs-2026-06-01-to-2026-09-21.csv`. */
export const exportFilename = (kind: ExportKind, {from, to}: ExportRange): string => {
  const day = (at: number) => new Date(at).toISOString().slice(0, 10);
  return `gensetiq-${kind}-${day(from)}-to-${day(to)}.csv`;
};
