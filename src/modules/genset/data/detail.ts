import {amount} from '@/lib/format';
import {ALERT_SEVERITIES, SEVERITY_OF_ALARM_TYPE, conditionOf} from '../types/alert.type';
import type {
  AlarmType,
  AlertComparator,
  GensetAlert,
  GensetCondition,
  GensetTag,
} from '../types/alert.type';
import {gensetName} from '../types/genset.type';
import type {Genset} from '../types/genset.type';
import type {GensetRun} from '../types/run.type';
import type {
  ControlMode,
  GaugeReading,
  PhaseGroup,
  Reading,
  ReadingKind,
} from '../types/telemetry.type';
import {fleet} from './deployment';
import {GENSETS} from './fleet';
import {seededHoursSinceService} from './serviceSeed';
import {spread} from './spread';

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

/**
 * Diesel burned per kWh delivered. The one physical constant here.
 *
 * Exported because `history.ts` costs every run in the log with it. A second
 * constant over there would let a run's fuel figure disagree with the same run's
 * figure on the home page.
 */
export const LITRES_PER_KWH = 0.28;

/** Fraction of the tank the refuel runway counts down to, not to zero. */
const RESERVE_FRACTION = 0.3;

/** Gensets are rated in kVA at a 0.8 power factor; kW is what they deliver. */
const POWER_FACTOR = 0.8;

const HOUR = 3_600_000;

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
  /**
   * How far either side of `base` the per-unit value can land — and, in
   * `history.ts`, how far it wanders between one minute and the next. The two
   * are the same quantity: the spread across a fleet of identical machines and
   * the spread across one machine's afternoon are both "how much this number
   * moves without anything being wrong".
   */
  vary: number;
  /** Defaults to `instantaneous` — the common case, and the only plottable one. */
  kind?: ReadingKind;
  /** See `Reading.engineOnly`. */
  engineOnly?: true;
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
  {key: 'engine-speed', label: 'Engine speed', unit: 'rpm', base: 1_500, vary: 30, engineOnly: true},
  {key: 'coolant-temp', label: 'Coolant temperature', unit: '°C', base: 84, vary: 8},
  {key: 'coolant-level', label: 'Coolant level', unit: '%', base: 90, vary: 8},
  {
    key: 'oil-pressure',
    label: 'Oil pressure',
    unit: 'bar',
    precision: 1,
    base: 4.3,
    vary: 0.8,
    engineOnly: true,
  },
  {key: 'oil-temp', label: 'Oil temperature', unit: '°C', base: 96, vary: 7},
  {
    key: 'engine-hours',
    label: 'Engine hours',
    unit: 'h',
    base: 5_400,
    vary: 3_600,
    kind: 'cumulative',
  },
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
    engineOnly: true,
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
    engineOnly: true,
  },
  {key: 'fuel-temp', label: 'Fuel temperature', unit: '°C', base: 42, vary: 9},
  // Generator output. `active-power` and the three currents are overwritten too.
  {key: 'active-power', label: 'Active power', unit: 'kW', base: 0, vary: 0, engineOnly: true},
  {
    key: 'power-factor',
    label: 'Power factor',
    unit: '',
    precision: 2,
    base: 0.93,
    vary: 0.04,
    engineOnly: true,
  },
  {
    key: 'frequency',
    label: 'Frequency',
    unit: 'Hz',
    precision: 1,
    base: 50,
    vary: 0.3,
    engineOnly: true,
  },
  {
    key: 'voltage-l1l2',
    label: 'Line voltage L1-L2',
    unit: 'V',
    base: 405,
    vary: 6,
    engineOnly: true,
  },
  {
    key: 'voltage-l2l3',
    label: 'Line voltage L2-L3',
    unit: 'V',
    base: 405,
    vary: 6,
    engineOnly: true,
  },
  {
    key: 'voltage-l3l1',
    label: 'Line voltage L3-L1',
    unit: 'V',
    base: 405,
    vary: 6,
    engineOnly: true,
  },
  {key: 'current-l1', label: 'Phase current L1', unit: 'A', base: 0, vary: 0, engineOnly: true},
  {key: 'current-l2', label: 'Phase current L2', unit: 'A', base: 0, vary: 0, engineOnly: true},
  {key: 'current-l3', label: 'Phase current L3', unit: 'A', base: 0, vary: 0, engineOnly: true},
  {
    key: 'earth-leakage',
    label: 'Earth leakage current',
    unit: 'mA',
    base: 9,
    vary: 7,
    engineOnly: true,
  },
  // Controller and service level. These are the readings that are *not* trends:
  // three of them are measured once per start rather than continuously, two are
  // already an aggregate over a window, and two only ever climb.
  {key: 'start-attempts', label: 'Start attempts', unit: '', base: 1, vary: 0, kind: 'windowed'},
  {
    key: 'crank-time',
    label: 'Crank time',
    unit: 's',
    precision: 1,
    base: 2.6,
    vary: 1.1,
    kind: 'windowed',
  },
  {
    key: 'time-to-load',
    label: 'Time to accept load',
    unit: 's',
    precision: 1,
    base: 9.4,
    vary: 3.2,
    kind: 'windowed',
  },
  {
    key: 'availability',
    label: 'Availability',
    unit: '%',
    precision: 1,
    base: 99.4,
    vary: 0.5,
    kind: 'windowed',
  },
  {key: 'mains-outages', label: 'Mains outages (30 d)', unit: '', base: 5, vary: 4, kind: 'windowed'},
  {
    key: 'hours-since-service',
    label: 'Hours since service',
    unit: 'h',
    base: 140,
    vary: 90,
    kind: 'cumulative',
  },
  // Age of the newest message, measured against `now` — a stopwatch, not a
  // stored quantity, so there is nothing to plot.
  {key: 'telemetry-age', label: 'Telemetry age', unit: 'min', base: 0, vary: 0, kind: 'cumulative'},
];

