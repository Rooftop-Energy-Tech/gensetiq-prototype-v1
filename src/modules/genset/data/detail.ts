import {conditionOf} from '../types/alert.type';
import type {AlertSeverity, GensetAlert, GensetCondition, GensetTag} from '../types/alert.type';
import {gensetName} from '../types/genset.type';
import type {Genset} from '../types/genset.type';
import type {GensetRun} from '../types/run.type';
import type {ControlMode, GaugeReading, PhaseGroup, Reading} from '../types/telemetry.type';
import {GENSETS} from './fleet';

/**
 * Everything the genset home page needs beyond the fleet row, in place of the
 * telemetry API this prototype doesn't have.
 *
 * The whole file is built on one rule: **nothing is stated twice.** Every figure
 * is either a given (the tank level and run state, which come from
 * `fleet.ts`) or derived from a given through a stated relationship. That is why
 * the run's energy, its fuel burn, the consumption rate, the refuel date and the
 * tank runway all move together when you change the load — and why none of them
 * can contradict each other the way a table of hand-picked numbers would.
 *
 * The cost of that rule is that the numbers do NOT match the ones in the Figma
 * frame, whose placeholders contradict each other in three places: 10 kW of load
 * with 24.2 L/hr of fuel (a factor of twenty out), a run stamped 8:09 → 10:24
 * labelled "12 hours", and a green "Optimum" verdict beside a "Critical 2" chip.
 * There is no assignment of values that satisfies all of those at once, so the
 * page derives instead and the README records the departure.
 *
 * Per-unit variation comes from `spread()` — a hash of the genset's id — rather
 * than `Math.random()`, so a unit looks the same on every render and on every
 * reload. `BRF9540`'s load is the one pinned value, chosen so its run lands on
 * the design's "12 hours".
 */

/** Diesel burned per kWh delivered. The one physical constant here. */
const LITRES_PER_KWH = 0.28;

/** Fraction of the tank the refuel runway counts down to, not to zero. */
const RESERVE_FRACTION = 0.3;

/** Gensets are rated in kVA at a 0.8 power factor; kW is what they deliver. */
const POWER_FACTOR = 0.8;

const HOUR = 3_600_000;

/**
 * A stable 0–1 from a string.
 *
 * FNV-1a, because it is four lines and has no dependencies. The point is not
 * distribution quality — it is that `spread('brf9540', 'load')` returns the same
 * number in every render, in every tab, forever, so a genset's page does not
 * reshuffle itself when React re-renders or the user hits back.
 */
