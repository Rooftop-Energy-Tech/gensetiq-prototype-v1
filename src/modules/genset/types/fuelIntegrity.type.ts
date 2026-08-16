/**
 * Fuel that left the tank without passing the injectors.
 *
 * Every other alarm on this machine is a threshold on one number. This one is a
 * **disagreement between two instruments**, and it is the only alarm in the app
 * that cannot exist without both of them:
 *
 * - the **tank level sensor** knows how much diesel is there, and nothing about
 *   where the missing diesel went;
 * - the **fuel flow meter** knows how much the engine burned, and nothing about
 *   what is left.
 *
 * Each on its own is equally consistent with a leak, a siphon and a perfectly
 * healthy set. Subtract one from the other and the question answers itself.
 *
 * Two things follow from that, and they shape this whole file.
 *
 * **It is not a bit in the register map.** `alert.type.ts` is explicit that a
 * `GensetAlert` is a bit the controller raises, and no controller raises this one —
 * a panel watches its own tank and its own injectors and never puts the two
 * together. So this is the app's arithmetic, and it is typed separately from
 * `GensetAlert` so it can never be rendered as though the panel said it. Note also
 * that the map's `AL Fuel Level Wrn` is a *different* alarm: that one fires when the
 * tank is low, and a full tank losing eighty litres a night trips it never.
 *
 * **Its absence is the normal case.** Most sets carry a level sensor and no flow
 * meter, so most of the fleet cannot be checked at all — which is why `unavailable`
 * and `off` are states of their own rather than an absence, and why neither of them
 * is allowed to read as `ok`. "No leak detected" on a machine nobody measured is the
 * one output this module exists to prevent.
 */

/**
 * The tank probe. Accuracy is a fraction of **full scale**, which is how these are
 * specified and why the tolerance it earns is a fixed volume: a ±1% probe on a
 * 2,450 L tank is worth ±24.5 L whether the tank is brimmed or nearly dry.
 */
export type FuelLevelSensor = {
  model: string;
  /** Fraction of tank capacity, e.g. `0.01` for ±1% FS. */
  accuracyOfFullScale: number;
};

/**
 * The flow meter, reading net of the return line.
 *
 * Accuracy is a fraction of **the reading**, not of full scale — so unlike the
 * probe's, the tolerance it earns shrinks towards nothing as the set idles. That
 * asymmetry is the reason the two are separate types rather than one `accuracy`
 * field: they are the same word for two different quantities.
 */
export type FuelFlowMeter = {
  model: string;
  /** Fraction of the metered volume, e.g. `0.005` for ±0.5% of reading. */
  accuracyOfReading: number;
};

/** What a genset is fitted with. All four combinations are representable. */
export type GensetFuelInstruments = {
  levelSensor: FuelLevelSensor | null;
  flowMeter: FuelFlowMeter | null;
};

/**
 * Whether an instrument is there, and whether it is talking.
 *
 * The same three-way distinction `modules/meter` draws for power metering, for the
 * same reason: `not-fitted` needs a purchase order and `no-reading` needs somebody
 * to walk out to a device that is already bolted on. Collapsing them into one
 * "unavailable" would hide which of those two jobs a site actually has.
 */
export type InstrumentFeed = 'reporting' | 'no-reading' | 'not-fitted';

/** Whether the engine was turning while the fuel went missing. */
export type FuelLossSpan = 'RUNNING' | 'STOPPED' | 'BOTH';

/**
 * The detector's own constants.
 *
 * **None of these is a setting**, and the object exists so the page can quote the
 * numbers it is working to without any of them becoming an input. They are facts
 * about how a tank behaves and how often a panel reports — not about what a
 * customer is willing to lose, which is the one thing an operator does decide.
 *
 * Exposing the window or the blanking periods would produce a detector that can be
 * quietly detuned into uselessness by anyone who found the alarm annoying, and a
 * support call nobody could diagnose afterwards.
 */