/**
 * How far each reading wanders on its own, by key.
 *
 * `history.ts` needs the catalogue's `vary` to size the wobble it draws between
 * samples, and exporting this map is cheaper than exporting the specs and
 * inviting a second consumer to reinterpret `base`.
 */
export const READING_SWING: Record<string, number> = Object.fromEntries(
  READING_SPECS.map((spec) => [spec.key, spec.vary]),
);

/** The readings the analysis tab will offer, in catalogue order. */
export const PLOTTABLE_READING_KEYS: Array<string> = READING_SPECS.filter(
  (spec) => (spec.kind ?? 'instantaneous') === 'instantaneous',
).map((spec) => spec.key);

/**
 * The operator's own filing system. Ten tags, each mostly a list of reading keys.
 *
 * These are **grouped around the alarm map**, which is the change from the first
 * version. That one was drawn against an invented alarm pool and grouped badly
 * against the real one: `Generator output` ended up holding ten of the alarms while
 * `SLA performance` and `Fuel system` held none, so half the chip row could not
 * answer the question a chip is for.
 *
 * Every alarm now reaches exactly one tag, and the counts are even enough that
 * picking a chip narrows something. A reading may still appear under more than one
 * tag — oil pressure matters to Lubrication and to anyone watching the engine —
 * which is the point of tags being lists rather than a partition.
 *
 * Two tags carry no alarms at all, and they stay. A tag answers "how is this
 * subsystem doing", and `Fuel` showing three healthy readings and nothing wrong is
 * a complete answer to that. (It is also a question worth asking of the map: the
 * controller *has* `AL Fuel Level Wrn` and `AL Fuel Level Sd`, and neither is
 * marked for the dashboard.)
 */
const TAGS: Array<GensetTag> = [
  {
    // Together on purpose. On a four-pole set at 50 Hz, 1500 rpm *is* 50 Hz —
    // underspeed and underfrequency are one event read by two instruments, and
    // filing them apart sends somebody chasing two faults.
    id: 'speed-frequency',
    label: 'Speed & frequency',
    readingKeys: ['engine-speed', 'frequency'],
  },
  {
    id: 'generator-voltage',
    label: 'Generator voltage',
    readingKeys: ['voltage-l1l2', 'voltage-l2l3', 'voltage-l3l1', 'power-factor'],
  },
  {
    id: 'load-current',
    label: 'Load & current',
    readingKeys: ['active-power', 'current-l1', 'current-l2', 'current-l3', 'earth-leakage'],
  },
  {id: 'coolant', label: 'Coolant', readingKeys: ['coolant-temp', 'coolant-level']},
  {
    id: 'battery',
    label: 'Battery & charging',
    readingKeys: ['battery-voltage', 'charge-alt-voltage'],
  },
  {id: 'lubrication', label: 'Lubrication', readingKeys: ['oil-pressure', 'oil-temp']},
  {
    id: 'starting',
    label: 'Starting',
    readingKeys: ['start-attempts', 'crank-time', 'time-to-load', 'battery-voltage'],
  },
  {id: 'fuel', label: 'Fuel', readingKeys: ['fuel-level', 'fuel-rate', 'fuel-temp']},
  {
    // `DPF status` is filed here rather than under an emissions tag of its own: a
    // regeneration coming due is a maintenance action, which is what this tag is
    // about, and one alarm does not earn a chip that would otherwise be empty.
    id: 'service',
    label: 'Service',
    readingKeys: ['engine-hours', 'hours-since-service', 'availability', 'mains-outages'],
    alarmIds: ['dpf-status'],
  },
  {
    id: 'panel',
    label: 'Panel & comms',
    readingKeys: ['telemetry-age'],
    alarmIds: ['sd-override'],
  },
];

// ─── Alert rules ─────────────────────────────────────────────────────────────

