import {dateParam} from '../types/analysisView.type';
import {isOpen, runElapsedMs} from '../types/run.type';
import type {GensetRun} from '../types/run.type';
import {countsInRange} from '../types/runsView.type';
import type {RunRange, RunTotals} from '../types/runsView.type';

/**
 * The run log as a file somebody bills against.
 *
 * This is the one place in the app where a figure leaves it, and that changes what
 * "correct" means. On screen a caption can carry a caveat and the reader has the
 * rest of the page for context. In a spreadsheet the file is the whole context —
 * so every qualification the page states in passing has to be *in the file*, and
 * the two that matter are the ones a reader could not otherwise reconstruct:
 *
 *  1. **the range covered may not be the range asked for.** The history layer has
 *     a horizon; a request reaching past it is clamped. A file headed "12 May – 16
 *     Aug" holding eight weeks of rows is a document misrepresenting itself.
 *  2. **an open run is not a billable quantity.** Its totals are still climbing,
 *     so it is listed and excluded, and the file says which.
 *
 * CSV rather than a branded PDF because the two are different deliverables and only
 * one of them is a data file. A spreadsheet is what somebody reconciling an invoice
 * actually wants — sortable, summable, no layout to fight. A PDF is what you hand a
 * customer, and it needs a template and a letterhead that are not this file's to
 * invent.
 */

const HOUR = 3_600_000;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * `2026-08-16T06:00:00+08:00` — an instant with its offset spelled out.
 *
 * Local time with an explicit offset, never `toISOString()`. That returns UTC, and
 * UTC moves a 06:00 start in Malaysia back to the previous calendar day — which on
 * a document where the period boundary is the billable fact is not a formatting
 * preference, it is a run invoiced to the wrong month.
 */
const isoLocal = (at: number): string => {
  const time = new Date(at);
  const offset = -time.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const size = Math.abs(offset);

  return (
    `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}` +
    `T${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}` +
    `${sign}${pad(Math.floor(size / 60))}:${pad(size % 60)}`
  );
};

/**
 * The last instant a range includes.
 *
 * Both ranges are held half-open — the end is midnight the following morning — which
 * is right for arithmetic and wrong to print. A file headed "requested to
 * 2026-08-17" for a range somebody drew to the 16th is an off-by-one on the exact
 * field they will check first, and on a document that settles an invoice that is a
 * query rather than a typo.
 */
const lastInstant = (exclusiveEnd: number): number => exclusiveEnd - 1;