export const FUEL_INTEGRITY = {
  /**
   * The reconciliation window, in hours of **clock** — not of running.
   *
   * A stopped set meters no fuel, so every litre its tank loses is unaccounted for
   * by definition. That makes a parked machine the most sensitive configuration
   * this detector has, and overnight siphoning the easiest thing it catches. A
   * run-hours window would be symmetric with the service schedule and blind in
   * exactly that case: a standby set running four hours a month would take half a
   * year to fill one window, and would never once look at the seven hundred hours
   * it spent sitting in a yard with a full tank.
   */
  windowHours: 24,
  /**
   * How long after a refuel or an engine transition the tank is left alone.
   *
   * A just-filled tank is foaming, a just-stopped one is still sloshing, and a
   * level probe reports both as volume. The movement is comparable with the
   * thresholds here, so evaluating through it would manufacture discrepancies in
   * whichever direction the fuel happened to be moving.
   */
  blankingMinutes: 30,
  /** Below this much of the window covered by both instruments, nothing is claimed. */
  minimumCoverageHours: 6,
  /** Multiple of the operator's threshold that is critical on its own. */
  criticalMultiple: 3,
  /** Percentage of tank capacity a genset uses until somebody says otherwise. */
  defaultThresholdPercent: 2,
} as const;

/**
 * The arithmetic, kept so the page can show its working.
 *
 * Every field here is displayed. A verdict severe enough to send a person to a site
 * has to be checkable by hand — "95 L unaccounted, 27 L of that is instrument
 * tolerance, your line is at 49 L" is an argument somebody can disagree with, where
 * "Leak detected" is only an assertion.
 */
export type FuelIntegrityFigures = {
  /** Hours of the window actually covered by both instruments. */
  coveredHours: number;
  /** Tank level at the start of the window. */
  openingLitres: number;
  /** What the tank should hold now: opening + refuels − metered burn. */
  expectedLitres: number;
  /** What the level sensor says it holds. */
  measuredLitres: number;
  meteredBurnLitres: number;
  refuelledLitres: number;
  /** `expected − measured`. Positive is fuel gone missing. */
  unaccountedLitres: number;
  /** What the two instruments could be wrong by, combined. */
  toleranceLitres: number;
  /** `unaccounted − tolerance`, floored at zero. The number that trips the alarm. */
  confirmedShortfallLitres: number;
  thresholdPercent: number;
  thresholdLitres: number;
  /** Confirmed shortfall spread over the covered hours. */
  lossRateLitresPerHour: number;
  span: FuelLossSpan;
};

/**
 * Where a genset stands, as one of seven mutually exclusive answers.
 *
 * Flat rather than a severity nested inside a `reconciled` kind, because the
 * distinctions that matter to a reader are not all severities: `off` and
 * `unavailable` are both "nothing is being claimed" and are fixed by completely
 * different acts — one needs a flow meter bought and fitted, the other needs a
 * switch turned back on.
 */
export type FuelIntegrityState =
  | {
      kind: 'unavailable';
      levelSensor: InstrumentFeed;
      flowMeter: InstrumentFeed;
    }
  | {kind: 'off'}
  | {kind: 'suspended'; reason: 'settling' | 'coverage'}
  | {kind: 'ok'; figures: FuelIntegrityFigures}
  | {kind: 'warning'; figures: FuelIntegrityFigures}
  | {kind: 'critical'; figures: FuelIntegrityFigures}
  | {kind: 'surplus'; figures: FuelIntegrityFigures};

/** The kinds that are a raised alarm, in the order they rank. */
export const LEAK_KINDS = ['critical', 'warning'] as const;

export type LeakKind = (typeof LEAK_KINDS)[number];

/** Whether this state is a raised leak alarm, narrowed for the caller. */
export const isLeak = (
  state: FuelIntegrityState,
): state is Extract<FuelIntegrityState, {kind: LeakKind}> =>
  state.kind === 'warning' || state.kind === 'critical';

/** The figures, where there are any. `undefined` for the three states with none. */
export const figuresOf = (state: FuelIntegrityState): FuelIntegrityFigures | undefined =>
  'figures' in state ? state.figures : undefined;

