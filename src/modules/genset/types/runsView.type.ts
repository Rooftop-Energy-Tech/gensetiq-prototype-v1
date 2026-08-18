import {z} from 'zod';

import {
  ANALYSIS_WINDOWS,
  DATE_PARAM,
  WINDOW_LABELS,
  WINDOW_MS,
  parseDateParam,
} from './analysisView.type';
import {isOpen, runElapsedMs} from './run.type';
import type {GensetRun} from './run.type';

/**
 * What the runs tab is showing, as URL state.
 *
 * The same argument as the analysis tab next door: a range someone chose is worth
 * being able to send. "Look at BRF9540's runs" is a shrug; "look at BRF9540's runs
 * for July" is the message somebody actually wanted to write, and it is also the
 * range they are about to export and invoice against.
 *
 * Two selectors rather than the analysis tab's three. There is no *by run*
 * selector here, because this page **is** the list of runs — a control that
 * narrowed it to one row would be a filter whose result is the thing you clicked.
 */

const DAY_MS = 24 * 3_600_000;

/**
 * The presets, plus `all`.
 *
 * The first three are the analysis tab's own vocabulary, imported rather than
 * retyped — the two tabs sit one click apart and a `7d` that meant different spans
 * on each would be the app disagreeing with itself.
 *
 * `all` is this tab's addition and it earns its place: a backup set runs three
 * times a year, so every bounded preset is empty for it and the honest default
 * answer to "show me the runs" is all of them.
 */
export const RUN_WINDOWS = [...ANALYSIS_WINDOWS, 'all'] as const;

export type RunWindow = (typeof RUN_WINDOWS)[number];

export const RUN_WINDOW_LABELS: Record<RunWindow, string> = {...WINDOW_LABELS, all: 'All'};

/**
 * A month. Long enough that a continuous set shows a pattern rather than a
 * fragment, short enough that the totals answer a question somebody asked.
 *
 * Exported because a `<Link>` into this tab has to name the whole search object —
 * the schema's defaults settle a URL that is *parsed*, not one that is *built* —
 * and the run card's arrow on the home page is exactly such a link.
 */
export const DEFAULT_RUN_WINDOW: RunWindow = '30d';

export const runsSearchSchema = z.object({
  window: z.enum(RUN_WINDOWS).default(DEFAULT_RUN_WINDOW).catch(DEFAULT_RUN_WINDOW),
  /** A custom range, as two local calendar dates — `?from=2026-08-01&to=2026-08-07`. */
  from: z.string().regex(DATE_PARAM).optional().catch(undefined),
  to: z.string().regex(DATE_PARAM).optional().catch(undefined),
  /**
   * A deployment id — `?dep=brf9540-dep-1` — scoping the log to one posting.
   *
   * A third way of naming a range, not a third kind of range: it resolves to the
   * posting's own window, exactly, so the totals here reconcile to the litre with
   * the same posting's row on the dispatch feed. Day-granular `from`/`to` params
   * could not say "from 14:20 on the 9th", and a posting starts when the lorry
   * leaves, not at midnight.
   */
  dep: z.string().optional().catch(undefined),
});

export type RunsSearch = z.infer<typeof runsSearchSchema>;

/**
 * What the page is reporting on, and whether the reader got what they asked for.
 *
 * `requested` is the field that matters, and it exists because of the export
 * button. On screen, a range quietly trimmed to the history we hold is a small
 * dishonesty. In a CSV that someone bills against it is a document making a claim
 * about a period it does not cover — so the clamp has to survive as a *fact*, not
 * as a silently narrowed pair of numbers.
 */
export type RunRange = {
  from: number;
  to: number;
  kind: 'preset' | 'custom' | 'deployment';
  /** What was asked for, set only when it differs from what is held. */
  requested: {from: number; to: number} | undefined;
};

/** Midnight at the end of a day — the exclusive edge of a calendar selection. */
const endOfDay = (at: number): number => at + DAY_MS;

/**
 * Resolve the window and custom-range params into one span.
 *
 * Custom before preset, and a range reaching past the history layer's horizon is
 * **clamped rather than refused** — the reader asked for March and showing the part
 * that exists beats an error about a boundary they cannot see. What differs from
 * the analysis tab is that the clamp is recorded rather than absorbed, because
 * here it leaves the app in a file.
 */
export const runsRange = (search: RunsSearch, now: number, earliest: number): RunRange => {
  const customFrom = parseDateParam(search.from);
  const customTo = parseDateParam(search.to);

  if (customFrom !== undefined && customTo !== undefined) {
    // Sorted rather than rejected, as next door: a link with its dates the wrong
    // way round still names two days and one span between them.
    const askedFrom = Math.min(customFrom, customTo);
    const askedTo = endOfDay(Math.max(customFrom, customTo));

    const from = Math.max(earliest, askedFrom);
    const to = Math.min(now, askedTo);

    if (to > from) {
      const clamped = from !== askedFrom || to !== askedTo;
      return {
        from,
        to,
        kind: 'custom',
        requested: clamped ? {from: askedFrom, to: askedTo} : undefined,
      };
    }
  }

  if (search.window === 'all') {
    return {from: earliest, to: now, kind: 'preset', requested: undefined};
  }

  return {
    from: Math.max(earliest, now - WINDOW_MS[search.window]),
    to: now,
    kind: 'preset',
    requested: undefined,
  };
};

