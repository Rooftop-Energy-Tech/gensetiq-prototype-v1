import {lightToken} from '@/styles/colors';
import {machineCondition} from './fuelIntegrity';
import {gensetDetail} from './detail';
import {RESERVE_FRACTION, fuelLevelKind} from '../types/fuelLevel.type';
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
 * ## Worst wins, and these three are exhaustive
 *
 * Every genset is in exactly one bucket, so a set of counts adds up to the fleet.
 * Overlapping buckets — a set appearing under both `ALARM` and `REFUEL` — would give
 * three true numbers that sum to more than the estate, and an operator reading them
 * as a workload would double-count the drive.
 *
 * The order is **send an engineer before a tanker**:
 *
 *  - `ALARM` leads: the machine has a fault, and a fault is the thing that can take
 *    the set off cover today.
 *  - `REFUEL` is a scheduling job — the tank is below its reserve line and a tanker
 *    has to be booked, not scrambled.
 *  - `OK` is what is left.
 *
 * `ALARM` outranking `REFUEL` matters more than it looks: a set below reserve *and*
 * carrying a shutdown alarm is not a refuel job, and putting it in the refuel bucket
 * would send a tanker to a machine that needs an engineer.
 *
 * ## There was a fourth, `EMPTY`, until 2026-09-22
 *
 * `Tank empty` — a set under a tenth of capacity, filed ahead of `ALARM` because a dry
 * tank gives no cover at all. It went with the fuel tier that defined it: this estate
 * refuels off the reserve line and does not run a tank down that far, so the bucket
 * was a tile that could only ever read `0`. A machine that is genuinely off cover is
 * still counted — as an `ALARM`, by the fault that took it off — and a tank heading
 * the wrong way is still `REFUEL`, which is the job somebody actually books.
 * `fuelLevel.type` has the long version.
 */
export const FLEET_STATUSES = ['ALARM', 'REFUEL', 'OK'] as const;

export type FleetStatus = (typeof FLEET_STATUSES)[number];

/**
 * How a bucket is coloured, everywhere it appears.
 *
 * **Hue says what kind of job it is.** Violet is diesel — the colour this app already
 * paints every fuel figure in, from the tank glyph to the burn rate — so the fuel
 * bucket carries it. Red is the machine: the same `severity-critical` the alarm badges
 * carry, so a site drawn red on the overview map is red in the sites list too. Green
 * is nothing to do.
 *
 * Colour is read as a category before it is read as a rank, and an operator glancing
 * at the map is deciding what to send rather than what to file first. A tanker and an
 * engineer are different vans, so they are different hues; the ranking is carried by
 * the tiles' left-to-right order instead, which is what an ordering is actually
 * legible as.
 *
 * `'fuel'` — the darker violet — was the `EMPTY` tile's and went with it. The one fuel
 * bucket left keeps `'fuel-low'`, which is the lighter of the pair, because there is
 * no longer a worse fuel state for it to be read against.
 */
export type StatusTone = 'critical' | 'fuel-low' | 'ok';

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
 * `ALARM`, `ALARM` outranks `REFUEL`, and the fuel bucket these tiles exist to show
 * would drain into the red one entirely.
 *
 * So the tank is tested where it belongs — in the fuel line below — and the alarm
 * line asks only about the *machine*: the register map's bits and the leak
 * reconciliation. The three buckets stay exhaustive and stay non-overlapping, which is
 * the property an operator reading them as a workload depends on.
 *
 * A set with no detail entry has no alarms to judge and is not called faulty for
 * it; its tank is still checked, because fuel is a fact about the machine rather
 * than about the alarm map.
 */
export const gensetStatus = (genset: Genset): FleetStatus => {
  const kind = fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres);

  const judged = gensetDetail(genset.id) !== undefined;
  if (judged && machineCondition(genset.id) !== 'OPTIMUM') return 'ALARM';

  if (kind === 'low') return 'REFUEL';
  return 'OK';
};

/** Worst of a set of statuses — `OK` for an empty list, which is a yard with no plant. */
export const worstStatus = (statuses: Array<FleetStatus>): FleetStatus =>
  FLEET_STATUSES.find((status) => statuses.includes(status)) ?? 'OK';
