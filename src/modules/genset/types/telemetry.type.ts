/**
 * The numbers a genset controller reports, and the shapes the home page draws
 * them in.
 *
 * One `Reading` type covers all of them. A reading is not "a gauge" or "a row" —
 * it is a named quantity, and the page decides how to draw it: the four with a
 * designed sweep become gauges, the three-channel sets become bar groups, and
 * everything else becomes a row under whichever tag references it. Keeping that
 * decision out of the data is what lets an alert point at a reading key without
 * caring where on the page it happens to be rendered.
 */

/**
 * What kind of quantity a reading is — and therefore whether plotting it against
 * time means anything.
 *
 * Only `instantaneous` readings are trends. The other two look like numbers and
 * are not: `engine-hours` is a counter that can only go up, so its "trend" is a
 * ramp that says nothing; `mains-outages (30 d)` is already an aggregate over a
 * window, so plotting it against time draws a window sliding over itself. The
 * analysis tab offers the first kind and nothing else — the distinction has to
 * live on the reading, because the chart cannot infer it from the values.
 */
export const READING_KINDS = ['instantaneous', 'cumulative', 'windowed'] as const;

export type ReadingKind = (typeof READING_KINDS)[number];

export type Reading = {
  /** Stable key. This is what a `GensetAlert` and a `GensetTag` refer to. */
  key: string;
  /** Operator-facing name, e.g. `Starter battery voltage`. */
  label: string;
  value: number;
  /** Rendered after the figure. `''` for dimensionless readings like Power factor. */
  unit: string;
  /**
   * Decimal places to render. Carried on the reading rather than inferred from
   * the value: a rate that happens to land on 24 must still read "24.0 L/hr" or
   * it looks coarser than its neighbours in the same list.
   */
  precision?: number;
  kind: ReadingKind;
  /**
   * The quantity **only exists while the engine turns**.
   *
   * Phase current, alternator frequency and oil pressure are properties of a
   * machine in motion; a stopped set does not have a low one, it has none. Both
   * halves of the app read this: the snapshot zeroes these when the engine is
   * off, and the analysis chart breaks the line rather than drawing it down to
   * zero and back — a dive to 0 bar and a recovery is a *shutdown event*, and
   * inventing one where the set was simply parked would be a lie the reader has
   * no way to catch.
   *
   * Temperatures and levels are deliberately not in this set. A coolant probe on
   * a set that stopped ten minutes ago reads 70 °C, not nothing.
   */
  engineOnly: boolean;
};

/**
 * A reading with a full-scale sweep, so it can be drawn as a tick gauge.
 *
 * `min`/`max` are the *dial's* range, not the alarm thresholds — the design's
 * gauges label their own ends ("0" and "3000") and say nothing about where the
 * safe band is. Thresholds live on the alert.
 */
export type GaugeReading = Reading & {min: number; max: number};

/**
 * A set of readings measured on the same quantity across the three phases —
 * line voltages, or phase currents.
 *
 * Grouped rather than left as three loose readings because the point of the
 * display is the *comparison*: three bars against one shared scale make an
 * imbalance visible at a glance, which three separate rows do not.
 */
export type PhaseGroup = {
  label: string;
  unit: string;
  /** Full-scale value every bar in the group is drawn against. */
  scale: number;
  channels: Array<{
    /** `L1-L2` for a line voltage, `L1` for a phase current. */
    label: string;
    /** Key of the underlying `Reading`, so an alert on a phase can be traced. */
    key: string;
    value: number;
  }>;
};

/**
 * Who is allowed to start the engine.
 *
 * `AUTO` hands the decision to the controller — it starts on a mains failure and
 * stops when mains returns. `MANUAL` takes that away and waits for a person.
 * The two are exclusive, and START/STOP only mean anything in `MANUAL`, which is
 * why the control pad greys them out otherwise.
 */
export const CONTROL_MODES = ['MANUAL', 'AUTO'] as const;

export type ControlMode = (typeof CONTROL_MODES)[number];