/** A search with the custom range and posting cleared, to spread over a preset selection. */
export const clearedRunsRange = (search: RunsSearch): RunsSearch => ({
  ...search,
  from: undefined,
  to: undefined,
  dep: undefined,
});

/**
 * The runs a window **shows**: every run that was turning during any part of it.
 *
 * *Listing* and *totalling* are two questions, and answering both with one rule was
 * the mistake this replaces. The list asks **what was this machine doing during
 * these dates**, and a run that began before the window and was still turning
 * inside it is the most emphatic possible answer. Selecting on start date alone
 * made a set that had been running without a break for three days report *no runs
 * in the last 24 hours* — a claim the strip, the totals and the table then agreed
 * on, consistently and wrongly.
 *
 * An open run is the case that makes it obvious, because every window ending at
 * `now` contains one by definition, but the flaw is not special to open runs: a
 * closed run that started twenty-five hours ago and stopped an hour ago
 * disappeared from a day's view in exactly the same way.
 */
export const runsOverlapping = <T,>(
  runs: Array<T>,
  range: RunRange,
  /** A bare run on one page, a row carrying one on the other. */
  runOf: (item: T) => GensetRun,
): Array<T> =>
  runs.filter((item) => {
    const run = runOf(item);
    const started = new Date(run.startedAt).getTime();
    const ended = run.endedAt === null ? Number.POSITIVE_INFINITY : new Date(run.endedAt).getTime();

    return started < range.to && ended > range.from;
  });

/**
 * Whether a run's figures are **this window's to claim**: finished, and begun
 * inside it.
 *
 * The listing rule is generous because showing a reader something true costs
 * nothing. This one is strict because it feeds a total somebody bills against, and
 * the two runs it excludes are excluded for different reasons.
 *
 * **A run still turning** has partial figures — they are still climbing — so
 * summing them makes the same export return different numbers half an hour apart.
 * On a billing document that is two documents that disagree.
 *
 * **A run carried in from before the window** delivered some of its energy on the
 * far side of the boundary. Splitting it pro-rata would invent a number, since
 * output is not uniform across a run — that is the entire premise of the analysis
 * tab. Counting it whole would credit this window with fuel burned before it
 * opened. So it belongs to the period it *began* in, the way a transaction belongs
 * to its date: arbitrary at the boundary, but a stated rule a reader can check
 * rather than a computation they must trust.
 *
 * Both are listed and marked. Dropping them would hide runs that genuinely
 * happened, and a reader can decide what to do about a run they can see.
 */
export const countsInRange = (run: GensetRun, range: RunRange): boolean =>
  !isOpen(run) && new Date(run.startedAt).getTime() >= range.from;

export type RunTotals = {
  /** Runs the window owns. What the three figures below are summed over. */
  completed: number;
  /** Runs still turning. Listed, deliberately not counted. */
  open: number;
  /** Runs that began before the window. Listed, counted by the earlier period. */
  carriedIn: number;
  runtimeMs: number;
  energyKwh: number;
  fuelLitres: number;
  /** kWh per litre across the counted runs, or `null` when nothing burned. */
  sfcKwhPerL: number | null;
  /**
   * Counted energy against what nameplate could have delivered over the counted
   * runtime, 0–1. `null` on the site log, which has no single nameplate to
   * measure against.
   */
  loadFactor: number | null;
};

export const runTotals = (
  runs: Array<GensetRun>,
  range: RunRange,
  now: number,
  /** The set's nameplate kW — omitted on the site log, where sets differ. */
  ratedKw?: number,
): RunTotals => {
  const counted = runs.filter((run) => countsInRange(run, range));
  const runtimeMs = counted.reduce((sum, run) => sum + runElapsedMs(run, now), 0);
  const energyKwh = counted.reduce((sum, run) => sum + run.energyProducedKwh, 0);
  const fuelLitres = counted.reduce((sum, run) => sum + run.fuelConsumedLitres, 0);
  const runtimeHours = runtimeMs / 3_600_000;

  return {
    completed: counted.length,
    open: runs.filter(isOpen).length,
    carriedIn: runs.filter((run) => !isOpen(run) && !countsInRange(run, range)).length,
    runtimeMs,
    energyKwh,
    fuelLitres,
    sfcKwhPerL: fuelLitres > 0 ? energyKwh / fuelLitres : null,
    loadFactor:
      ratedKw !== undefined && ratedKw > 0 && runtimeHours > 0
        ? energyKwh / (runtimeHours * ratedKw)
        : null,
  };
};
