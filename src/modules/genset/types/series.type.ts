import type {AlertComparator, AlertSeverity} from './alert.type';

/**
 * One reading, sampled over time — what the analysis tab draws.
 *
 * The whole type exists to carry one thing the snapshot cannot: **a reading can
 * be absent**. `value: null` is not zero and not missing data; it means the
 * quantity did not exist at that moment, because the engine was not turning.
 * Oil pressure across a parked weekend is three days of `null`, and drawing it
 * as a line at zero would show a shutdown that never happened.
 */
export type Sample = {
  /** Epoch milliseconds — the left edge of the bucket. */
  t: number;
  value: number | null;
};

/** The dashed line an alert puts on the chart, and where the trace crossed it. */
export type SeriesThreshold = {
  limit: number;
  comparator: AlertComparator;
  severity: AlertSeverity;
  /** The rule's name, e.g. `Undervoltage`. */
  name: string;
  /** Epoch milliseconds — when it was crossed. */
  raisedAt: number;
};

export type ReadingSeries = {
  key: string;
  label: string;
  unit: string;
  precision: number;
  samples: Array<Sample>;
  /**
   * The axis this series is drawn against.
   *
   * Padded off the extremes rather than fitted tight to them, and widened to
   * take in the threshold when there is one — a trace that runs along the top of
   * its own frame reads as pegged, and a threshold line just outside the frame is
   * the one thing you needed to see.
   */
  domain: {min: number; max: number};
  threshold: SeriesThreshold | undefined;
};

/** True once the series has a single real number in it. */
export const hasData = (series: ReadingSeries): boolean =>
  series.samples.some((sample) => sample.value !== null);

/**
 * The sample nearest a moment, or `undefined` past either end.
 *
 * Buckets are evenly spaced, so this is arithmetic rather than a search — the
 * crosshair calls it on every pointer move, and a scan over 600 samples per
 * series per frame is work nobody needs to do.
 */
export const sampleAt = (series: ReadingSeries, t: number): Sample | undefined => {
  const {samples} = series;
  if (samples.length < 2) return samples[0];

  const step = (samples[samples.length - 1].t - samples[0].t) / (samples.length - 1);
  const index = Math.round((t - samples[0].t) / step);
  return samples[Math.min(samples.length - 1, Math.max(0, index))];
};
