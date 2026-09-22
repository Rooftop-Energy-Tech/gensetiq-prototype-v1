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
 * So the line the buckets already draw is written here once, and read three ways: as
 * an alarm on the genset's own page, as the fleet's `REFUEL` bucket, and as the
 * reserve line the refuel runway counts down to. One number, so a tank cannot be low
 * on the overview and fine on its own page.
 *
 * ## There was a second line until 2026-09-22
 *
 * `EMPTY_FRACTION`, a tenth of capacity, with its own `empty` kind, its own
 * `CRITICAL`, and its own `Tank empty` bucket on the overview. It is gone because the
 * estate does not reach it: a set is refuelled off the reserve line, and the tank
 * never gets a third of the way down from there. The tier was modelling a state the
 * fleet does not have, and four exhaustive buckets where one can never be occupied is
 * a tile that reads `0` for the life of the product.
 *
 * What is left says the same thing in the words the fleet uses — a tank is fuelled or
 * it is low, and low is a tanker booking. The seeded sets that sat under the old line
 * are still the emptiest in the estate; they are now the worst of the low ones, which
 * is what `FleetTanks` sorts them to the top for.
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
 * ## Why the line sits here rather than in Settings
 *
 * It is fixed, deliberately, and the Settings tab itself is empty. The rule the app
 * works to: a setpoint that lives in the panel is not editable from a screen that
 * cannot issue the command. This one is the app's own, so it *could* be editable — but
 * it is also what the overview's three buckets are defined as, and a per-genset
 * reserve line would leave the fleet tiles counting to a different definition on every
 * row. If it ever moves, it moves for the estate.
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
 * Which line has been crossed. One, since 2026-09-22 — see the note at the top.
 *
 * Still a list rather than a bare string, and still ordered worst-first, because the
 * three readers below are all written as lookups over it: putting a tier back is this
 * line plus one entry in each of the three records, rather than a reshape.
 */
export const FUEL_LEVEL_KINDS = ['low'] as const;

export type FuelLevelKind = (typeof FUEL_LEVEL_KINDS)[number];

/**
 * The line each kind fires on, as a fraction of capacity.
 *
 * The single place the constant above is attached to the state, so the card's
 * threshold caption and the test that raised it cannot come apart.
 */
export const FUEL_LEVEL_LIMIT: Record<FuelLevelKind, number> = {
  low: RESERVE_FRACTION,
};

/**
 * How loudly it reads, in the alert module's own three-value ranking.
 *
 * `WARNING`, and nothing here is a `CRITICAL` any more. A tank below the reserve line
 * is a real job with a lead time — book a tanker — and that is a warning's job
 * exactly. The `CRITICAL` this record used to carry belonged to the `empty` tier, and
 * went with it.
 *
 * That leaves the tank unable to raise a critical at all, which is the right shape:
 * every other critical in this app is a register-map protection that has stopped the
 * engine, and a low tank stops nothing. It is a statement about cover, and the fleet
 * refuels well before cover is actually at risk.
 */
export const SEVERITY_OF_FUEL_LEVEL: Record<FuelLevelKind, AlertSeverity> = {
  low: 'WARNING',
};

/**
 * The two words it is called, everywhere it appears.
 *
 * The same phrase the overview's `REFUEL` bucket uses, and shared with it rather than
 * retyped: a reader who filtered the fleet by "Low fuel" and then opened one of the
 * results should meet the phrase they clicked, not a synonym for it.
 */
export const FUEL_LEVEL_LABEL: Record<FuelLevelKind, string> = {
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
 * Which line this level has crossed, or `undefined` for a tank above it.
 *
 * `<=`, matching the bucket exactly: a tank at precisely the reserve line is at the
 * line, and a rule that only fires strictly below it would leave a set sitting on
 * 30.0% filed as fine.
 *
 * `find` over the list rather than a comparison written out, so worst-wins is still
 * how this reads if a tier is ever put back above `low`.
 */
export const fuelLevelKind = (
  litres: number,
  capacityLitres: number,
): FuelLevelKind | undefined =>
  FUEL_LEVEL_KINDS.find(
    (kind) => fuelFraction(litres, capacityLitres) <= FUEL_LEVEL_LIMIT[kind],
  );

/**
 * The notice for a tank below its reserve line, or `undefined` for a fuelled one.
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
    message: `Tank at ${percent}% — ${litres} of ${capacity}. Below the ${limitPercent}% reserve line`,
    source: 'Tank level',
    litres: genset.fuelLitres,
    capacityLitres: genset.fuelCapacityLitres,
    fraction,
    threshold: `< ${limitPercent}% of ${capacity}`,
  };
};
