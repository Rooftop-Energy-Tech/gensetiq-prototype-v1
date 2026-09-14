import {amount, runtimeSpan, stampDate} from '@/lib/format';
import type {AlertSeverity} from './alert.type';
import type {Genset} from './genset.type';

/**
 * The tank level, read as an alarm.
 *
 * ## Why this exists
 *
 * Fuel level was the one threshold-crossing reading in this app that raised
 * nothing. Every other number a rule watches — battery voltage, coolant
 * temperature, oil pressure — arrives from the panel and is compared against a
 * line, and crossing that line puts a row in the alerts section and moves the
 * verdict above it. The tank arrived the same way, as `fuelLitres` off the fleet
 * row, and crossing its line moved a *bucket on the overview* instead. A genset
 * sitting at 8% of capacity showed a green `Optimum` beside a dry tank, which is
 * the page contradicting itself about the most consequential fact on it.
 *
 * So the two lines the buckets already draw are written here once, and read three
 * ways: as an alarm on the genset's own page, as the fleet's `EMPTY` and `REFUEL`
 * buckets, and as the reserve line the refuel runway counts down to. One pair of
 * numbers, so a tank cannot be low on the overview and fine on its own page.
 *
 * ## Why it is not in the register map
 *
 * The controller *has* `AL Fuel Level Wrn` and `AL Fuel Level Sd`, and the note in
 * `data/detail.ts` is still true: neither is marked *To Include in Dashboard*, so
 * neither belongs in `ALERT_RULES`. This is the same shape as the fuel leak — an
 * alarm the **app** raises from arithmetic it does itself — and it is presented the
 * same way, printing where it came from where a register-map row prints its
 * register and bit. A reader has to be able to tell the panel talking from the app
 * talking, and the source line is how they already do it.
 *
 * ## Why the lines sit here rather than in Settings
 *
 * They are fixed, deliberately, and the Settings tab itself is empty. The rule the
 * app works to: a setpoint that lives in the panel is not editable from a screen
 * that cannot issue the command. These two are the app's own, so they *could* be editable —
 * but they are also what the overview's four buckets are defined as, and a
 * per-genset reserve line would leave the fleet tiles counting to a different
 * definition on every row. If they ever move, they move for the estate.
 */

/**
 * Fraction of the tank the refuel runway counts down to, not to zero.
 *
 * The line between "fuelled" and "book a tanker". Above it a set is fine; below
 * it somebody has to schedule a drive, which is a job with a lead time rather
 * than a callout.
 */
export const RESERVE_FRACTION = 0.3;

/**
 * Where the tank stops being a scheduling problem and becomes an outage.
 *
 * A third of the reserve line. Below this a set will pick up air in the fuel
 * system before it finishes a long callout, and bleeding it is a second visit —
 * so the distinction being drawn is not "less fuel" but "a different job".
 *
 * Deliberately not zero. A gauge reading exactly zero is a sensor fault as often
 * as it is an empty tank, and waiting for it would mean the alarm fires after the
 * machine has already failed to start.
 */
export const EMPTY_FRACTION = 0.1;

/** Which line has been crossed. Ordered worst-first, like every other ranking here. */
export const FUEL_LEVEL_KINDS = ['empty', 'low'] as const;

export type FuelLevelKind = (typeof FUEL_LEVEL_KINDS)[number];

/**
 * The line each kind fires on, as a fraction of capacity.
 *
 * The single place the two constants above are attached to the two states, so the
 * card's threshold caption and the test that raised it cannot come apart.
 */
export const FUEL_LEVEL_LIMIT: Record<FuelLevelKind, number> = {
  empty: EMPTY_FRACTION,
  low: RESERVE_FRACTION,
};

/**
 * How loudly each reads, in the alert module's own three-value ranking.
 *
 * `empty` is `CRITICAL` and that is not an overreach: at a standby site the whole
 * reason the machine is there is to pick the load up, and one that cannot is as
 * unavailable as one that has shut down. `low` is `WARNING` — a real job, with
 * time to plan it.
 *
 * Note this deliberately departs from the rule `rulesFor` works to, that a
 * critical belongs only to a set which has actually stopped. That rule is about
 * *register-map* criticals, every one of which is a protection that stops the
 * engine — a running set carrying one is a contradiction. A dry tank stops
 * nothing; it is a statement about cover, and a running set can perfectly well be
 * about to run out. The fuel leak alarm already draws the same distinction.
 */
export const SEVERITY_OF_FUEL_LEVEL: Record<FuelLevelKind, AlertSeverity> = {
  empty: 'CRITICAL',
  low: 'WARNING',
};

/**
 * The two words each kind is called, everywhere it appears.
 *
 * The same pair the overview's buckets use, and shared with them rather than
 * retyped: a reader who filtered the fleet by "Tank empty" and then opened one of
 * the results should meet the phrase they clicked, not a synonym for it.
 */
export const FUEL_LEVEL_LABEL: Record<FuelLevelKind, string> = {
  empty: 'Tank empty',
  low: 'Low fuel',
};

export type FuelLevelNotice = {
  gensetId: string;
  kind: FuelLevelKind;
  /** The sentence on the card. */
  message: string;
  /** Where it came from, in the reader's language. */
  source: string;
  /** The level that raised it, and the tank it was measured in. */
  litres: number;
  capacityLitres: number;
  /** The fraction that level works out to — what the rule actually compared. */
  fraction: number;
  /** How the rule reads, e.g. `< 30% of 2,450 L`. */
  threshold: string;
};

