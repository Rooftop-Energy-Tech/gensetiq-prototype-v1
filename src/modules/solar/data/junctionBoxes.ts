import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import type {SolarSystem} from '../types/system.type';

/**
 * The array broken out **per junction box**: how many strings land in each, how many
 * of those are delivering, and how much of the array's output each is carrying.
 *
 * From Jeff (2026-09-09), for band 2 of the system page — which was one hero dial
 * reading the whole array and is now a card per box.
 *
 * ## The one measurement, and the six numbers made from it
 *
 * This file is arithmetic over a **single** measured figure. `system.outputKw` is what
 * `hybrid.ts` says the array is making; nothing anywhere reports a box. A junction box
 * is a passive combiner — `ArrayEquipment` puts it plainly: *"an array is glass and
 * cable, and every figure on this page is the asset register or this app's own
 * arithmetic"* — so there is no register to read and there never will be without a
 * string-level monitor on the roof.
 *
 * That makes this a **re-introduction of something this module deliberately deleted**,
 * and it should be named as such. `systems.ts` lists, among what went with the
 * inverters, "a per-box apportionment of the system's output". This is that, over a
 * different box. The difference that makes it allowable is what the split is keyed on:
 * the old one apportioned output across *inverters* that each had their own AC
 * nameplate and their own comms, so the app was publishing a per-device reading the
 * device itself could have contradicted. A junction box cannot contradict anything —
 * it has no sensor, no rating plate and no opinion — and the share is derived from the
 * one thing about it that is a genuine fact: how many live strings it holds.
 *
 * It is still a share and not a reading. The band that draws it **said so in words**
 * under its heading until Jeff removed that line (2026-09-09), so the caveat now lives
 * only in these two files: without it a reader takes seven different kilowatt figures
 * for seven measurements, and would go looking for a fault in whichever box the
 * *rounding* put a tenth into. `JunctionBoxRack` records what partly covers the gap and
 * where the sentence would go if it is wanted back.
 *
 * ## The alarm rows index boxes, and only the first few of them
 *
 * `PV N Array Fault` is one row per conversion unit, and the register map's own words
 * for it are "the panels and wiring feeding unit N — a dead string, a blown string
 * fuse, **a junction box**". Its category note is more explicit still: the row "is not
 * the module — it is fifteen strings across **four junction boxes** on the roof". So
 * `PV 1` is the first box's worth of array, and joining row N to box N is the document's
 * own reading rather than a mapping invented here. `faultedBoxes` does that join.
 *
 * **It does not reach every box.** SBH-1336 has four units and this comes to seven
 * boxes, so boxes 5–7 have no register watching them; SWK-0559 has five units and eight
 * boxes. That gap is not an error here and it is not fixable here — see
 * `ArrayWiring.junctionBoxes`: the ratios are the survey (two panels a string, four
 * strings a box) and the *counts* follow `kwp`, which is still the modelled 28 rather
 * than the surveyed 16.2. At 16.2 it is 15 strings, 4 boxes and 4 rows, one apiece, and
 * every box is watched.
 *
 * Keeping 28 kWp was a deliberate call recorded in `systems.ts` and this is where it
 * shows.
 *
 * ⚠️ **Nothing marks those boxes, so on the page they read as clear ones.** A
 * `watched: boolean` was carried here for one revision so the band could print `not
 * reported` on them — the same thing `SubrackRack` does for the rectifiers whose
 * addresses nobody has confirmed, and for the same reason: a card left blank reads as a
 * healthy box, which is the "an alarm reading 0 is ambiguous three ways" mistake this
 * app's alarm model is built to avoid. Jeff removed the note (2026-09-09) and the field
 * went with it rather than sitting unread.
 *
 * Restoring it is `index <= monitoringUnit(system.siteId)?.ssus`, and `?? 0` is the
 * right fallback rather than a shrug: a site with no unit publishes no `PV N Array
 * Fault` at all, so every box on it is unreported.
 */

/** One junction box, and everything the app can say about it. */
export type JunctionBox = {
  /** Stable across renders, for keys and for a future route. */
  id: string;
  /**
   * 1-based position in the array, which is the number `PV N Array Fault` indexes.
   *
   * Carried rather than left to the caller's array index, because the join to the
   * alarm rows is by this number and an off-by-one there marks the wrong box.
   */
  index: number;
  /** `SJB 3`, in the survey's own abbreviation. */
  label: string;
  /**
   * Strings landing in this box — its make-up, and its nameplate.
   *
   * `stringsPerBox` for all but the last, which takes the remainder. The last box
   * being short is the survey's own shape and not a modelling artefact: fifteen
   * strings fill three boxes and leave three in a fourth.
   */
  strings: number;
  /**
   * How many of those strings are delivering. Below `strings` where the array has
   * dark strings — see `placeDark`.
   */
  liveStrings: number;
  /**
   * This box's share of the array's nameplate, kWp — `strings` of the array's total,
   * at the array's kWp.
   *
   * Off **all** its strings and not the live ones, which is the whole point of having
   * it: a box does not lose nameplate when a string goes dark, so a short box's
   * generation sits below the capacity printed under it. Taking this off the live
   * strings instead would move the yardstick with the loss, every box would read
   * proportionally normal, and the breakdown would say nothing.
   */
  capacityKwp: number;
  /**
   * This box's share of what the array is making, kW — or `null` when nobody has heard
   * from the site.
   *
   * `null` rather than `0`, which is the rule this module already keeps for the day's
   * energy: zero says the box made nothing, and what is actually known is that nobody
   * heard it. Zero *is* correct at night, and that is a different fact the band states
   * with the same `Dark` badge it always had.
   */
  outputKw: number | null;
};

