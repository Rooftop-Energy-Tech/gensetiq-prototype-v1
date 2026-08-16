import {z} from 'zod';

import {MAX_SERIES} from '../components/detail/analysis/seriesMeta';

/**
 * What the analysis tab is showing, as URL state.
 *
 * Same reason as everywhere else in this app: the useful thing to paste into a
 * message is not "open BRF9540" but "open BRF9540 with coolant temperature
 * against oil pressure over the last week, here is the dip I mean". A chart whose
 * selection lives in component state can be looked at but not *sent*, which for a
 * screen whose whole purpose is investigation is most of the value gone.
 *
 * Every field is `.catch()`-guarded, as with the other two schemas here. These
 * params are meant to be hand-edited, and a typo'd `?window=1w` should fall back
 * to the default rather than throw out of `validateSearch` and blank the route.
 */
export const ANALYSIS_WINDOWS = ['24h', '7d', '30d'] as const;

export type AnalysisWindow = (typeof ANALYSIS_WINDOWS)[number];

export const WINDOW_LABELS: Record<AnalysisWindow, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

export const WINDOW_MS: Record<AnalysisWindow, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

/**
 * What the tab opens on: what the set is delivering, against what it has left to
 * deliver it with. The pair that makes the shape of a standby machine legible in
 * one glance — plateaus of output separated by nothing, and a tank that steps
 * down through each one.
 */
export const DEFAULT_KEYS = 'active-power,fuel-level';

/**
 * The window the tab opens on.
 *
 * Exported alongside `DEFAULT_KEYS` and for the same reason: a `<Link>` *into* this
 * tab has to name the whole search object, because the schema's defaults settle a
 * URL that is parsed rather than one that is built. The runs tab links here per
 * row, carrying a run id.
 */
export const DEFAULT_ANALYSIS_WINDOW = '24h' as const;

export const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 24 * 3_600_000;