type AlertRule = {
  id: string;
  /** The bit's coordinates in the register map — see `GensetAlert.register`. */
  register: number;
  bit: number;
  /** Verbatim from the map's *To Include in Dashboard* column. */
  name: string;
  type: AlarmType;
  /** `null` for a bit with no single reading behind it. */
  readingKey: string | null;
  comparator: AlertComparator;
  /** The line, on the reading's own scale. `null` for a rule with no fixed one. */
  limit: number | null;
  /**
   * The limit and the tripping value as fractions of the reading's nameplate,
   * for the three rules whose line moves with the machine.
   *
   * `AL Overload Wrn` is "at rated output", which is 800 kW on a 1000 kVa set and
   * 160 kW on a 200 kVa one. Writing 800 here would turn a rule about overload
   * into a fact about one model, and every other unit's card would then quote a
   * limit its alternator never had.
   */
  ofNameplate?: {limit: number; violation: number};
  /**
   * Prose for the rules whose limit is not a height on the reading's axis — the
   * `AL Common *` roll-ups, which are conditions over other protections, and the
   * two `Info` bits, which say "outside limits" without naming a side. Everything
   * else derives its label from `comparator` and `limit`, so the chart's dashed
   * line and the card's caption are the same fact rendered twice rather than two
   * facts typed twice.
   */
  thresholdLabel?: string;
  /**
   * The value the reading is forced to when this rule is active, or `null` to
   * leave the reading alone.
   *
   * `null` is for the `Info` bits: `AL Gen Voltage` means the voltage is off
   * nominal, which whatever value the unit already reports is free to be. It
   * asserts nothing about the number, so it must not overwrite it.
   */
  violation: number | null;
  /** How long ago the threshold was crossed, in hours. */
  agoHours: number;
  /**
   * The rule watches a reading that only exists while the engine turns.
   *
   * A cleanly stopped set cannot be carrying one: oil pressure and phase current
   * are zero, and "AL Oil Press Sd — 0.0 bar" on an idle genset is not an alarm,
   * it is a category error. A *faulted* set can, because the fault is why it
   * stopped and the tripping value is latched.
   */
  requiresEngine?: true;
};

/**
 * The alarms a unit can be carrying: the register map's alarm bits marked
 * **To Include in Dashboard**, in register order, and nothing else.
 *
 * This list is a transcription, not a design. Every entry's `name` is the map's
 * own text and every `type` is its Type column, so the page can be checked
 * against the sheet row by row. Earlier revisions of this file invented a
 * plausible-sounding pool ("Slow to accept load", "Repeat cranking"); those are
 * gone, because an alarm the panel cannot raise is one the dashboard must not
 * show, however sensible it reads.
 *
 * What the map does *not* give is where each threshold sits — it names the bit,
 * not the setpoint, which is a per-site commissioning value. The limits below are
 * therefore the only invented figures left, set at the conventional points for a
 * 415 V / 50 Hz / 1500 rpm set, and they are what the cards and the analysis
 * chart quote. Real setpoints come from the panel when there is one to read.
 *
 * `violation` exists so the number under an alarm supports it: a card reading
 * "AL Battery Voltage · < 24 V" over "Starter battery voltage — 26.6 V" would be
 * arguing with itself, so an active rule forces its reading to a value that
 * actually trips it.
 *
 * Four entries in that column carry no Type — `AVR Up`, `AVR Down`, `Speed Up`,
 * `Speed Down`. They are the controller's trim outputs, not alarms; a dashboard
 * shows them as state, and putting them in an alarm list would mean a set raising
 * "AVR Up" every time the regulator nudged the field.
 */