/**
 * The strings, dealt into boxes: `stringsPerBox` each until they run out.
 *
 * Filling in order rather than levelling — four, four, four, two, and not three across
 * seven. A junction box holds four strings because it has four sets of terminals, so a
 * roof with twenty-six strings has six full boxes and one with two spare ways in it.
 * Levelling would draw seven boxes nobody would install.
 */
const stringSplit = (strings: number, stringsPerBox: number): Array<number> => {
  const sizes: Array<number> = [];
  for (let left = strings; left > 0; left -= stringsPerBox) {
    sizes.push(Math.min(stringsPerBox, left));
  }
  return sizes;
};

/**
 * Which boxes lost the dark strings — **the boxes a register names first, then one each
 * round the rest in order.**
 *
 * Two sources, and they know different things, so they are placed differently.
 *
 * ## The registers, which can locate a loss
 *
 * A standing `PV N Array Fault` names **box N**. It is the one thing on this page that
 * points at a place, so those boxes take a string each before anything is spread — and
 * `darkStrings` in `systems.ts` floors the count at the number of them, so the budget is
 * always there to spend. That is what stops the case Jeff found on 2026-09-09: `SJB 1`
 * carrying `PV 1 Array Fault` and reading `4 of 4 delivering` in the same card, with the
 * same generation figure as its six healthy neighbours. A card cannot say a box has a
 * critical fault and that nothing is wrong with it.
 *
 * One string, not the box. The register says this combiner has a fault; it does not say
 * how much of it is gone, and `plantAlarms.ts` lists a dead string, a blown string fuse
 * and the junction box itself as the same row. One is the least the row can mean and the
 * most it can be held to.
 *
 * ## The step, which cannot
 *
 * Whatever is left over is the array's own output step, and that is spread **one each
 * round the boxes in order** rather than clustered — Jeff's call, 2026-09-09, and the
 * two shapes say different things about the same three dark strings. Spread, three of
 * twenty-six dark is *the array* down a tenth: the first three boxes read a string short
 * and a few hundred watts light, and no box stands out. Clustered, it is *a box* — one
 * combiner reading one of four with the other six normal, which is what a blown fuse or
 * a chewed run actually looks like on a roof.
 *
 * The give-up is deliberate, and the reason it is the right one is where the count comes
 * from: the **depth of a step in the whole array's output**, and a step in one series
 * cannot say whether the loss was in one place or everywhere. Clustering into box 1
 * would have drawn a specific claim out of a measurement that contains no such claim,
 * and it would have looked more informative for being less true.
 *
 * So the rule reads: **claims are placed, measurements are spread.**
 *
 * Capped per box in both passes, and the spread walks on when a box fills, so a short
 * last box cannot be dealt more dark strings than it holds. `darkStrings` already keeps
 * at least one string live across the array, so the exhaustion guard is belt and braces
 * rather than a path anything reaches.
 */
const placeDark = (
  sizes: ReadonlyArray<number>,
  dark: number,
  faulted: ReadonlySet<number>,
): Array<number> => {
  const out = sizes.map(() => 0);
  let left = Math.max(0, dark);

  // The boxes a register names, in order, one string each.
  for (let box = 0; box < sizes.length && left > 0; box += 1) {
    if (!faulted.has(box + 1) || out[box]! >= sizes[box]!) continue;
    out[box] += 1;
    left -= 1;
  }

  // The rest of the step, spread.
  let box = 0;
  while (left > 0 && out.some((taken, index) => taken < sizes[index]!)) {
    if (out[box]! < sizes[box]!) {
      out[box] += 1;
      left -= 1;
    }
    box = (box + 1) % sizes.length;
  }

  return out;
};

