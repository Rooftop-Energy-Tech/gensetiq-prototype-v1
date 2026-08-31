/**
 * What an inverter reports, and the shapes its page draws it in.
 *
 * Deliberately the same idea as `telemetry.type.ts` next door — a reading is a
 * named quantity and the page decides how to draw it — with one word changed. A
 * genset's `engineOnly` becomes `daylightOnly` here, and it is the same rule
 * about the same kind of mistake: DC string current is a property of a system in
 * the sun. At three in the morning it is not low, it does not exist, and a chart
 * that drew it down to zero and back would be reporting a nightly shutdown.
 *
 * The two are not merged into one shared reading type. They share a shape and not
 * a meaning: `engineOnly` is a fact about a machine that a person starts, and
 * `daylightOnly` is a fact about the sky.
 *
 * ## Who owns a reading
 *
 * `kind` turns out to sort them by owner, which is the model correction made
 * visible. **Every `instantaneous` reading is an inverter's** — it is a box
 * describing its own terminals, and a silent box has none. The `windowed` and
 * `cumulative` ones are the **system's**, because they are this app's own
 * arithmetic over months that are already closed, or a fact about glass. That is
 * why a silent inverter blanks half a page and not the other half.
 */
export const READING_KINDS = ['instantaneous', 'cumulative', 'windowed'] as const;

export type ReadingKind = (typeof READING_KINDS)[number];

export type InverterReading = {
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
};

/** A reading with a dial's sweep. `min`/`max` are the dial, not the thresholds. */
export type InverterGaugeReading = InverterReading & {min: number; max: number};

/**
 * One string's current, and whether it is delivering.
 *
 * The strings are the one place on an inverter's page where **comparison is the
 * display**: bars on a shared scale make a dead string obvious in a way a column
 * of amperes does not, which is exactly the argument `PhaseGroup` makes for
 * putting three phase currents in one group rather than three readings in a list.
 */
export type StringReading = {
  /** `String 3` — numbered within its inverter, which is how a technician is sent to one. */
  label: string;
  /** Amps. `0` on a string that is out, and `0` on every string after dark. */
  amps: number;
  /** Down, and not because the sun is. */
  down: boolean;
};

/** Only `instantaneous` readings are trends, so only these reach a trace. */
export const plottable = (readings: Array<InverterReading>): Array<InverterReading> =>
  readings.filter((reading) => reading.kind === 'instantaneous');