const spread = (id: string, salt: string): number => {
  let hash = 0x81_1c_9d_c5;
  for (const char of `${id}:${salt}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
};

/** `1000` out of `Cummins 1000 kVa`. */
const ratingKva = (model: string): number => Number(model.match(/(\d+)\s*kVa/i)?.[1] ?? 500);

// ─── Readings ────────────────────────────────────────────────────────────────

type ReadingSpec = {
  key: string;
  label: string;
  unit: string;
  precision?: number;
  /** Middle of the healthy band. */
  base: number;
  /** How far either side of `base` the per-unit value can land. */
  vary: number;
};

/**
 * The catalogue of readings every unit reports.
 *
 * Values are centred on healthy: a unit with no alerts should read as a machine
 * in good order, so a reader can tell "nothing is wrong here" from the numbers
 * alone and not just from the absence of chips. Readings that an alert fires on
 * get overwritten with a threshold-violating value further down — an alert whose
 * reading still sits in the safe band would make the page argue with itself.
 */
const READING_SPECS: Array<ReadingSpec> = [
  // Engine.
  {key: 'engine-speed', label: 'Engine speed', unit: 'rpm', base: 1_500, vary: 30},
  {key: 'coolant-temp', label: 'Coolant temperature', unit: '°C', base: 84, vary: 8},
  {key: 'coolant-level', label: 'Coolant level', unit: '%', base: 90, vary: 8},
  {key: 'oil-pressure', label: 'Oil pressure', unit: 'bar', precision: 1, base: 4.3, vary: 0.8},
  {key: 'oil-temp', label: 'Oil temperature', unit: '°C', base: 96, vary: 7},
  {key: 'engine-hours', label: 'Engine hours', unit: 'h', base: 5_400, vary: 3_600},
  // Electrical starting.
  {
    key: 'battery-voltage',
    label: 'Starter battery voltage',
    unit: 'V',
    precision: 1,
    base: 26.6,
    vary: 1.4,
  },
  {
    key: 'charge-alt-voltage',
    label: 'Charge alternator voltage',
    unit: 'V',
    precision: 1,
    base: 27.9,
    vary: 0.9,
  },
  // Fuel. `fuel-level` and `fuel-rate` are overwritten from the fleet row and
  // the derived rate — they are listed here for their label and unit only.
  {key: 'fuel-level', label: 'Fuel level', unit: 'L', base: 0, vary: 0},
  {
    key: 'fuel-rate',
    label: 'Fuel consumption rate',
    unit: 'L/hr',
    precision: 1,
    base: 0,
    vary: 0,
  },
  {key: 'fuel-temp', label: 'Fuel temperature', unit: '°C', base: 42, vary: 9},
  // Generator output. `active-power` and the three currents are overwritten too.
  {key: 'active-power', label: 'Active power', unit: 'kW', base: 0, vary: 0},
  {key: 'power-factor', label: 'Power factor', unit: '', precision: 2, base: 0.93, vary: 0.04},
  {key: 'frequency', label: 'Frequency', unit: 'Hz', precision: 1, base: 50, vary: 0.3},
  {key: 'voltage-l1l2', label: 'Line voltage L1-L2', unit: 'V', base: 405, vary: 6},
  {key: 'voltage-l2l3', label: 'Line voltage L2-L3', unit: 'V', base: 405, vary: 6},
  {key: 'voltage-l3l1', label: 'Line voltage L3-L1', unit: 'V', base: 405, vary: 6},
  {key: 'current-l1', label: 'Phase current L1', unit: 'A', base: 0, vary: 0},
  {key: 'current-l2', label: 'Phase current L2', unit: 'A', base: 0, vary: 0},
  {key: 'current-l3', label: 'Phase current L3', unit: 'A', base: 0, vary: 0},
  {key: 'earth-leakage', label: 'Earth leakage current', unit: 'mA', base: 9, vary: 7},
  // Controller and service level.
  {key: 'start-attempts', label: 'Start attempts', unit: '', base: 1, vary: 0},
  {key: 'crank-time', label: 'Crank time', unit: 's', precision: 1, base: 2.6, vary: 1.1},
  {
    key: 'time-to-load',
    label: 'Time to accept load',
    unit: 's',
    precision: 1,
    base: 9.4,
    vary: 3.2,
  },
  {key: 'availability', label: 'Availability', unit: '%', precision: 1, base: 99.4, vary: 0.5},
  {key: 'mains-outages', label: 'Mains outages (30 d)', unit: '', base: 5, vary: 4},
  {key: 'hours-since-service', label: 'Hours since service', unit: 'h', base: 140, vary: 90},
  {key: 'telemetry-age', label: 'Telemetry age', unit: 'min', base: 0, vary: 0},
];

/**
 * The operator's own filing system. Nine tags, each a list of reading keys.
 *
 * Six of the labels are the design's; it repeats "Generator condition" eight
 * times to fill the row, so the other five are named for what an operator
 * actually gets called out for. A reading may appear under more than one tag —
 * oil pressure matters to both Lubrication and Generator condition — which is the
 * point of tags being lists rather than a partition.
 */
const TAGS: Array<GensetTag> = [
  {
    id: 'start-up',
    label: 'Start up',
    readingKeys: ['start-attempts', 'crank-time', 'battery-voltage', 'time-to-load'],
  },
  {
    id: 'generator-output',
    label: 'Generator output',
    readingKeys: ['active-power', 'power-factor', 'frequency', 'voltage-l1l2'],
  },
  {
    id: 'sla-performance',
    label: 'SLA performance',
    readingKeys: ['availability', 'time-to-load', 'mains-outages'],
  },
  {id: 'coolant', label: 'Coolant', readingKeys: ['coolant-temp', 'coolant-level']},
  {
    id: 'generator-condition',
    label: 'Generator condition',
    readingKeys: ['engine-speed', 'oil-pressure', 'oil-temp', 'engine-hours'],
  },
  {
    id: 'fuel-system',
    label: 'Fuel system',
    readingKeys: ['fuel-level', 'fuel-rate', 'fuel-temp'],
  },
  {id: 'lubrication', label: 'Lubrication', readingKeys: ['oil-pressure', 'oil-temp']},
  {id: 'battery', label: 'Battery', readingKeys: ['battery-voltage', 'charge-alt-voltage']},
  {
    id: 'load-balance',
    label: 'Load balance',
    readingKeys: ['current-l1', 'current-l2', 'current-l3', 'earth-leakage'],
  },
  {
    id: 'connectivity',
    label: 'Connectivity',
    readingKeys: ['telemetry-age', 'hours-since-service'],
  },
];

// ─── Alert rules ─────────────────────────────────────────────────────────────

type AlertRule = {
  id: string;
  name: string;
  severity: AlertSeverity;
  readingKey: string;
  threshold: string;
  /** The value the reading is forced to when this rule is active. */
  violation: number;
  /** How long ago the threshold was crossed, in hours. */
  agoHours: number;
  /**
   * The rule watches a reading that only exists while the engine turns.
   *
   * A cleanly stopped set cannot be carrying one: oil pressure and phase current
   * are zero, and "low oil pressure — 0.0 bar" on an idle genset is not an alarm,
   * it is a category error. A *faulted* set can, because the fault is why it
   * stopped and the tripping value is latched.
   */
  requiresEngine?: true;
};

/**
 * The threshold rules a unit can be carrying.
 *
 * Two critical, five warning, three neutral — which is exactly the design's
 * `Critical 2 / Warning 5 / Neutral 3`, and `BRF9540` carries all ten so its
 * chips read as designed. `Undervoltage` on the starter battery is the design's
 * own worked example; the rest are the alarms a diesel controller genuinely
 * raises.
 *
 * `violation` exists so the number under the alert supports it. The design shows
 * "Starter battery voltage — 1 V" beside an undervoltage warning; 1 V is not a
 * reading a 24 V system can produce, so this uses 21.8 V, which is what a bank
 * that has failed to hold charge actually looks like.
 */
const ALERT_RULES: Array<AlertRule> = [
  {
    id: 'high-coolant-temp',
    name: 'High coolant temperature',
    severity: 'CRITICAL',
    readingKey: 'coolant-temp',
    threshold: '> 98 °C',
    violation: 103,
    agoHours: 0.4,
    requiresEngine: true,
  },
  {
    id: 'earth-leakage',
    name: 'Earth leakage',
    severity: 'CRITICAL',
    readingKey: 'earth-leakage',
    threshold: '> 30 mA',
    violation: 47,
    agoHours: 1.6,
    requiresEngine: true,
  },
  {
    id: 'undervoltage',
    name: 'Undervoltage',
    severity: 'WARNING',
    readingKey: 'battery-voltage',
    threshold: '< 24 V',
    violation: 21.8,
    agoHours: 3.2,
  },
  {
    id: 'low-oil-pressure',
    name: 'Low oil pressure',
    severity: 'WARNING',
    readingKey: 'oil-pressure',
    threshold: '< 2.5 bar',
    violation: 2.1,
    agoHours: 0.8,
    requiresEngine: true,
  },
  {
    id: 'charge-failure',
    name: 'Charge alternator failure',
    severity: 'WARNING',
    readingKey: 'charge-alt-voltage',
    threshold: '< 26 V',
    violation: 24.3,
    agoHours: 6.5,
    requiresEngine: true,
  },
  {
    id: 'slow-to-load',
    name: 'Slow to accept load',
    severity: 'WARNING',
    readingKey: 'time-to-load',
    threshold: '> 15 s',
    violation: 21.4,
    agoHours: 11,
  },
  {
    id: 'phase-imbalance',
    name: 'Phase imbalance',
    severity: 'WARNING',
    readingKey: 'current-l3',
    threshold: '> 10% deviation',
    violation: 0,
    agoHours: 2.1,
    requiresEngine: true,
  },
  {
    id: 'service-due',
    name: 'Service due',
    severity: 'NEUTRAL',
    readingKey: 'hours-since-service',
    threshold: '> 250 h',
    violation: 268,
    agoHours: 26,
  },
  {
    id: 'fuel-temp-high',
    name: 'Fuel temperature high',
    severity: 'NEUTRAL',
    readingKey: 'fuel-temp',
    threshold: '> 60 °C',
    violation: 63,
    agoHours: 4.4,
  },
  {
    id: 'repeat-cranking',
    name: 'Repeat cranking',
    severity: 'NEUTRAL',
    readingKey: 'start-attempts',
    threshold: '> 1 attempt',
    violation: 3,
    agoHours: 9,
  },
];

/** A unit that has dropped off the network carries this one instead of the pool. */
const COMMS_RULE: AlertRule = {
  id: 'comms-loss',
  name: 'Communications loss',
  severity: 'CRITICAL',
  readingKey: 'telemetry-age',
  threshold: '> 60 min',
  violation: 0,
  agoHours: 0,
};

// ─── The assembled detail ────────────────────────────────────────────────────

export type GensetFuelDetail = {
  maxLitres: number;
  litresPerHour: number;
  /** Fraction of the tank treated as reserve. */
  reserveFraction: number;
  /** Hours of running left before the tank reaches reserve. */
  hoursToReserve: number;
  /** ISO 8601 — when it gets there at the current rate. */
  refuelBy: string;
};

export type GensetDetail = {
  gensetId: string;
  /**
   * Controller reachable. Not the same question as run state — an idle genset
   * sitting on standby is online and reporting; a running one whose modem has
   * dropped is not.
   */
  online: boolean;
  controlMode: ControlMode;
  /** Instantaneous electrical load, or `null` when the engine is not turning. */
  loadKw: number | null;
  /** kW nameplate — the top of the active-power gauge. */
  ratedKw: number;
  /** The open run while running, otherwise the last closed one. */
  run: GensetRun;
  fuel: GensetFuelDetail;
  /** The four readings with a designed dial. Empty when the engine is stopped. */
  gauges: Array<GaugeReading>;
  /** Line voltages and phase currents. Empty when the engine is stopped. */
  phases: Array<PhaseGroup>;
  readings: Record<string, Reading>;
  alerts: Array<GensetAlert>;
  tags: Array<GensetTag>;
  condition: GensetCondition;
};

/**
 * Which rules a unit is carrying.
 *
 * Offline units get the comms alarm and nothing else — a controller that isn't
 * reporting cannot also be telling you its oil pressure. A faulted unit always
 * carries at least one critical, so the run-state badge and the alerts section
 * agree about whether something is wrong. `BRF9540` carries the full pool, to
 * reproduce the design's chip counts.
 */
const rulesFor = (genset: Genset, online: boolean): Array<AlertRule> => {
  if (!online) return [COMMS_RULE];
  if (genset.id === 'brf9540') return ALERT_RULES;

  const draw = spread(genset.id, 'alerts');
  const wanted =
    genset.runState === 'FAULT' ? 2 + Math.floor(draw * 3) : Math.floor(draw * 4);
  if (wanted === 0) return [];

  // A cleanly stopped set can only be carrying rules that survive the engine
  // being off. A faulted one keeps them all: the fault is *why* it stopped, and
  // the tripping value is latched by the controller.
  const eligible =
    genset.runState === 'IDLE'
      ? ALERT_RULES.filter((rule) => rule.requiresEngine !== true)
      : ALERT_RULES;

  // Faulted units are dealt from the front of the pool, which is severity-
  // ordered, so they always pick up a critical first. Everyone else gets a
  // per-unit shuffle, so two idle sets don't carry the same two warnings.
  const pool =
    genset.runState === 'FAULT'
      ? eligible
      : [...eligible].sort(
          (left, right) => spread(genset.id, left.id) - spread(genset.id, right.id),
        );

  return pool.slice(0, wanted);
};

const buildDetail = (genset: Genset, now: number): GensetDetail => {
  const running = genset.runState === 'RUNNING';
  const online = genset.runState !== 'OFFLINE';
  const kva = ratingKva(genset.model);
  const ratedKw = Math.round(kva * POWER_FACTOR);

  // Load, and everything that follows from it. `BRF9540` is pinned to 205 kW
  // because that is the load whose fuel rate puts its run at the design's
  // "12 hours"; every other unit takes a stable 22–55% of nameplate.
  const loadFraction = 0.22 + spread(genset.id, 'load') * 0.33;
  const loadKw = genset.id === 'brf9540' ? 205 : Math.round(ratedKw * loadFraction);
  const litresPerHour = Math.round(LITRES_PER_KWH * loadKw * 10) / 10;

  // Run length: how long the engine has been turning (open run) or was turning
  // (closed run). 3–36 hours, which is the range a standby set actually sees.
  const runHours = genset.id === 'brf9540' ? 12 : 3 + Math.round(spread(genset.id, 'runHours') * 33);
  const lastUpdatedMs = new Date(genset.lastUpdated).getTime();
  // A closed run ended when the engine stopped, which is the event the fleet's
  // newest activity entry records — so anchor it to `lastUpdated` rather than to
  // `now`, or a unit idle for two days would show a run that ended this minute.
  const endedMs = running ? null : lastUpdatedMs;
  const startedMs = (endedMs ?? now) - runHours * HOUR;

  const run: GensetRun = {
    id: `${genset.id}-run-current`,
    gensetId: genset.id,
    startedAt: new Date(startedMs).toISOString(),
    endedAt: endedMs === null ? null : new Date(endedMs).toISOString(),
    // Metered across the run, so both follow from the load and the hours. Note
    // these are the run's *totals*, not a reconciliation of the tank level: a
    // genset meters fuel at the injector and level at the tank, and the two are
    // separate instruments.
    energyProducedKwh: Math.round(loadKw * runHours),
    fuelConsumedLitres: Math.round(litresPerHour * runHours),
  };

  // Refuel runway: litres above the reserve line, divided by the burn rate.
  // This is the relationship the design's badge encodes — its "39 hours to 30%"
  // is exactly (1623 − 0.3 × 2300) / 24.2 — and it is the reason the badge and
  // the "Refuel by" date can never disagree.
  const aboveReserve = Math.max(0, genset.fuelLitres - RESERVE_FRACTION * genset.fuelCapacityLitres);
  const hoursToReserve = litresPerHour > 0 ? Math.floor(aboveReserve / litresPerHour) : 0;

  const fuel: GensetFuelDetail = {
    maxLitres: genset.fuelCapacityLitres,
    litresPerHour,
    reserveFraction: RESERVE_FRACTION,
    hoursToReserve,
    refuelBy: new Date(now + hoursToReserve * HOUR).toISOString(),
  };

  // Readings. Start from the catalogue's healthy band, overwrite the derived
  // ones, then let active alerts overwrite their own.
  const readings: Record<string, Reading> = {};
  for (const spec of READING_SPECS) {
    readings[spec.key] = {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      precision: spec.precision,
      value:
        Math.round(
          (spec.base + (spread(genset.id, spec.key) - 0.5) * 2 * spec.vary) *
            10 ** (spec.precision ?? 0),
        ) / 10 ** (spec.precision ?? 0),
    };
  }

  // Phase current from the load: I = P / (√3 · V · pf).
  //
  // Computed whatever the run state, and zeroed only where it is *reported* below.
  // The stopped case still needs the figure: a latched phase-imbalance alarm on a
  // faulted set has to quote the current at trip, and quoting 0 A would make the
  // alarm read as nonsense.
  const lineVoltage = readings['voltage-l1l2'].value;
  const powerFactor = readings['power-factor'].value;
  const phaseCurrent =
    lineVoltage > 0 ? (loadKw * 1_000) / (Math.sqrt(3) * lineVoltage * powerFactor) : 0;

  readings['fuel-level'] = {...readings['fuel-level'], value: genset.fuelLitres};
  readings['fuel-rate'] = {...readings['fuel-rate'], value: running ? litresPerHour : 0};
  readings['active-power'] = {...readings['active-power'], value: running ? loadKw : 0};
  readings['telemetry-age'] = {
    ...readings['telemetry-age'],
    value: Math.round((now - lastUpdatedMs) / 60_000),
  };
  for (const key of ['current-l1', 'current-l2', 'current-l3'] as const) {
    // A healthy set is balanced to within a couple of percent. The per-phase
    // skew is small on purpose — it is what makes the three bars readable as a
    // comparison rather than three copies of one number.
    const skew = 1 + (spread(genset.id, key) - 0.5) * 0.05;
    readings[key] = {...readings[key], value: running ? Math.round(phaseCurrent * skew) : 0};
  }
  // An engine that is not turning reports no speed and no output.
  if (!running) {
    for (const key of ['engine-speed', 'active-power', 'oil-pressure'] as const) {
      readings[key] = {...readings[key], value: 0};
    }
  }

  const rules = rulesFor(genset, online);
  const alerts: Array<GensetAlert> = rules.map((rule) => {
    // `phase-imbalance` and `comms-loss` are relative rules — their violating
    // value depends on the unit, so they take it from the reading itself rather
    // than from a literal in the pool.
    const violation =
      rule.id === 'phase-imbalance'
        ? Math.round(phaseCurrent * 1.14)
        : rule.id === 'comms-loss'
          ? readings['telemetry-age'].value
          : rule.violation;

    readings[rule.readingKey] = {...readings[rule.readingKey], value: violation};

    return {
      id: `${genset.id}-${rule.id}`,
      name: rule.name,
      severity: rule.severity,
      readingKey: rule.readingKey,
      threshold: rule.threshold,
      raisedAt: new Date(now - rule.agoHours * HOUR).toISOString(),
    };
  });

  const gauge = (key: string, min: number, max: number): GaugeReading => ({
    ...readings[key],
    min,
    max,
  });

  return {
    gensetId: genset.id,
    online,
    // A standby set lives in AUTO; a crew that has taken manual control is the
    // exception, so only a minority of the fleet is in MANUAL.
    controlMode: spread(genset.id, 'mode') > 0.75 ? 'MANUAL' : 'AUTO',
    loadKw: running ? loadKw : null,
    ratedKw,
    run,
    fuel,
    // Dials only while the engine turns. A row of gauges pinned at zero says
    // less than one line of text saying the engine is stopped, and it invites
    // the reader to wonder whether the page is broken.
    gauges: running
      ? [
          gauge('engine-speed', 0, 3_000),
          gauge('active-power', 0, ratedKw),
          gauge('oil-pressure', 0, 8),
          gauge('coolant-temp', 0, 120),
        ]
      : [],
    phases: running
      ? [
          {
            label: 'Line voltage',
            unit: 'V',
            // Nominal 415 V plus headroom, so a phase sitting where it should
            // does not peg the bar at full.
            scale: 520,
            channels: [
              {label: 'L1-L2', key: 'voltage-l1l2', value: readings['voltage-l1l2'].value},
              {label: 'L2-L3', key: 'voltage-l2l3', value: readings['voltage-l2l3'].value},
              {label: 'L3-L1', key: 'voltage-l3l1', value: readings['voltage-l3l1'].value},
            ],
          },
          {
            label: 'Phase current',
            unit: 'A',
            // Nameplate current: the set's kVA at its rated line voltage.
            scale: Math.round((kva * 1_000) / (Math.sqrt(3) * 415)),
            channels: [
              {label: 'L1', key: 'current-l1', value: readings['current-l1'].value},
              {label: 'L2', key: 'current-l2', value: readings['current-l2'].value},
              {label: 'L3', key: 'current-l3', value: readings['current-l3'].value},
            ],
          },
        ]
      : [],
    readings,
    alerts,
    tags: TAGS,
    condition: conditionOf(alerts),
  };
};

/**
 * Detail for every unit, built once at module load.
 *
 * Eager rather than lazy for the same reason `fleet.ts` resolves its timestamps
 * at load: one `now` for the whole fleet. Building on first access would give a
 * unit opened ten minutes into the session a "telemetry age" measured from a
 * different clock reading than its neighbour's, and the two would disagree.
 */
const DETAILS: Record<string, GensetDetail> = (() => {
  const now = Date.now();
  return Object.fromEntries(
    GENSETS.map((genset) => [genset.id, buildDetail(genset, now)]),
  );
})();

export const gensetDetail = (gensetId: string): GensetDetail | undefined => DETAILS[gensetId];

/** The fleet row for an id — the home page needs both halves. */
export const gensetById = (gensetId: string): Genset | undefined =>
  GENSETS.find((genset) => genset.id === gensetId);

/** `BRF9540 | Cummins 1000 kVa`, for the breadcrumb and the document title. */
export const gensetLabel = (gensetId: string): string => {
  const genset = gensetById(gensetId);
  return genset === undefined ? 'Genset' : gensetName(genset);
};