const ALERT_RULES: Array<AlertRule> = [
  // ── Register 1299 · Log Bout 4 ──
  {
    id: 'gen-overvoltage',
    register: 1299,
    bit: 0,
    name: 'AL Gen Overvoltage',
    type: 'Alarm',
    readingKey: 'voltage-l1l2',
    comparator: '>',
    limit: 456,
    violation: 468,
    agoHours: 0.6,
    requiresEngine: true,
  },
  {
    id: 'gen-undervoltage',
    register: 1299,
    bit: 1,
    name: 'AL Gen Undervoltage',
    type: 'Alarm',
    readingKey: 'voltage-l1l2',
    comparator: '<',
    limit: 373,
    violation: 358,
    agoHours: 1.1,
    requiresEngine: true,
  },
  {
    id: 'gen-voltage-wrn',
    register: 1299,
    bit: 2,
    name: 'AL Gen Voltage Wrn',
    type: 'Warning',
    readingKey: 'voltage-l1l2',
    comparator: '>',
    limit: 436,
    violation: 441,
    agoHours: 2.4,
    requiresEngine: true,
  },
  {
    id: 'gen-voltage',
    register: 1299,
    bit: 3,
    name: 'AL Gen Voltage',
    type: 'Info',
    readingKey: 'voltage-l1l2',
    comparator: '>',
    limit: null,
    thresholdLabel: 'Voltage outside limits',
    violation: null,
    agoHours: 2.4,
    requiresEngine: true,
  },
  {
    id: 'gen-overfrequency',
    register: 1299,
    bit: 4,
    name: 'AL Gen Overfrequency',
    type: 'Alarm',
    readingKey: 'frequency',
    comparator: '>',
    limit: 52,
    violation: 52.6,
    agoHours: 0.3,
    requiresEngine: true,
  },
  {
    id: 'gen-underfrequency',
    register: 1299,
    bit: 5,
    name: 'AL Gen Underfrequency',
    type: 'Alarm',
    readingKey: 'frequency',
    comparator: '<',
    limit: 48,
    violation: 47.2,
    agoHours: 0.5,
    requiresEngine: true,
  },
  {
    id: 'gen-freq-wrn',
    register: 1299,
    bit: 6,
    name: 'AL Gen Freq Wrn',
    type: 'Warning',
    readingKey: 'frequency',
    comparator: '>',
    limit: 51,
    violation: 51.3,
    agoHours: 1.8,
    requiresEngine: true,
  },
  {
    id: 'gen-frequency',
    register: 1299,
    bit: 7,
    name: 'AL Gen Frequency',
    type: 'Info',
    readingKey: 'frequency',
    comparator: '>',
    limit: null,
    thresholdLabel: 'Frequency outside limits',
    violation: null,
    agoHours: 1.8,
    requiresEngine: true,
  },
  {
    id: 'overload-boc',
    register: 1299,
    bit: 11,
    name: 'AL Overload BOC',
    type: 'Alarm',
    readingKey: 'active-power',
    comparator: '>',
    limit: null,
    ofNameplate: {limit: 1.1, violation: 1.16},
    violation: null,
    agoHours: 0.2,
    requiresEngine: true,
  },
  {
    id: 'overload-wrn',
    register: 1299,
    bit: 12,
    name: 'AL Overload Wrn',
    type: 'Warning',
    readingKey: 'active-power',
    comparator: '>',
    limit: null,
    ofNameplate: {limit: 1, violation: 1.04},
    violation: null,
    agoHours: 1.4,
    requiresEngine: true,
  },
  {
    id: 'stop-fail',
    register: 1299,
    bit: 13,
    name: 'AL Stop Fail',
    type: 'Alarm',
    // The reading *is* the alarm: a stop command was issued and the crank is
    // still turning. Which is also why it forces a running speed rather than
    // leaving the zero a stopped set would otherwise report.
    readingKey: 'engine-speed',
    comparator: '>',
    limit: null,
    thresholdLabel: 'Turning after stop command',
    violation: 1_480,
    agoHours: 0.1,
    requiresEngine: true,
  },
  {
    id: 'overspeed',
    register: 1299,
    bit: 14,
    name: 'AL Overspeed',
    type: 'Alarm',
    readingKey: 'engine-speed',
    comparator: '>',
    limit: 1_710,
    violation: 1_782,
    agoHours: 0.4,
    requiresEngine: true,
  },
  {
    id: 'underspeed',
    register: 1299,
    bit: 15,
    name: 'AL Underspeed',
    type: 'Alarm',
    readingKey: 'engine-speed',
    comparator: '<',
    limit: 1_350,
    violation: 1_284,
    agoHours: 0.7,
    requiresEngine: true,
  },
  // ── Register 1300 · Log Bout 5 ──
  {
    id: 'start-fail',
    register: 1300,
    bit: 0,
    name: 'AL Start Fail',
    type: 'Alarm',
    readingKey: 'start-attempts',
    comparator: '>',
    limit: 3,
    thresholdLabel: '> 3 attempts',
    violation: 4,
    agoHours: 3.5,
  },
  {
    id: 'overcurrent',
    register: 1300,
    bit: 1,
    name: 'AL Overcurrent',
    type: 'Alarm',
    readingKey: 'current-l1',
    comparator: '>',
    limit: null,
    ofNameplate: {limit: 1.05, violation: 1.14},
    violation: null,
    agoHours: 0.9,
    requiresEngine: true,
  },
  {
    id: 'battery-flat',
    register: 1300,
    bit: 2,
    name: 'AL Battery Flat',
    type: 'Alarm',
    readingKey: 'battery-voltage',
    comparator: '<',
    limit: 18,
    violation: 16.4,
    agoHours: 5.2,
  },
  {
    id: 'battery-charger',
    register: 1300,
    bit: 3,
    name: 'AL Battery Charger',
    type: 'Alarm',
    readingKey: 'charge-alt-voltage',
    comparator: '<',
    limit: 26,
    violation: 24.3,
    agoHours: 6.5,
    requiresEngine: true,
  },
  {
    id: 'battery-voltage',
    register: 1300,
    bit: 4,
    name: 'AL Battery Voltage',
    type: 'Alarm',
    readingKey: 'battery-voltage',
    comparator: '<',
    // The design's own worked example, at a value a 24 V bank can produce: its
    // frame shows "Starter battery voltage — 1 V", which no such system reports.
    // 21.8 V is what a bank that has stopped holding charge looks like.
    limit: 24,
    violation: 21.8,
    agoHours: 3.2,
  },
  {
    id: 'earth-fault',
    register: 1300,
    bit: 5,
    name: 'AL Earth Fault',
    type: 'Alarm',
    readingKey: 'earth-leakage',
    comparator: '>',
    limit: 30,
    violation: 47,
    agoHours: 1.6,
    requiresEngine: true,
  },
  // Bits 6–11 here are the five `AL Common *` roll-ups, deliberately not in this
  // list — see the note below the array.
  //
  // ── Register 1301 · Log Bout 6 ──
  {
    id: 'coolant-temp-low',
    register: 1301,
    bit: 1,
    name: 'AL CoolantTemp Low',
    type: 'Alarm',
    readingKey: 'coolant-temp',
    comparator: '<',
    limit: 60,
    violation: 48,
    agoHours: 4.8,
  },
  {
    id: 'sd-override',
    register: 1301,
    bit: 6,
    name: 'Sd Override',
    type: 'Alarm',
    // A statement about how the panel is configured, not about the engine. It is
    // an alarm because a set running with its shutdowns bypassed is a set with no
    // protection left, which is worth waking somebody for.
    readingKey: null,
    comparator: '>',
    limit: null,
    thresholdLabel: 'Shutdown protections bypassed',
    violation: null,
    agoHours: 9.6,
  },
  // ── Register 1304 · Log Bout 9 ──
  {
    id: 'oil-press-wrn',
    register: 1304,
    bit: 9,
    name: 'AL Oil Press Wrn',
    type: 'Warning',
    readingKey: 'oil-pressure',
    comparator: '<',
    limit: 2.5,
    violation: 2.1,
    agoHours: 0.8,
    requiresEngine: true,
  },
  {
    id: 'oil-press-sd',
    register: 1304,
    bit: 10,
    name: 'AL Oil Press Sd',
    type: 'Shutdown Alarm',
    readingKey: 'oil-pressure',
    comparator: '<',
    limit: 1.5,
    violation: 1.2,
    agoHours: 0.3,
    requiresEngine: true,
  },
  {
    id: 'coolant-temp-wrn',
    register: 1304,
    bit: 11,
    name: 'AL CoolantTemp Wrn',
    type: 'Warning',
    readingKey: 'coolant-temp',
    comparator: '>',
    limit: 95,
    violation: 96,
    agoHours: 1.2,
  },
  {
    id: 'coolant-temp-sd',
    register: 1304,
    bit: 12,
    name: 'AL CoolantTemp Sd',
    type: 'Shutdown Alarm',
    readingKey: 'coolant-temp',
    comparator: '>',
    limit: 98,
    violation: 103,
    agoHours: 0.4,
  },
  // ── Registers 1390–1391 · DPF status ──
  {
    id: 'dpf-status',
    register: 1390,
    bit: 0,
    // The map lists this as `DPF_status 1–32`: one 32-bit status word, with no
    // per-bit names given. Until those arrive it is one `Info` row — which is the
    // right shape anyway, since what an operator needs off it is "this filter
    // wants a regeneration", not which of thirty-two flags said so.
    name: 'DPF status',
    type: 'Info',
    readingKey: null,
    comparator: '>',
    limit: null,
    thresholdLabel: 'Regeneration required',
    violation: null,
    agoHours: 14,
  },
];

