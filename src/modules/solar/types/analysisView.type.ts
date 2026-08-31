import {z} from 'zod';

import {MAX_SERIES} from '@/modules/genset/components/detail/analysis/seriesMeta';
import {solarRangeSchema} from './range.type';

/**
 * Two screens' state, and the split between them is the model correction again.
 *
 * The analysis tab used to carry both of these: a period for the yield charts and
 * a window for a trace of "the array's" readings. That only ever worked because
 * every system on the demo estate had one inverter. Ask a ten-box plant for *the*
 * DC current and there is no answer, and the whole diagnostic value is in which
 * box is different.
 *
 * So the trace went down to the inverter, where the readings actually come from,
 * and the two controls went with their charts:
 *
 *  - **`systemAnalysisSearchSchema`** — the period over generation against
 *    design. Its options are the solar ones, `7D · 30D · 12M · Custom`, because a
 *    design P50 is a *monthly* figure and `HAS_DESIGN_BENCHMARK` decides per range
 *    whether there is anything to compare against at all.
 *  - **`inverterTraceSearchSchema`** — which readings, over how long. Its options
 *    are hours and days, because a DC current at two-hour buckets across a year is
 *    not a trace, it is a texture.
 *
 * One control over both was the first draft. It forced the reading trace to offer
 * `12M`, which draws four thousand samples of a quantity nobody reads at that
 * grain, and forced the yield chart to offer `24H`, which has no benchmark and so
 * is not the comparison the section exists to make.
 *
 * `.catch()`-guarded throughout, the rule every schema in this app follows: these
 * get hand-edited and a malformed one should fall back rather than throw out of
 * `validateSearch` and blank the route.
 */
export const systemAnalysisSearchSchema = z.object({...solarRangeSchema});

export type SystemAnalysisSearch = z.infer<typeof systemAnalysisSearchSchema>;

export const TRACE_WINDOWS = ['24h', '7d', '30d'] as const;

export type TraceWindow = (typeof TRACE_WINDOWS)[number];

export const TRACE_WINDOW_LABEL: Record<TraceWindow, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
};

const HOUR = 60 * 60 * 1000;

export const TRACE_WINDOW_MS: Record<TraceWindow, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

export const DEFAULT_TRACE_WINDOW: TraceWindow = '24h';

/**
 * The pair a box opens on: what it is putting out, and the current behind it.
 *
 * Chosen because the two together are the first question anybody asks of an
 * inverter that looks wrong — whether the shortfall is on the DC side (a string)
 * or the AC side (the box itself). Two traces that move together say the array;
 * AC alone falling away says the inverter.
 */
const DEFAULT_TRACE_KEYS = 'ac-power,dc-current';

export const inverterTraceSearchSchema = z.object({
  /**
   * The plotted readings, comma-separated, in the order they were picked.
   *
   * A string rather than an array because that is what reads well in an address
   * bar — `?keys=ac-power,dc-current` — and the pair is small enough that parsing
   * it is one `split`.
   */
  // **Optional and undefaulted**, which is the one thing here not copied from the
  // genset's analysis schema. Two reasons, and the second is the load-bearing one:
  //
  //  · absent means "nobody has said" and the page decides, which is the posture
  //    `view.type.ts` already argues for on the Solar report's view;
  //  · a `.default()` makes the field *required on the way in*, and TanStack then
  //    demands a `search` prop on every `<Link>` pointing here. The inverter list
  //    links to one literal route, so that check bites — where the tab strips get
  //    away with it only because a union of `to` values relaxes it. A default that
  //    has to be repeated at each caller is not a default.
  keys: z.string().optional().catch(undefined),
  window: z.enum(TRACE_WINDOWS).optional().catch(undefined),
});

export type InverterTraceSearch = z.infer<typeof inverterTraceSearchSchema>;

export const selectedKeys = (search: InverterTraceSearch): Array<string> =>
  [
    ...new Set((search.keys ?? DEFAULT_TRACE_KEYS).split(',').filter((key) => key !== '')),
  ].slice(0, MAX_SERIES);

/** The window a trace is drawn over, resolved from an address that may not say. */
export const traceWindow = (search: InverterTraceSearch): TraceWindow =>
  search.window ?? DEFAULT_TRACE_WINDOW;

/**
 * Add or remove a key, oldest-out when the pair is already full — the genset
 * tab's rule, and it is worth restating why rather than just copying it.
 *
 * Dropping the older selection is kinder than refusing the click: on a dual-axis
 * chart the common move is "keep this one, swap the other for that", and a picker
 * that goes inert until you remember to untick something makes the reader do the
 * bookkeeping. Removing the last one is a no-op — an empty chart is not a state
 * worth linking to.
 */
export const toggleKey = (
  search: InverterTraceSearch,
  key: string,
): InverterTraceSearch => {
  const current = selectedKeys(search);
  if (current.length === 1 && current[0] === key) return search;

  const next = current.includes(key)
    ? current.filter((one) => one !== key)
    : [...current, key].slice(-MAX_SERIES);

  return {...search, keys: next.join(',')};
};