/** `2026-08-14` for an instant, in the reader's own timezone. */
export const dateParam = (at: number): string => {
  const day = new Date(at);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`;
};

/**
 * `2026-08-14` back to midnight local, or `undefined` if it is not a real date.
 *
 * The round-trip check is the point: `new Date(2026, 1, 31)` does not fail, it
 * rolls forward to 3 March. A hand-typed `?from=2026-02-31` has to fall back to
 * the preset rather than silently plot a window nobody asked for.
 */
export const parseDateParam = (value: string | undefined): number | undefined => {
  if (value === undefined || !DATE_PARAM.test(value)) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  const at = new Date(year, month - 1, day);
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) {
    return undefined;
  }
  return at.getTime();
};

/** Midnight at the end of a day — the exclusive edge of a calendar selection. */
const endOfDay = (at: number): number => at + DAY_MS;

export const analysisSearchSchema = z.object({
  /**
   * Selected reading keys, comma-separated — `?keys=coolant-temp,oil-pressure`.
   *
   * A string rather than an array because that is what reads well in a URL a
   * person might type. `selectedKeys()` below is the only place it is parsed, so
   * the comma convention does not leak into the components.
   */
  keys: z.string().default(DEFAULT_KEYS).catch(DEFAULT_KEYS),
  window: z.enum(ANALYSIS_WINDOWS).default(DEFAULT_ANALYSIS_WINDOW).catch(DEFAULT_ANALYSIS_WINDOW),
  /**
   * A run id, which overrides `window` when set.
   *
   * The three range selectors are alternative answers to one question, so they
   * are held as separate fields with a stated precedence rather than one union.
   * Each control clears the other two when used, so the contradiction is not
   * normally reachable — but these params are meant to be hand-edited, and
   * `analysisRange()` is the single place a link carrying all three gets
   * resolved. Keeping `window` around underneath is what lets "back to the last
   * 7 days" remember which preset you left.
   */
  run: z.string().optional().catch(undefined),
  /**
   * A custom range, as two local calendar dates — `?from=2026-08-01&to=2026-08-07`.
   *
   * Days rather than instants, because that is the unit a person picks and the
   * unit a URL can carry legibly. The range is resolved to the *start* of `from`
   * and the *end* of `to`, so a single-day selection is that whole day rather
   * than a zero-width window.
   */
  from: z.string().regex(DATE_PARAM).optional().catch(undefined),
  to: z.string().regex(DATE_PARAM).optional().catch(undefined),
});

export type AnalysisSearch = z.infer<typeof analysisSearchSchema>;

/**
 * The selected keys, deduplicated and capped.
 *
 * The cap is enforced on the way *out* of the URL, not only in the picker: a
 * hand-edited `?keys=a,b,c,d` has to resolve to something the chart can draw,
 * and the chart has two axes.
 */
export const selectedKeys = (search: AnalysisSearch): Array<string> =>
  [...new Set(search.keys.split(',').filter((key) => key !== ''))].slice(0, MAX_SERIES);

/**
 * Add or remove a key, oldest-out when the pair is already full.
 *
 * Dropping the older selection rather than refusing the click is the kinder
 * behaviour by some margin: on a dual-axis chart the common move is "keep this
 * one, swap the other for that", and a picker that goes inert until you
 * remember to untick something makes the reader do the bookkeeping.
 *
 * Removing the last one is a no-op. An empty chart is not a state worth being
 * able to link to, and leaving one series standing means the axis, the window and
 * the crosshair all still mean something while you pick its replacement.
 */
export const toggleKey = (search: AnalysisSearch, key: string): AnalysisSearch => {
  const current = selectedKeys(search);
  if (current.length === 1 && current[0] === key) return search;

  const next = current.includes(key)
    ? current.filter((one) => one !== key)
    : [...current, key].slice(-MAX_SERIES);

  return {...search, keys: next.join(',')};
};

/** What the chart draws across, and which of the three selectors decided it. */
export type AnalysisRange = {
  from: number;
  to: number;
  kind: 'preset' | 'run' | 'custom';
  /** Set when `kind` is `run`. */
  runId: string | undefined;
};

/**
 * Resolve the window, run and custom-range params into one span.
 *
 * Precedence is run, then custom, then preset. It only matters for a URL that
 * carries more than one — the controls clear each other — but it has to be
 * stated somewhere, and one function that always returns a drawable span is
 * cheaper to trust than three components agreeing not to conflict.
 *
 * `earliest` is the history layer's own horizon. A custom range reaching past it
 * is clamped rather than refused: the reader asked for March, and showing them
 * the part that exists beats an error about a boundary they cannot see.
 */
export const analysisRange = (
  search: AnalysisSearch,
  runs: Array<{id: string; startedAt: string; endedAt: string | null}>,
  now: number,
  earliest: number,
): AnalysisRange => {
  const run = search.run === undefined ? undefined : runs.find((one) => one.id === search.run);

  if (run !== undefined) {
    const startedMs = new Date(run.startedAt).getTime();
    const endedMs = run.endedAt === null ? now : new Date(run.endedAt).getTime();
    // A little air either side, so the run's first and last samples are not
    // drawn on the frame — and so the shading makes it obvious where it began.
    const margin = Math.max(5 * 60_000, (endedMs - startedMs) * 0.04);
    return {
      from: startedMs - margin,
      to: Math.min(now, endedMs + margin),
      kind: 'run',
      runId: run.id,
    };
  }

  const customFrom = parseDateParam(search.from);
  const customTo = parseDateParam(search.to);

  if (customFrom !== undefined && customTo !== undefined) {
    // Sorted rather than rejected. A link with its dates the wrong way round
    // still names two days and one span between them.
    const start = Math.max(earliest, Math.min(customFrom, customTo));
    const end = Math.min(now, endOfDay(Math.max(customFrom, customTo)));

    if (end > start) return {from: start, to: end, kind: 'custom', runId: undefined};
  }

  return {
    from: Math.max(earliest, now - WINDOW_MS[search.window]),
    to: now,
    kind: 'preset',
    runId: undefined,
  };
};

/**
 * A search with every range selector cleared.
 *
 * Spread over whichever one is being set, so choosing a preset drops a custom
 * range and choosing a run drops both. Without it the chips would disagree with
 * the chart — the reader would pick `24 hours`, `analysisRange` would keep
 * honouring the run still sitting in the URL, and nothing on screen would say
 * why.
 */
export const clearedRange = (search: AnalysisSearch): AnalysisSearch => ({
  ...search,
  run: undefined,
  from: undefined,
  to: undefined,
});