/**
 * How full the tank is, 0–1.
 *
 * Guarded on capacity because a genset with no tank figure would otherwise divide
 * by zero and report `NaN`, which compares false against every threshold and would
 * quietly file the unit as healthy.
 */
export const fuelFraction = (litres: number, capacityLitres: number): number =>
  capacityLitres > 0 ? litres / capacityLitres : 0;

/**
 * Which line this level has crossed, or `undefined` for a tank above both.
 *
 * `<=` on both, matching the buckets exactly: a tank at precisely the reserve line
 * is at the line, and a rule that only fires strictly below it would leave a set
 * sitting on 30.0% filed as fine.
 *
 * Worst wins, and the two are checked in that order — a tank below the empty line
 * is also below the reserve line, and reporting both would put one machine's one
 * tank in the alert list twice.
 */
export const fuelLevelKind = (
  litres: number,
  capacityLitres: number,
): FuelLevelKind | undefined =>
  FUEL_LEVEL_KINDS.find(
    (kind) => fuelFraction(litres, capacityLitres) <= FUEL_LEVEL_LIMIT[kind],
  );

/**
 * The notice for a tank below one of its lines, or `undefined` for a fuelled one.
 *
 * The message leads with the percentage because that is what the rule compared,
 * and follows it with the litres because that is what somebody ordering a delivery
 * needs. Both, rather than either: a percentage alone cannot be turned into a
 * tanker booking, and a litre figure alone cannot be checked against the line.
 */
/**
 * The tank's scheduling figures, as the fuel panel and the strip each need them.
 *
 * Both read the same three numbers — how much is in there, where the reserve line
 * sits, and how many hours of running separate the two — so both are written here
 * rather than in the two components. The panel and the tile disagreeing about
 * whether a set is below reserve is the failure this prevents.
 *
 * `fuel` is taken structurally rather than as `GensetFuelDetail`: that type lives
 * in the data module, and a types module importing from data is the wrong way
 * round.
 */
const belowReserve = (
  litres: number,
  fuel: {maxLitres: number; reserveFraction: number},
): boolean => litres <= fuel.reserveFraction * fuel.maxLitres;

/**
 * "6.4 days to 30%", "39 hours of runtime left", "Below 30% reserve".
 *
 * The runway counts down to the reserve line rather than to empty, because empty
 * is not a number anybody plans against — a set that runs its tank dry picks up
 * air in the fuel system and needs bleeding before it will restart.
 *
 * **A stopped set is phrased differently, and it has to be.** For a running one,
 * litres-above-reserve ÷ burn rate is both an amount of runtime and an amount of
 * wall-clock. A stopped set is burning nothing: the same arithmetic is still the
 * runtime it would get if you started it, but stated as a countdown it would claim
 * the tank is draining while the engine sits idle.
 */
export const fuelRunway = (
  litres: number,
  fuel: {maxLitres: number; reserveFraction: number; hoursToReserve: number},
  running: boolean,
): string => {
  const reserve = Math.round(fuel.reserveFraction * 100);
  if (belowReserve(litres, fuel)) return `Below ${reserve}% reserve`;

  // `runtimeSpan` returns lowercase prose for its smallest case ("under an hour"),
  // and this is the head of a badge. Capitalising the first character is a no-op
  // on the numeric cases.
  const span = runtimeSpan(fuel.hoursToReserve);
  const head = span.charAt(0).toUpperCase() + span.slice(1);

  return running ? `${head} to ${reserve}%` : `${head} of runtime left`;
};

/**
 * The same fact, short enough for a strip tile: `6.4 days · 12 Sep 2026`.
 *
 * The tile carries the date and the panel's badge does not, because this is the
 * figure a reader scans to decide whether a lorry goes out this week — and a date
 * is what they will put in the diary. The reserve percentage is dropped instead:
 * it is the same line for every set in the estate, so repeating it in the one
 * place with the least room buys nothing.
 *
 * A stopped set gets no date, for the reason `fuelRunway` gives.
 */
export const fuelRemainingHeadline = (
  litres: number,
  fuel: {maxLitres: number; reserveFraction: number; hoursToReserve: number; refuelBy: string},
  running: boolean,
): string => {
  if (belowReserve(litres, fuel)) return 'Below reserve';

  const span = runtimeSpan(fuel.hoursToReserve);
  return running ? `${span} · ${stampDate(fuel.refuelBy)}` : `${span} of runtime`;
};

export const fuelLevelNotice = (genset: Genset): FuelLevelNotice | undefined => {
  const kind = fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres);
  if (kind === undefined) return undefined;

  const fraction = fuelFraction(genset.fuelLitres, genset.fuelCapacityLitres);
  const percent = Math.round(fraction * 100);
  const limitPercent = Math.round(FUEL_LEVEL_LIMIT[kind] * 100);
  const litres = amount(genset.fuelLitres, 'L');
  const capacity = amount(genset.fuelCapacityLitres, 'L');

  return {
    gensetId: genset.id,
    kind,
    message:
      kind === 'empty'
        ? `Tank at ${percent}% — ${litres} of ${capacity}. No cover until it is refuelled`
        : `Tank at ${percent}% — ${litres} of ${capacity}. Below the ${limitPercent}% reserve line`,
    source: 'Tank level',
    litres: genset.fuelLitres,
    capacityLitres: genset.fuelCapacityLitres,
    fraction,
    threshold: `< ${limitPercent}% of ${capacity}`,
  };
};