/**
 * Why `AL Common Wrn / Sd / BOC / Fls / Stp` are not in `ALERT_RULES`.
 *
 * They are marked for the dashboard and they are not duplicates, so leaving them
 * out is a decision worth writing down rather than a gap.
 *
 * Each is an OR over **every** protection in the controller, not just the ones on
 * this dashboard — and the map has 21 alarm bits that are not marked to be shown
 * (`AL Fuel Level Sd`, the four `AL AIN` sensor pairs, `AL Mains Fail`,
 * `AL Maintenance 1–3`, the fence and rental-timer alarms). So `AL Common Sd` can
 * be true when none of the 26 alarms below is, and *that* is the case it earns its
 * place in: it is the page's only signal that something it does not show has
 * stopped the engine.
 *
 * Which is also why it cannot be shown as one more card. A row reading "AL Common
 * Sd · Any shutdown protection active", sitting next to `AL Oil Press Sd`, tells an
 * operator nothing they cannot already see; the version that is worth building
 * separates *explained* (some shown alarm accounts for it) from *unexplained*
 * (nothing here does — go and open the panel), and only shouts about the second.
 *
 * That needs one thing the map does not currently give: which Common bit each
 * alarm rolls into. Nineteen bits are typed only `Alarm`, and whether `AL Overspeed`
 * is a shutdown, a breaker-open or a stop is a per-protection setting in the panel.
 * Without that column, "explained" is not computable.
 *
 * So: omitted until the Type column distinguishes the classes, or until an operator
 * asks for the catch-all. A prototype should not draw a control whose behaviour it
 * cannot state.
 */

/**
 * A unit that has dropped off the network carries this one instead of the pool.
 *
 * The only alarm here with no register behind it, and it cannot have one: the
 * panel is the thing that went quiet, so this is the ingest layer noticing the
 * silence rather than the controller reporting it. `register: 0` marks it as
 * platform-raised.
 */
const COMMS_RULE: AlertRule = {
  id: 'comms-loss',
  register: 0,
  bit: 0,
  name: 'Communications loss',
  type: 'Alarm',
  readingKey: 'telemetry-age',
  comparator: '>',
  limit: 60,
  violation: null,
  agoHours: 0,
};

/**
 * `< 24 V`, `< 2.5 bar` — a rule written out.
 *
 * The limit takes the reading's own precision only when it needs it. Starter
 * battery voltage is measured to a tenth, but the *rule* is "below 24 volts", and
 * rendering it as `< 24.0 V` would claim a resolution the threshold does not
 * have.
 */
const thresholdOf = (
  rule: AlertRule,
  limit: number | null,
  reading: Reading | undefined,
): string => {
  if (rule.thresholdLabel !== undefined) return rule.thresholdLabel;
  if (limit === null || reading === undefined) return rule.comparator;

  const precision = Number.isInteger(limit) ? 0 : (reading.precision ?? 0);
  return `${rule.comparator} ${amount(limit, reading.unit, precision)}`;
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
  /**
   * Each reading's value **with the engine turning and nothing wrong**, by key.
   *
   * Two things overwrite a reading between the catalogue and the page: the
   * engine being stopped (which zeroes the ones that only exist in motion) and an
   * active alert (which forces the tripping value). Both are facts about *now*,
   * and the analysis chart is drawing a fortnight — it needs the number the
   * machine sat at through last Tuesday's run, which is this one.
   *
   * Keeping it as a plain `number` map rather than a second set of `Reading`s is
   * deliberate: it is scaffolding for the history layer, not a thing to render.
   */
  baseline: Record<string, number>;
  alerts: Array<GensetAlert>;
  tags: Array<GensetTag>;
  condition: GensetCondition;
};

