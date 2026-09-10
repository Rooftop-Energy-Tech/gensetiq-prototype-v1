import {ESC330_SLOTS, MAX_DRAWN_CABINETS} from '../types/moduleCabinet.type';
import type {ModuleCabinet, ModuleSlot} from '../types/moduleCabinet.type';
import type {BatteryBank} from '../types/bank.type';
import type {BatteryModule} from '../types/module.type';

/**
 * How a bank's modules divide into the boxes they actually stand in.
 *
 * `moduleCabinet.type.ts` carries the hardware and the survey it comes from. This is
 * the rule, and the rule is three lines of arithmetic with a great deal of argument
 * behind each one.
 *
 * ## One module in the power cabinet, where there is one
 *
 * The `ICC330-H1-C8` holds the subrack **and one battery module** — the census lists
 * it as confirmed installed, not inferred. So one module comes off the top before the
 * rest are divided, and it is drawn in its own single-slot box.
 *
 * **Only where the site actually has that cabinet.** `siteHasCabinet` is the app's own
 * answer — a monitoring unit on the wall, or solar to convert — and it is false at
 * three of the seven banks on this estate. Drawing a `Power cabinet` box at those would
 * assert a second enclosure the rest of the app says is not there, and its link would
 * lead to a page that does not exist. Those banks put every module in `ESC330`s, which
 * is the only place left for one to stand.
 *
 * It is the **last** module rather than the first, which is a choice and worth saying
 * why. Taking `M13` leaves `M01`–`M06` in cabinet 1 and `M07`–`M12` in cabinet 2 —
 * the line-up reads left to right in one unbroken run, and a person counting doors
 * never has to skip a number. Taking `M01` would put the odd one out at the head of
 * the sequence and shift every cabinet's contents by one for no gain.
 *
 * A bank of a single module keeps it in an `ESC330` rather than putting the whole
 * bank inside the power cabinet, which would be a strange claim about a site with one
 * module and no battery cabinet at all.
 *
 * ## Fewest cabinets, then balanced
 *
 * The remaining modules go into `ceil(rest / 7)` cabinets — the fewest that hold them
 * — and are then spread **evenly** across those rather than filling each to seven
 * before opening the next.
 *
 * Even is what the survey found: twelve modules in two cabinets at J1PT is 6 + 6, and
 * greedy filling would have made it 7 + 5. It is also the arrangement that matches how
 * these are wired — the modules sit in parallel on one −48 V bus, and an installer
 * balancing a line-up balances the cabinets too.
 *
 * The two rules together are what keep the spare slots where a reader would look for
 * them. Twelve in two cabinets leaves one spare in each, which is the site profile's
 * own count of two spare positions across fourteen.
 *
 * ## What this is not
 *
 * Not a measurement. Nothing in the poll table says which cabinet a module is in —
 * `Lithium Battery 4 Abnormal` is a register index and the site profile's own split is
 * a reading of a photograph. What is *hardware* here is the seven-slot ceiling and the
 * one module in the power cabinet; what is *arrangement* is which module lands where,
 * and it follows the register order because that is the only order the device
 * publishes. See `moduleCabinet.type.ts` on the alternative reading the survey flags.
 */

/**
 * How many modules stand in `ESC330`s — every one but the power cabinet's, where the
 * site has a power cabinet at all.
 *
 * A bank of one module keeps it in an `ESC330` either way, rather than putting the
 * whole bank inside the power cabinet, which would be a strange claim about a site
 * with no battery cabinet on its pad.
 */
const inEscCabinets = (modules: number, hasPowerCabinet: boolean): number =>
  hasPowerCabinet && modules >= 2 ? modules - 1 : modules;

/** How many `ESC330`s a bank of this size needs, before anything is drawn. */
export const escCabinetCount = (modules: number, hasPowerCabinet: boolean): number =>
  Math.max(1, Math.ceil(inEscCabinets(modules, hasPowerCabinet) / ESC330_SLOTS));

/**
 * Whether the line-up is drawn for this bank, or the card grid answers instead.
 *
 * `MAX_DRAWN_CABINETS` carries the argument: it is a claim about which banks are
 * plausibly a row of `ESC330`s on a pad, not about how many boxes fit across a page.
 */
export const moduleCabinetsFit = (bank: BatteryBank, hasPowerCabinet: boolean): boolean =>
  escCabinetCount(bank.modules, hasPowerCabinet) <= MAX_DRAWN_CABINETS;

/**
 * The line-up, built from the bank's own modules.
 *
 * Takes the modules rather than calling `bankModules` itself, for the reason
 * `SubrackShelf` hands its shelves to both the figure and the lookup: the band draws
 * this and also resolves a click against it, and two callers deriving the same
 * geometry from the same counts is two chances for the drawing and the selection to
 * disagree about where a slot is.
 *
 * The bank itself is not needed — the line-up is a fact about how many modules there
 * are and whether the site has a power cabinet, and `moduleCabinetsFit` is where the
 * bank is consulted about whether to draw one at all.
 */
export const moduleCabinets = (
  modules: ReadonlyArray<BatteryModule>,
  /** `siteHasCabinet` — whether there is an `ICC330` on this pad to hold one. */
  hasPowerCabinet: boolean,
): ReadonlyArray<ModuleCabinet> => {
  const inPower = hasPowerCabinet && modules.length >= 2 ? 1 : 0;
  const rest = modules.length - inPower;
  const count = Math.max(1, Math.ceil(rest / ESC330_SLOTS));

  // Balanced rather than greedy — the note above. The remainder goes to the leftmost
  // cabinets, so a reader scanning the line-up sees the fuller boxes first.
  const base = Math.floor(rest / count);
  const extra = rest % count;

  const cabinets: Array<ModuleCabinet> = [];
  let next = 0;

  for (let index = 0; index < count; index += 1) {
    const fitted = base + (index < extra ? 1 : 0);
    const slots: Array<ModuleSlot> = [];

    for (let slot = 1; slot <= ESC330_SLOTS; slot += 1) {
      slots.push({
        key: `c${index + 1}-s${slot}`,
        slot,
        // Fitted positions first, then the spares. Which is how an installer fills a
        // cabinet and how anybody reads one, though it is worth being honest that the
        // survey does not say whether the empty positions at J1PT are the top ones or
        // the bottom ones — only how many there are.
        module: slot <= fitted ? modules[next++] : undefined,
      });
    }

    cabinets.push({
      key: `c${index + 1}`,
      kind: 'ESC330',
      /* Numbered only where there is more than one, so a single-cabinet bank reads
         `Battery cabinet` rather than `Cabinet 1` of nothing. */
      label: count === 1 ? 'Battery cabinet' : `Cabinet ${index + 1}`,
      model: 'ESC330-D6',
      slots,
    });
  }

  if (inPower === 1) {
    cabinets.push({
      key: 'power',
      kind: 'POWER',
      label: 'Power cabinet',
      model: 'ICC330-H1-C8',
      // One slot and it is always filled: this box's battery position is not a
      // seven-slot rack with room to grow, it is the single module the census found
      // sharing the subrack's cabinet. A spare position here would be inventing space
      // nobody has measured.
      slots: [{key: 'power', slot: 1, module: modules[next]}],
    });
  }

  return cabinets;
};

/** Every slot in the line-up, flattened — for resolving a selection against it. */
export const allSlots = (
  cabinets: ReadonlyArray<ModuleCabinet>,
): ReadonlyArray<ModuleSlot> => cabinets.flatMap((cabinet) => cabinet.slots);
