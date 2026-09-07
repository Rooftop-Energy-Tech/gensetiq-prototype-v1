import {z} from 'zod';

import {solarRangeSchema} from './range.type';

/**
 * The analysis tab's state: the period the generation chart covers.
 *
 * ## Why there is only one control left here
 *
 * There were two. Beside this one sat `inverterTraceSearchSchema` — which
 * readings, over how long — for a trace of one box's dials, and the split between
 * them was carefully argued: a period in months for a quantity read in months,
 * and a window in hours for a DC current, because a current at two-hour buckets
 * across a year is not a trace but a texture.
 *
 * The trace is gone with the box it belonged to. These are telco sites: the array
 * feeds a −48 V DC bus, there is no inverter anywhere on one to hold a heatsink
 * temperature or an insulation resistance, and a reading picker over an array is
 * a picker over nothing — every quantity this module still has is energy over a
 * closed period, which is what the chart under this control draws.
 *
 * So what is left is the generation period, and its options are the solar ones,
 * `7D · 30D · 12M · Custom` — the windows somebody asks a month-scale quantity
 * about.
 *
 * `.catch()`-guarded throughout `range.type.ts`, the rule every schema in this
 * app follows: these get hand-edited and a malformed one should fall back rather
 * than throw out of `validateSearch` and blank the route.
 */
export const systemAnalysisSearchSchema = z.object({...solarRangeSchema});

export type SystemAnalysisSearch = z.infer<typeof systemAnalysisSearchSchema>;