/** Whether an active rule pins its reading, rather than only asserting a state. */
const forcesValue = (rule: AlertRule): boolean =>
  rule.readingKey !== null && (rule.violation !== null || rule.ofNameplate !== undefined);

const ruleById = (id: string): AlertRule => {
  const rule = ALERT_RULES.find((candidate) => candidate.id === id);
  if (rule === undefined) throw new Error(`Unknown alarm rule: ${id}`);
  return rule;
};

/**
 * The set `BRF9540` is pinned to, out of the register map's own alarms.
 *
 * It lands `Critical 2 / Warning 4 / Neutral 3` against the design's
 * `Critical 2 / Warning 5 / Neutral 3`. **The fifth warning is unreachable**, and
 * the reason is worth keeping: the map has six `Warning` bits, one of them is
 * `AL Common Wrn` (omitted, see the note above `COMMS_RULE`), and the last is
 * `AL Overload Wrn` — which would have to put this unit over its nameplate, while
 * its load is pinned at 205 kW so its run lands on the design's "12 hours". No set
 * of real alarms satisfies both, and the design's count is the softer of the two
 * constraints.
 *
 * What is left has to hold together as one machine's story, which fixes the rest of
 * the choice. A set that has cooked its coolant reads high on both coolant bits at
 * once (the shutdown band sits inside the warning band, so crossing the first
 * crosses the second), and the two `Info` bits sit under the voltage and frequency
 * warnings that put those readings off nominal in the first place. Every row here is
 * implied by another row, which is the difference between a fixture and a screenshot
 * of one.
 */
const PINNED_RULE_IDS = [
  'coolant-temp-sd', // Shutdown Alarm ─┬─ critical 2
  'earth-fault', //     Alarm         ─┘
  'coolant-temp-wrn', // Warning      ─┬─ warning 4
  'oil-press-wrn', //                   │
  'gen-voltage-wrn', //                 │
  'gen-freq-wrn', //                   ─┘
  'gen-voltage', //     Info          ─┬─ neutral 3
  'gen-frequency', //                   │
  'dpf-status', //                     ─┘
];

/** Worst-first, for dealing a faulted set its critical before anything else. */
const severityRank = (rule: AlertRule): number =>
  ALERT_SEVERITIES.indexOf(SEVERITY_OF_ALARM_TYPE[rule.type]);

/**
 * Which rules a unit is carrying.
 *
 * `OFFLINE` units get the comms alarm and nothing else — a panel that isn't
 * reporting cannot also be telling you its oil pressure. A faulted unit always
 * carries at least one critical, so the run-state badge and the alerts section
 * agree about whether something is wrong. `BRF9540` carries `PINNED_RULE_IDS`, to
 * reproduce the design's chip counts.
 */
const rulesFor = (genset: Genset): Array<AlertRule> => {
  if (genset.runState === 'OFFLINE') return [COMMS_RULE];
  if (genset.id === 'brf9540') return PINNED_RULE_IDS.map(ruleById);

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

  // Faulted units are dealt worst-first, so they always pick up a critical.
  // Everyone else gets a per-unit shuffle, so two idle sets don't carry the same
  // two warnings.
  const pool =
    genset.runState === 'FAULT'
      ? [...eligible].sort((left, right) => severityRank(left) - severityRank(right))
      : [...eligible].sort(
          (left, right) => spread(genset.id, left.id) - spread(genset.id, right.id),
        );

  // Two rules on one reading are only compatible if they point the same way. A
  // warning band inside a shutdown band is how a panel is actually configured and
  // both bits do latch together; over-voltage *and* under-voltage on the same
  // line is not a machine in trouble, it is a fixture contradicting itself. Rules
  // that force no value (the `Info` bits) constrain nothing and so never clash.
  const dealt: Array<AlertRule> = [];
  for (const rule of pool) {
    if (dealt.length === wanted) break;
    const contradicts = dealt.some(
      (other) =>
        forcesValue(rule) &&
        forcesValue(other) &&
        other.readingKey !== null &&
        other.readingKey === rule.readingKey &&
        other.comparator !== rule.comparator,
    );
    if (!contradicts) dealt.push(rule);
  }

  return dealt;
};