/** Whether both instruments are fitted — the only condition the switch can be on under. */
export const canReconcile = (instruments: GensetFuelInstruments): boolean =>
  instruments.levelSensor !== null && instruments.flowMeter !== null;

/** What `thresholdPercent` works out to in litres on this tank. */
export const thresholdLitres = (thresholdPercent: number, capacityLitres: number): number =>
  Math.round((thresholdPercent / 100) * capacityLitres);

/**
 * The lowest threshold this genset's probe can support, as a percentage.
 *
 * Both quantities are percentages of full scale, so the comparison needs no
 * conversion — which is the incidental benefit of storing the threshold as a
 * percentage. The real one is that a percentage carries across the fleet: `2%` is
 * the same instruction on a 600 L tank and a 3,000 L one, where `45 L` is tight on
 * the first and meaningless on the second.
 *
 * The floor itself is not a nicety. A line drawn finer than the instrument can
 * resolve is not a threshold — it is an alarm that is always on, and an alarm that
 * is always on is one everybody learns to close.
 */
export const thresholdFloorPercent = (instruments: GensetFuelInstruments): number =>
  instruments.levelSensor === null ? 0 : instruments.levelSensor.accuracyOfFullScale * 100;

/** One window's worth of measurement, as the caller observed it. */
export type FuelWindow = {
  /** Hours of the window covered by both instruments. */
  coveredHours: number;
  openingLitres: number;
  measuredLitres: number;
  meteredBurnLitres: number;
  refuelledLitres: number;
  span: FuelLossSpan;
  /** Inside the blanking period after a refuel or an engine transition. */
  settling: boolean;
};

export type ReconcileInput = {
  enabled: boolean;
  instruments: GensetFuelInstruments;
  levelFeed: InstrumentFeed;
  flowFeed: InstrumentFeed;
  capacityLitres: number;
  thresholdPercent: number;
  window: FuelWindow;
  /**
   * The same shortfall stood in the preceding window too.
   *
   * Passed in rather than remembered here, because this function is pure and a
   * detector that held state across calls would give a different answer on a
   * re-render than it gave on first paint.
   */
  sustained: boolean;
};

/**
 * The whole verdict, from one window's measurements.
 *
 * Pure, and deliberately ignorant of where telemetry comes from — the same
 * discipline `serviceStatus` keeps. Everything it needs is in the argument,
 * including the clock-dependent parts, so a page rendering several gensets can
 * measure them all against one instant.
 *
 * The order of the guards is the order of the questions: *can* we check, *should*
 * we check, *is the window usable*, and only then *what does it say*.
 */
