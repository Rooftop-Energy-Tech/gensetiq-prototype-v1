/**
 * What a solar system reports, and the shapes its page draws it in.
 *
 * Deliberately the same idea as `telemetry.type.ts` next door — a reading is a
 * named quantity and the page decides how to draw it — with one word changed. A
 * genset's `engineOnly` becomes `daylightOnly` here, and it is the same rule
 * about the same kind of mistake: a system's yield is a property of a system in
 * the sun. At three in the morning it is not low, it does not exist, and a chart
 * that drew it down to zero and back would be reporting a nightly shutdown.
 *
 * The two are not merged into one shared reading type. They share a shape and not
 * a meaning: `engineOnly` is a fact about a machine that a person starts, and
 * `daylightOnly` is a fact about the sky.
 *
 * ## What `kind` is for, and what it is not
 *
 * It says what sort of quantity this is — true at an instant, accumulated since
 * somebody reset it, or summed over a closed window — which is what decides
 * whether it belongs on a trace. It used to decide something else as well: every
 * `instantaneous` reading was an inverter's, so a silent box blanked exactly those
 * rows and the render read `kind === 'instantaneous' && !reporting`.
 *
 * That proxy died with the boxes. `withheld` below states the thing it was
 * standing in for, and it is a better flag because it is set by whoever decided to
 * refuse the figure rather than inferred from the figure's shape.
 *
 * `instantaneous` currently has no members — every live figure the system has is
 * the output gauge, which the home page draws itself. It stays in the vocabulary
 * because it is the first thing a real telemetry feed would need.
 */
export const READING_KINDS = ['instantaneous', 'cumulative', 'windowed'] as const;

export type ReadingKind = (typeof READING_KINDS)[number];

export type SystemReading = {
  /** Stable key — what a `SystemAlert` points at. */
  key: string;
  label: string;
  value: number;
  /** Rendered after the figure. `''` for dimensionless readings. */
  unit: string;
  precision?: number;
  kind: ReadingKind;
  /** The quantity only exists while there is sun on the modules. */
  daylightOnly: boolean;
  /**
   * The model refused to publish this one, so the cell prints an em dash.
   *
   * Not "it is zero". A system nobody can hear made no *measurement*, and
   * `systemDetail` already declines to hand today's energy up for that reason —
   * this is the same refusal carried one row further down, to the figures derived
   * from it. `0.00 kWh/kWp` under a card reading "nothing has been heard from this
   * system" is the page arguing with itself in two bands.
   */
  withheld?: boolean;
};