const buildDetail = (genset: Genset, now: number): GensetDetail => {
  const running = genset.runState === 'RUNNING';
  const kva = ratingKva(genset.model);
  const ratedKw = Math.round(kva * POWER_FACTOR);

  // Dealt first, because one of them changes the load — and the load is what the
  // fuel rate, the run's totals and the refuel runway are all derived from.
  const rules = rulesFor(genset);

  // An overload alarm is a claim about the load itself, so it has to set the load
  // rather than overwrite the reading afterwards. Forcing `active-power` at the end
  // would leave the gauge reading 928 kW over a run costed at 205 kW's worth of
  // diesel — the one thing this file exists to prevent. Setting it here instead
  // carries through to the burn rate, the phase currents and the runway together.
  const overloadFraction = Math.max(
    0,
    ...rules.map((rule) =>
      rule.readingKey === 'active-power' ? (rule.ofNameplate?.violation ?? 0) : 0,
    ),
  );

  // `BRF9540` is pinned to 205 kW because that is the load whose fuel rate puts its
  // run at the design's "12 hours"; every other unit takes a stable 22–55% of
  // nameplate, or whatever its overload alarm says it is carrying.
  const loadFraction = 0.22 + spread(genset.id, 'load') * 0.33;
  const loadKw =
    genset.id === 'brf9540'
      ? 205
      : Math.round(ratedKw * (overloadFraction > 0 ? overloadFraction : loadFraction));
  const litresPerHour = Math.round(LITRES_PER_KWH * loadKw * 10) / 10;

  // Run length: how long the engine has been turning (open run) or was turning
  // (closed run). 3–14 hours — see `RUN_HOURS_MAX` in `history.ts` for why a single
  // run does not pass about half a day. `BRF9540` is pinned to the design's 12.
  const runHours = genset.id === 'brf9540' ? 12 : 3 + Math.round(spread(genset.id, 'runHours') * 11);
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
      kind: spec.kind ?? 'instantaneous',
      engineOnly: spec.engineOnly === true,
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

  // Derived at the value the machine holds *while turning*, whether or not it is
  // turning right now. The engine-off rule is applied below, after the baseline
  // has been taken — a set parked since Tuesday still burned 57 L/hr on Tuesday,
  // and the history layer has to be able to say so.
  readings['fuel-level'] = {...readings['fuel-level'], value: genset.fuelLitres};
  readings['fuel-rate'] = {...readings['fuel-rate'], value: litresPerHour};
  readings['active-power'] = {...readings['active-power'], value: loadKw};
  readings['telemetry-age'] = {
    ...readings['telemetry-age'],
    value: Math.round((now - lastUpdatedMs) / 60_000),
  };
  // Not a measurement — a subtraction against the service log. It used to be
  // seeded like the readings above it, which made it a number with nothing
  // behind it: no service could be pointed at as the moment it counts from, and
  // logging one would not have moved it. `serviceSeed.ts` holds the elapsed
  // figure and `services.ts` places the record at the meter reading it implies,
  // so this and the Service tab are two views of one fact.
  //
  // This is the *seeded* value. A service logged in the browser moves it, and the
  // alerts section takes the live figure from the store — see `AlertsSection`.
  readings['hours-since-service'] = {
    ...readings['hours-since-service'],
    value: seededHoursSinceService(genset.id),
  };
  for (const key of ['current-l1', 'current-l2', 'current-l3'] as const) {
    // A healthy set is balanced to within a couple of percent. The per-phase
    // skew is small on purpose — it is what makes the three bars readable as a
    // comparison rather than three copies of one number.
    const skew = 1 + (spread(genset.id, key) - 0.5) * 0.05;
    readings[key] = {...readings[key], value: Math.round(phaseCurrent * skew)};
  }

  const baseline = Object.fromEntries(
    Object.values(readings).map((reading) => [reading.key, reading.value]),
  );

  // An engine that is not turning reports no speed, no output, no pressure and
  // no frequency — every reading that only exists in motion goes to zero at
  // once, rather than a hand-picked three. Temperatures stay: a set that stopped
  // ten minutes ago still has hot coolant, and zeroing that would be a worse lie
  // than leaving it.
  //
  // Before the alert loop, not after. A faulted set latches the value that
  // tripped it, and that number has to survive this.
  if (!running) {
    for (const reading of Object.values(readings)) {
      if (reading.engineOnly) readings[reading.key] = {...reading, value: 0};
    }
  }

  // What "100%" means for the three rules whose line scales with the machine.
  // Nameplate current is the set's kVA at its rated line voltage, which is the
  // same figure the phase-current bars use as their full scale.
  const nameplate: Record<string, number> = {
    'active-power': ratedKw,
    'current-l1': Math.round((kva * 1_000) / (Math.sqrt(3) * 415)),
  };

  // Resolve each rule against this unit before anything is written: the relative
  // rules need `nameplate`, and the readings need every violation on a given key
  // in hand at once.
  const resolved = rules.map((rule) => {
    const full = rule.readingKey === null ? undefined : nameplate[rule.readingKey];
    const scaled = (fraction: number, precision: number): number =>
      full === undefined ? 0 : Math.round(full * fraction * 10 ** precision) / 10 ** precision;

    return {
      rule,
      limit: rule.ofNameplate === undefined ? rule.limit : scaled(rule.ofNameplate.limit, 0),
      violation:
        rule.ofNameplate === undefined ? rule.violation : scaled(rule.ofNameplate.violation, 0),
    };
  });

  // Fold each reading's violations down to one number: the most extreme in the
  // direction its rules point. `AL Battery Voltage` (< 24 V) and `AL Battery Flat`
  // (< 18 V) can both be latched, and the bank is then at the flat figure —
  // leaving it at 21.8 V would put the flat alarm above a value that does not trip
  // it. The two coolant bits climb the other way and fold the same way.
  //
  // The fold is over the violations alone and replaces whatever the reading held.
  // It cannot take the reading into account: on a stopped set the engine-only ones
  // have already been zeroed, and folding `AL Underspeed` against a zero would
  // hand a faulted unit "0 rpm" in place of the speed the controller latched.
  const forced = new Map<string, number>();
  for (const {rule, violation} of resolved) {
    if (rule.readingKey === null || violation === null) continue;
    const held = forced.get(rule.readingKey);
    forced.set(
      rule.readingKey,
      held === undefined
        ? violation
        : rule.comparator === '<'
          ? Math.min(held, violation)
          : Math.max(held, violation),
    );
  }
  for (const [key, value] of forced) readings[key] = {...readings[key], value};

  const alerts: Array<GensetAlert> = resolved.map(({rule, limit}) => ({
    id: `${genset.id}-${rule.id}`,
    ruleId: rule.id,
    name: rule.name,
    register: rule.register,
    bit: rule.bit,
    type: rule.type,
    severity: SEVERITY_OF_ALARM_TYPE[rule.type],
    readingKey: rule.readingKey,
    limit,
    comparator: rule.comparator,
    threshold: thresholdOf(
      rule,
      limit,
      rule.readingKey === null ? undefined : readings[rule.readingKey],
    ),
    raisedAt: new Date(now - rule.agoHours * HOUR).toISOString(),
  }));

  const gauge = (key: string, min: number, max: number): GaugeReading => ({
    ...readings[key],
    min,
    max,
  });

  return {
    gensetId: genset.id,
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
    //
    // ## Which five, and why these ends
    //
    // The row is the page's only *instantaneous* instrument — the bars beside it
    // carry voltage and current and the panel above carries fuel, so a dial that
    // repeats one of those spends 153px saying nothing new. What is left is one
    // reading per subsystem that can kill a running set: the governor, the load,
    // lubrication, cooling, and the charging circuit.
    //
    // The ends matter more than they look. `TickGauge` draws 39 discrete ticks,
    // so a scale is really a choice of *resolution*: span ÷ 39 is the smallest
    // movement the dial can show. A reading whose entire working band occupies a
    // fifth of its scale is a reading whose drift is invisible, and drift is the
    // whole diagnostic value of a live dial. So each pair below is set to put the
    // healthy value near mid-scale and keep every alarm limit on the face.
    gauges: running
      ? [
          // Frequency in place of engine speed. On a four-pole 50 Hz set the two
          // are one measurement — 1500 rpm *is* 50 Hz, as the `Speed & frequency`
          // tag says — and of the pair frequency is the one the load actually
          // sees, so showing rpm here spent a dial on the less useful half.
          //
          // 45–55, not 0–60. Centred on nominal, 0.26 Hz per tick: the ±0.25%
          // ISO 8528 G3 steady-state band is about a tick, and the 48/52 alarm
          // limits sit six either side. A 0–60 scale would put nominal at 83% and
          // render a 2 Hz droop — a governor fault — as one tick of movement.
          gauge('frequency', 45, 55),
          // 1.2 × rating, not rating. `AL Overload Wrn` fires at 100% and
          // `AL Overload BOC` at 110%, so a dial ending at rated pegs full for
          // both and cannot distinguish a set at its limit from one past it.
          // Headroom is also what makes the *low* end readable: below 30% of
          // rating a diesel wet-stacks, and that is a third of this face rather
          // than a number to be compared against a rating held in your head.
          gauge('active-power', 0, Math.round(ratedKw * 1.2)),
          // 0–8 stands. Zero is a real and catastrophic reading for oil pressure —
          // the one gauge here where the bottom of the scale means something — and
          // healthy 4.3 already sits mid-face with the 2.5 warning and 1.5
          // shutdown nine and fourteen ticks below it.
          gauge('oil-pressure', 0, 8),
          // 40–120, not 0–120. A third of the old face covered temperatures a
          // running engine passes through in its first minutes and never revisits,
          // which cost the band that matters — 60 (`AL CoolantTemp Low`) through
          // 98 (`AL CoolantTemp Sd`) — a third of its resolution. 40 keeps a warm-
          // up on scale without spending ticks on ambient.
          gauge('coolant-temp', 40, 120),
          // The fifth, and the one that is not about this run. A flat bank is the
          // commonest reason a standby set fails its *next* start, and the only
          // window in which the charging circuit can be proved is while the engine
          // is turning — which makes it precisely a running-set reading, and the
          // one alarm on the home page's list (`AL Battery Charger`, < 26 V) with
          // no instrument behind it. 20–32 spans a 24 V system from flat to fully
          // charged, putting the 26 V alarm six ticks below a healthy 27.9.
          gauge('charge-alt-voltage', 20, 32),
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
    baseline,
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

/**
 * The fleet row for an id — the home page needs both halves.
 *
 * Reads the **deployed** fleet, not the seed, so a set that has been moved reports
 * the yard it is actually standing in. `DETAILS` above stays on the seed and stays
 * correct: nothing it derives looks at where a machine is.
 */
export const gensetById = (gensetId: string): Genset | undefined =>
  fleet().find((genset) => genset.id === gensetId);

/** `BRF9540 | Cummins 1000 kVa`, for the breadcrumb and the document title. */
export const gensetLabel = (gensetId: string): string => {
  const genset = gensetById(gensetId);
  return genset === undefined ? 'Genset' : gensetName(genset);
};