/**
 * The array's kilowatts shared out by live strings, **in tenths, by largest
 * remainder** — so the figures a reader can see add up to the figure above them.
 *
 * This is the part that would otherwise be quietly wrong. The cards print one decimal,
 * and 15.2 kW over twenty-six strings is 2.338 a full box: rounded independently that
 * is six cards of 2.3 and one of 1.2, which is 15.0 against a total of 15.2. Two
 * missing tenths on one screen is exactly the drift this app treats as a defect — the
 * reader who adds the cards up is the reader checking whether the page can be trusted,
 * and they would find it cannot.
 *
 * So the split is done in the unit the cards are *printed* in. Every box takes its
 * floor, and the leftover tenths go one each to the boxes with the largest fractions,
 * ties by position. The printed figures therefore sum to the printed total exactly, and
 * the cost is that one or two boxes carry a tenth more than their strings strictly
 * earn. That trade is the right way round: a tenth of a kilowatt is below anything
 * anybody acts on, and it is a share rather than a reading in the first place.
 *
 * Boxes with no live strings are held out of the remainder pass entirely. A dark box
 * must read `0.0`, and a rounding scheme that handed it the last spare tenth would put
 * output on a box the same card says is delivering nothing.
 */
const shareTenths = (totalKw: number, weights: ReadonlyArray<number>): Array<number> => {
  const total = Math.round(totalKw * 10);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || totalWeight === 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (total * weight) / totalWeight);
  const tenths = exact.map((value) => Math.floor(value));

  const spare = total - tenths.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({index, fraction: value - Math.floor(value)}))
    .filter(({index}) => weights[index]! > 0)
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let taken = 0; taken < spare && taken < order.length; taken += 1) {
    tenths[order[taken]!.index] += 1;
  }

  return tenths.map((value) => value / 10);
};

/**
 * Every junction box on one array, in order.
 *
 * **Empty where the array has not been surveyed**, which is the same split
 * `monitoringUnit.ts` draws and the reason `wiring` is nullable: a box breakdown at a
 * site nobody has visited would be inventing the combiners as well as their readings.
 * That branch is reachable today only by a reader flipping a site to solar hybrid on
 * its settings tab — every site that has an array has a unit — and the band it feeds
 * keeps the hero dial for exactly that case rather than drawing an empty grid.
 */
export const junctionBoxes = (
  system: SolarSystem,
  /**
   * The array's standing rows, so the boxes a `PV N Array Fault` names are the boxes
   * that read a string short. Defaults to none, which is the honest answer for a caller
   * that has not read the alarm store — the count in `system.downStrings` is then spread
   * rather than placed. Every caller that draws these cards passes them.
   */
  standing: ReadonlyArray<AlarmView> = [],
): Array<JunctionBox> => {
  if (system.wiring === null) return [];

  const sizes = stringSplit(system.strings, system.wiring.stringsPerBox);
  const dark = placeDark(sizes, system.downStrings, new Set(faultedBoxes(standing).keys()));
  const live = sizes.map((size, index) => size - dark[index]!);

  const reporting = system.state !== 'OFFLINE';
  const shares = shareTenths(system.outputKw, live);

  return sizes.map((strings, index) => ({
    id: `${system.id}-sjb-${index + 1}`,
    index: index + 1,
    label: `SJB ${index + 1}`,
    strings,
    liveStrings: live[index]!,
    capacityKwp: (system.kwp * strings) / system.strings,
    outputKw: reporting ? shares[index]! : null,
  }));
};

/**
 * The standing `PV N Array Fault` rows, keyed by the junction box each one is about.
 *
 * Takes the **already-computed** standing list rather than subscribing to the alarm
 * store itself. `SystemHome` holds one subscription for the whole page and hands the
 * rows down, for the reason that file states: "the counts above and the cards below are
 * claims about the same store, and two subscriptions is how they end up a render
 * apart". It also means clearing `PV 1 Array Fault` on the Alarms tab unmarks SJB 1 on
 * the way back, with no second read of anything.
 *
 * The list is already filtered to standing rows by `solarAlarmQueue`, which matters
 * because `assertedPlantAlarms` underneath it returns **cleared rows too** — a mark
 * that survived clearing was one bug in two places earlier in this design, on the
 * cabinet's bays and on the bank's modules, and it is worth naming here so a future
 * caller does not hand this function the unfiltered rows.
 *
 * Returns the row rather than a severity or a boolean, because the card has to name the
 * register and link to it: a 190px tile in a wrapping grid is the only surface this mark
 * has, so the name comes with it. `ModuleRack` argues that at length.
 *
 * The derived rules are ignored here without being filtered out, because they cannot
 * match: `Strings offline` and `Wash overdue` are the app's own arithmetic over the
 * whole array and name no box. Only a register row carries an index, which is the
 * distinction `health.type.ts` exists to keep.
 */
export const faultedBoxes = (
  standing: ReadonlyArray<AlarmView>,
): ReadonlyMap<number, AlarmView> => {
  const faults = new Map<number, AlarmView>();

  for (const row of standing) {
    const match = /^PV (\d+) Array Fault$/.exec(row.name);
    if (match?.[1] !== undefined) faults.set(Number(match[1]), row);
  }

  return faults;
};
