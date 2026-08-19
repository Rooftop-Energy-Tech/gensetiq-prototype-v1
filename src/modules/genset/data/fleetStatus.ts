import {lightToken} from '@/styles/colors';
import {gensetCondition} from './fuelIntegrity';
import {RESERVE_FRACTION, gensetDetail} from './detail';
import type {Genset} from '../types/genset.type';

/**
 * The one-word answer to "does anybody need to go out to this".
 *
 * ## Why a fourth vocabulary, next to run state, condition and fuel integrity
 *
 * Those three each answer a different question well and none of them answers this
 * one. Run state says what the engine is doing; a set can be idle and perfectly
 * healthy. `GensetCondition` ranks the *alarms*, and knows nothing about a tank
 * running down on a machine with a clean register map. `FuelIntegrityState` is
 * about diesel that went missing, which is a different problem from diesel that was
 * legitimately burned. An operator planning a day's callouts is asking across all
 * three at once, and this is that question written down.
 *
 * ## Worst wins, and these four are exhaustive
 *
 * Every genset is in exactly one bucket, so a set of counts adds up to the fleet.
 * Overlapping buckets — a set appearing under both `EMPTY` and `ALARM` — would give
 * four true numbers that sum to more than the estate, and an operator reading them
 * as a workload would double-count the drive.
 *
 * The order is **cover first**:
 *
 *  - `EMPTY` leads because a set with a dry tank gives no cover at all. It cannot
 *    pick up the load, and at a standby site that is the whole reason it is there.
 *  - `ALARM` next: the machine has a fault, but it is a machine somebody can look at.
 *  - `REFUEL` is a scheduling job — the tank is below its reserve line and a tanker
 *    has to be booked, not scrambled.
 *  - `OK` is what is left.
 *
 * `ALARM` outranking `REFUEL` matters more than it looks: a set below reserve *and*
 * carrying a shutdown alarm is not a refuel job, and putting it in the refuel bucket
 * would send a tanker to a machine that needs an engineer.
 */
export const FLEET_STATUSES = ['EMPTY', 'ALARM', 'REFUEL', 'OK'] as const;

export type FleetStatus = (typeof FLEET_STATUSES)[number];

/**
 * Where the tank stops being a scheduling problem and becomes an outage.
 *
 * A third of the reserve line. Below this a set will pick up air in the fuel system
 * before it finishes a long callout, and bleeding it is a second visit — so the
 * distinction being drawn is not "less fuel" but "a different job".
 *
 * Deliberately not zero. A gauge reading exactly zero is a sensor fault as often as
 * it is an empty tank, and waiting for it would mean the bucket fires after the
 * machine has already failed to start.
 */
export const EMPTY_FRACTION = 0.1;

/**
 * How a bucket is coloured, everywhere it appears.
 *
 * **Hue says what kind of job it is; lightness says how urgent.** Violet is diesel —
 * the colour this app already paints every fuel figure in, from the tank glyph to
 * the burn rate — so the two fuel buckets share it and separate on lightness. Red is
 * the machine: the same `severity-critical` the alarm badges carry, so a site drawn
 * red on the overview map is red in the sites list too. Green is nothing to do.
 *
 * That means **colour does not follow the bucket ranking**, and the departure is
 * deliberate. `EMPTY` outranks `ALARM` for *bucketing* — a set that cannot start is
 * filed under the worse of the two — but a colour is read as a category before it is
 * read as a rank, and an operator glancing at the map is deciding what to send
 * rather than what to file first. A tanker and an engineer are different vans. The
 * ordering is carried by the tiles' left-to-right order instead, which is what an
 * ordering is actually legible as.
 */
export type StatusTone = 'critical' | 'fuel' | 'fuel-low' | 'ok';

export const STATUS_META: Record<
  FleetStatus,
  {
    /** The tile's heading. */
    label: string;
    /** What it means, one line, for the tile's caption. */
    detail: string;
    tone: StatusTone;
    /**
     * The same colour as a literal, for MapLibre paint properties — which are
     * evaluated in a shader and cannot read a CSS variable. The reason
     * `RUN_STATE_META` and `CONDITION_META` each carry one, and the reason it lives
     * beside the tone rather than in the map file: a second copy is how a pin and
     * its tile end up different shades of the same idea.
     */
    mapColor: string;
  }
> = {
  EMPTY: {
    label: 'Tank empty',
    detail: `Below ${Math.round(EMPTY_FRACTION * 100)}% — no cover until refuelled`,
    tone: 'fuel',
    mapColor: lightToken.fuel,
  },
  ALARM: {
    label: 'Alarms raised',
    detail: 'Carrying a warning or a shutdown alarm',
    tone: 'critical',
    mapColor: lightToken['severity-critical'],
  },
  REFUEL: {
    label: 'Low fuel',
    detail: `Below the ${Math.round(RESERVE_FRACTION * 100)}% reserve line`,
    tone: 'fuel-low',
    mapColor: lightToken['fuel-tip'],
  },
  OK: {
    label: 'All OK',
    detail: 'Fuelled, and nothing raised',
    tone: 'ok',
    mapColor: lightToken['severity-ok'],
  },
};

const fuelFraction = (genset: Genset): number =>
  genset.fuelCapacityLitres > 0 ? genset.fuelLitres / genset.fuelCapacityLitres : 0;

/**
 * One genset's bucket.
 *
 * The alarm test is `gensetCondition`, matching the fleet table's Health column and
 * the sites list's Condition — a set losing fuel carries an alarm the register map
 * has no bit for, which `detail.condition` alone would miss. A set with no detail
 * entry has no alarms to judge and is not called faulty for it; its tank is still
 * checked, because fuel is a fact about the machine rather than about the alarm map.
 */
export const gensetStatus = (genset: Genset): FleetStatus => {
  if (fuelFraction(genset) <= EMPTY_FRACTION) return 'EMPTY';

  const judged = gensetDetail(genset.id) !== undefined;
  if (judged && gensetCondition(genset.id) !== 'OPTIMUM') return 'ALARM';

  if (fuelFraction(genset) <= RESERVE_FRACTION) return 'REFUEL';
  return 'OK';
};

/** Worst of a set of statuses — `OK` for an empty list, which is a yard with no plant. */
export const worstStatus = (statuses: Array<FleetStatus>): FleetStatus =>
  FLEET_STATUSES.find((status) => statuses.includes(status)) ?? 'OK';