/** `16 Aug 2026` — for the prose lines in the header block. */
const readable = (at: number): string => {
  const day = new Date(at);
  return `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
};

/**
 * One CSV field, quoted only when it has to be.
 *
 * Quoting everything would be simpler and is what most hand-rolled exporters do;
 * it also makes the file unreadable in a text editor, which is where somebody
 * looks when a column has landed in the wrong place.
 */
const cell = (value: string | number): string => {
  const text = String(value);
  return /["\n,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const line = (...cells: Array<string | number>): string => cells.map(cell).join(',');

/** Decimal hours, 2 dp — a column somebody can sum. */
const hours = (milliseconds: number): string => (milliseconds / HOUR).toFixed(2);

export type RunsCsvRow = {
  run: GensetRun;
  /**
   * Which machine ran, on a site export. `undefined` on a genset's own log, where
   * the answer is in the header and a column repeating it 60 times is noise.
   */
  assetTag: string | undefined;
};

export type RunsCsvInput = {
  /** `Genset` or `Site` — what the log is *of*. */
  scope: string;
  /** `BRF9540 | Cummins 1000 kVa`, or `Telco-001`. */
  name: string;
  /** Where it stands. */
  place: string;
  range: RunRange;
  /** The history layer's horizon, for the clamp note. */
  earliest: number;
  now: number;
  rows: Array<RunsCsvRow>;
  totals: RunTotals;
  /**
   * How to describe the energy column's subject.
   *
   * A site's total is what its *sets produced*, which is not what the site
   * received — a set turning while isolated is off-load and delivered nothing to
   * the load. On screen the surrounding page makes that readable; in a file the
   * distinction survives only if the words carry it.
   */
  energyNote: string | undefined;
};

export const runsCsv = (input: RunsCsvInput): string => {
  const {range, rows, totals} = input;
  const withAsset = rows.some((row) => row.assetTag !== undefined);

  const out: Array<string> = [
    line('gensetIQ run log'),
    line(input.scope, input.name),
    line('Location', input.place),
    line('Range covered', isoLocal(range.from), isoLocal(lastInstant(range.to))),
  ];

  // Only when they differ. A "requested" line echoing the covered one on every
  // ordinary export trains the reader to skip the block that matters on the one
  // export where it doesn't.
  if (range.requested !== undefined) {
    out.push(
      line(
        'Range requested',
        isoLocal(range.requested.from),
        isoLocal(lastInstant(range.requested.to)),
      ),
      line(
        'Note',
        `Clamped. This log holds runs from ${readable(input.earliest)} onward; the requested range extends beyond what is held.`,
      ),
    );
  }

  out.push(line('Generated', isoLocal(input.now)), '');

  out.push(
    line('Completed runs', totals.completed),
    line('Time running (h)', hours(totals.runtimeMs)),
    line('Energy produced (kWh)', totals.energyKwh),
    line('Fuel consumed (L)', totals.fuelLitres),
  );

  if (input.energyNote !== undefined) out.push(line('Note', input.energyNote));

  if (totals.open > 0) {
    out.push(
      line(
        'Note',
        `${totals.open} run${totals.open === 1 ? ' is' : 's are'} still in progress, listed below and excluded from the totals — the figures are still climbing.`,
      ),
    );
  }

  if (totals.carriedIn > 0) {
    out.push(
      line(
        'Note',
        `${totals.carriedIn} run${totals.carriedIn === 1 ? ' was' : 's were'} already turning when this period opened, listed below and excluded from the totals — ${totals.carriedIn === 1 ? 'it belongs' : 'they belong'} to the period ${totals.carriedIn === 1 ? 'it' : 'they'} started in.`,
      ),
    );
  }

  out.push(
    '',
    // Units in the header, raw numbers in the cells. `1,260 kWh` is a string that
    // breaks the column it sits in and cannot be summed, which defeats the format.
    withAsset
      ? line('Started', 'Ended', 'Asset', 'Duration (h)', 'Energy (kWh)', 'Fuel (L)', 'Status')
      : line('Started', 'Ended', 'Duration (h)', 'Energy (kWh)', 'Fuel (L)', 'Status'),
  );

  for (const {run, assetTag} of rows) {
    const started = isoLocal(new Date(run.startedAt).getTime());
    const ended = run.endedAt === null ? '' : isoLocal(new Date(run.endedAt).getTime());
    const span = hours(runElapsedMs(run, input.now));

    // Three statuses, not two. A row whose figures are not in the totals has to say
    // so on its own line — somebody filtering this sheet to "Completed" and summing
    // the column must land on the same number the header states, or the file
    // disagrees with itself in the one way a spreadsheet makes easy to hit.
    const status = isOpen(run)
      ? 'In progress'
      : countsInRange(run, range)
        ? 'Completed'
        : 'Carried in';

    out.push(
      withAsset
        ? line(
            started,
            ended,
            assetTag ?? '',
            span,
            run.energyProducedKwh,
            run.fuelConsumedLitres,
            status,
          )
        : line(started, ended, span, run.energyProducedKwh, run.fuelConsumedLitres, status),
    );
  }

  return out.join('\n');
};

/** `BRF9540-runs-2026-06-17-to-2026-08-16.csv`. */
export const runsCsvFilename = (name: string, range: RunRange): string => {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // The range *covered*, not the one requested: the filename should describe what
  // is inside the file. The end is the last day included rather than the exclusive
  // edge, or a July export lands in a file named for 1 August.
  return `${slug}-runs-${dateParam(range.from)}-to-${dateParam(range.to - 1)}.csv`;
};
