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
