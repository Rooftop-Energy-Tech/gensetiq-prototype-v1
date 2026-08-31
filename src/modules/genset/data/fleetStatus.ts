import {lightToken} from '@/styles/colors';
import {machineCondition} from './fuelIntegrity';
import {gensetDetail} from './detail';
import {EMPTY_FRACTION, RESERVE_FRACTION, fuelLevelKind} from '../types/fuelLevel.type';
import type {Genset} from '../types/genset.type';

/**
 * The one-word answer to "does anybody need to go out to this".
 *
 * ## Why a fourth vocabulary, next to run state, condition and fuel integrity
 *
 * Those three each answer a different question well and none of them answers this
 * one. Run state says what the engine is doing; a set can be idle and perfectly
 * healthy. `GensetCondition` ranks the *alarms* — how bad is the worst thing this
 * machine is reporting — which is not the same as what van to send.
 * `FuelIntegrityState` is about diesel that went missing, which is a different
 * problem from diesel that was legitimately burned. An operator planning a day's
 * callouts is asking across all three at once, and this is that question written
 * down.
 *
 * The condition now counts the tank, so the two overlap where they did not before:
 * a set below its reserve line raises a fuel-level alarm *and* lands in `REFUEL`.
 * That is handled once, in `gensetStatus` — see the note there.
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

/**
 * One genset's bucket.
 *
 * The alarm test is `machineCondition` and **not** `gensetCondition`, which is the
 * one place in the app that deliberately reads the narrower verdict. The wide one
 * now counts the tank — a set below its reserve line carries a fuel-level alarm, so
 * a genset's own page can stop showing a green `Optimum` over a dry tank. Reading
 * that here would say the same fact twice: every `REFUEL` set would test true for
 * `ALARM`, `ALARM` outranks `REFUEL`, and the two fuel buckets these tiles exist to
 * show would both drain into the red one.
 *
 * So the tank is tested where it belongs — in the two fuel lines below and above —
 * and the alarm line asks only about the *machine*: the register map's bits and the
 * leak reconciliation. The four buckets stay exhaustive and stay non-overlapping,
 * which is the property an operator reading them as a workload depends on.
 *
 * A set with no detail entry has no alarms to judge and is not called faulty for
 * it; its tank is still checked, because fuel is a fact about the machine rather
 * than about the alarm map.
 */
export const gensetStatus = (genset: Genset): FleetStatus => {
  const kind = fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres);
  if (kind === 'empty') return 'EMPTY';

  const judged = gensetDetail(genset.id) !== undefined;
  if (judged && machineCondition(genset.id) !== 'OPTIMUM') return 'ALARM';

  if (kind === 'low') return 'REFUEL';
  return 'OK';
};

/** Worst of a set of statuses — `OK` for an empty list, which is a yard with no plant. */
export const worstStatus = (statuses: Array<FleetStatus>): FleetStatus =>
  FLEET_STATUSES.find((status) => statuses.includes(status)) ?? 'OK';