export const reconcile = (input: ReconcileInput): FuelIntegrityState => {
  const {enabled, instruments, levelFeed, flowFeed, capacityLitres, window} = input;

  // Can we check at all? Missing or silent instruments come first, because a
  // genset that cannot reconcile also cannot meaningfully have the alarm switched
  // on — reporting it as `off` would blame an operator for a device nobody fitted.
  if (levelFeed !== 'reporting' || flowFeed !== 'reporting') {
    return {kind: 'unavailable', levelSensor: levelFeed, flowMeter: flowFeed};
  }

  // Both fitted and both talking, so a `null` here is unreachable — but the
  // narrowing has to be earned rather than asserted.
  const {levelSensor, flowMeter} = instruments;
  if (levelSensor === null || flowMeter === null) {
    return {kind: 'unavailable', levelSensor: levelFeed, flowMeter: flowFeed};
  }

  if (!enabled) return {kind: 'off'};

  // Settling before coverage: a tank that was filled ten minutes ago has a reason
  // for its short window, and naming the refuel is more use than naming the
  // symptom.
  if (window.settling) return {kind: 'suspended', reason: 'settling'};
  if (window.coveredHours < FUEL_INTEGRITY.minimumCoverageHours) {
    return {kind: 'suspended', reason: 'coverage'};
  }

  const expectedLitres = window.openingLitres + window.refuelledLitres - window.meteredBurnLitres;
  const unaccountedLitres = expectedLitres - window.measuredLitres;

  // Full scale for the probe, reading for the meter — the asymmetry the two device
  // types exist to preserve.
  const toleranceLitres =
    levelSensor.accuracyOfFullScale * capacityLitres +
    flowMeter.accuracyOfReading * window.meteredBurnLitres;

  const confirmedShortfallLitres = Math.max(0, unaccountedLitres - toleranceLitres);
  const litres = thresholdLitres(input.thresholdPercent, capacityLitres);

  const figures: FuelIntegrityFigures = {
    coveredHours: window.coveredHours,
    openingLitres: window.openingLitres,
    expectedLitres,
    measuredLitres: window.measuredLitres,
    meteredBurnLitres: window.meteredBurnLitres,
    refuelledLitres: window.refuelledLitres,
    unaccountedLitres,
    toleranceLitres,
    confirmedShortfallLitres,
    thresholdPercent: input.thresholdPercent,
    thresholdLitres: litres,
    lossRateLitresPerHour:
      window.coveredHours > 0 ? confirmedShortfallLitres / window.coveredHours : 0,
    span: window.span,
  };

  // More fuel than there should be. Two explanations — a delivery nobody recorded,
  // or an instrument reading wrongly — and the data cannot separate them, so this
  // names both and picks neither. It is emphatically not a leak, and treating it as
  // one (a "negative leak") would put a fuel alarm on a genset that gained fuel.
  if (unaccountedLitres < -toleranceLitres) return {kind: 'surplus', figures};

  if (confirmedShortfallLitres <= litres) return {kind: 'ok', figures};

  // Gross, or simply not stopping. A slow weep and a burst line are both worth
  // driving out for, and the second window is what separates "the probe had a bad
  // day" from "this has been going since yesterday".
  const gross = confirmedShortfallLitres > litres * FUEL_INTEGRITY.criticalMultiple;
  return {kind: gross || input.sustained ? 'critical' : 'warning', figures};
};

/**
 * The leak, as something the alerts section can render.
 *
 * Deliberately not a `GensetAlert`. It carries no register and no bit, because
 * there is no sheet to trace it back to, and `source` is what the card prints where
 * an alarm prints its coordinates — the line a reader already uses to tell the
 * panel's voice from the app's.
 */
export type FuelLeakNotice = {
  gensetId: string;
  kind: LeakKind;
  /** The sentence on the card. */
  message: string;
  /** Where it came from, in the reader's language. */
  source: string;
  figures: FuelIntegrityFigures;
};

/** How the loss reads in prose, and why the distinction is worth a clause. */
const SPAN_PROSE: Record<FuelLossSpan, string> = {
  // A meter reading zero is a meter that is right, so a loss here cannot be a
  // metering error — which narrows it to the tank or to somebody with a hose.
  STOPPED: 'with the engine stopped',
  RUNNING: 'while the engine was running',
  BOTH: 'across running and stopped hours',
};

const round = (value: number, places = 0): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * The notice for a raised leak, or `undefined` for every other state.
 *
 * The message states the volume, the window and the rate, and then names whether
 * the engine was turning — because that clause changes who gets called out and
 * what they look for. Fuel gone from a stopped set is a siphon or a holed tank;
 * fuel gone while the engine turns may also be a return-line leak or a meter
 * reading low.
 */
export const fuelLeakNotice = (
  gensetId: string,
  state: FuelIntegrityState,
): FuelLeakNotice | undefined => {
  if (!isLeak(state)) return undefined;

  const {figures} = state;
  const litres = round(figures.confirmedShortfallLitres);
  const rate = round(figures.lossRateLitresPerHour, 1);

  return {
    gensetId,
    kind: state.kind,
    message: `${litres.toLocaleString('en-MY')} L unaccounted for over ${round(
      figures.coveredHours,
    )} hours — ${rate} L/hr ${SPAN_PROSE[figures.span]}`,
    source: 'Fuel reconciliation',
    figures,
  };
};
