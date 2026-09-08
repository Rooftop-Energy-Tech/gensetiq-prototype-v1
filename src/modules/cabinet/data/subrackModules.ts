import {spread} from '@/modules/genset/data/spread';
import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {SubrackCabinet} from '../types/cabinet.type';
import type {SubrackModule, SubrackSlotFault} from '../types/subrackModule.type';

/**
 * What is in the shelf: the rectifiers, then the SSUs, in slot order.
 *
 * ## The rack is not sorted, for the bank's reason
 *
 * Slot order, whatever any module's state. The cards carry the labels a technician
 * reads off the front of the shelf with the door open, and a rack that reorders
 * itself is a rack you cannot take to site — the whole use of finding `S4` faulted
 * is knowing it is the fourth SSU along. Rectifiers first because that is the
 * shelf's own layout: AC→DC conversion is the plant's spine and the SSUs were added
 * to it.
 *
 * ## Where each figure comes from
 *
 * **Output** is the tower's load divided across whichever group is carrying, evenly.
 * Evenly is not a simplification — a telecom rectifier shelf load-shares by design,
 * which is the whole point of running N+1: six modules at a sixth each is what the
 * plant is *for*. The other group reads zero, and that is the plant working
 * correctly rather than a fault. See `SubrackCabinet.carrying`.
 *
 * **Temperature** is the enclosure's plus the module's own work. A module passing
 * nothing sits at cabinet temperature; one at its rating sits `FULL_LOAD_RISE_C`
 * above it, with a small per-slot offset so a shelf is not ten identical figures. A
 * flat rack would be the one thing this drawing must not be, for the reason the
 * battery's modules exist at all: a shelf reading one number cannot show you the
 * module that is about to go.
 *
 * **Fault** is read off the **actual alarm list**, not invented. `assertedPlantAlarms`
 * is the same function the Alarms tab renders, so a card marked faulted here has a
 * row there and vice versa — and the four `SSU N Fault` addresses are positional, so
 * `SSU 3 Fault` lands on slot 3 and nowhere else. Every rectifier is
 * `NOT_REPORTED`; `subrackModule.type.ts` argues why at length, and it is the most
 * important thing this rack has to say about itself.
 */

/** How much hotter a module runs at its own full rating, °C. */
const FULL_LOAD_RISE_C = 9;

/** Half-width of the per-slot temperature scatter, °C — airflow across a shelf. */
const SLOT_SCATTER_C = 0.8;

/**
 * Which SSU slots the unit is currently asserting a fault against.
 *
 * Parsed out of the row's own label rather than its address, because the label is
 * what the gateway publishes and what every other screen keys on — and because the
 * addresses interleave (`SSU 1 Fault` at `0x5901`, `PV 1 Array Fault` at `0x5903`,
 * `SSU 2 Fault` at `0x5911`) so a stride calculation here would be a second copy of
 * arithmetic that already lives in `plantAlarms.ts`.
 *
 * `PV N Array Fault` is deliberately not read. It is the strings on the roof, not the
 * module in the slot — the pair is the device's best diagnostic precisely because the
 * two are separable, and marking a module faulted because the array behind it has a
 * dead string would throw that away. Those rows are on the array's own tab.
 */
const faultedSsuSlots = (
  siteId: string,
  role: SitePowerRole,
  handling: Record<string, AlarmHandling>,
): Set<number> => {
  const slots = new Set<number>();

  for (const row of assertedPlantAlarms(siteId, role, 'SITE', handling)) {
    const match = /^SSU (\d+) Fault$/.exec(row.name);
    if (match?.[1] !== undefined) slots.add(Number(match[1]));
  }

  return slots;
};

export const subrackModules = (
  cabinet: SubrackCabinet,
  role: SitePowerRole,
  handling: Record<string, AlarmHandling>,
): Array<SubrackModule> => {
  const faulted = faultedSsuSlots(cabinet.siteId, role, handling);
  const load = cabinet.loadKw ?? 0;

  // Each group's share, and only for the group that is actually converting.
  const rectifierShare =
    cabinet.carrying === 'RECTIFIERS' && cabinet.rectifiers > 0
      ? load / cabinet.rectifiers
      : 0;
  const ssuShare =
    cabinet.carrying === 'SSUS' && cabinet.ssus > 0 ? load / cabinet.ssus : 0;

  const build = (
    kind: SubrackModule['kind'],
    count: number,
    /** `Rectifier`, `SSU` — the word each module's own device calls it by. */
    noun: string,
    /** `r`, `s` — the id's stem, which no reader sees. */
    stem: string,
    outputKw: number,
    fault: (slot: number) => SubrackSlotFault,
  ): Array<SubrackModule> =>
    Array.from({length: count}, (_unused, index) => {
      const slot = index + 1;
      // Padded in the **id** only, so `…/r01` sorts beside `…/r12` in a log. The
      // label needs none: `R1` beside `R12` read as two naming schemes, which is why
      // the bank pads `M01`, but `Rectifier 1` beside `Rectifier 12` is plainly one
      // scheme with two numbers in it.
      const number = String(slot).padStart(String(count).length, '0');
      const scatter = (spread(cabinet.id, `cabinet/slot-temp/${stem}${slot}`) - 0.5) * 2;

      return {
        id: `${cabinet.id}/${stem}${number}`,
        label: `${noun} ${slot}`,
        kind,
        slot,
        outputKw,
        tempC:
          cabinet.tempC +
          (cabinet.rectifierKw > 0 ? outputKw / cabinet.rectifierKw : 0) * FULL_LOAD_RISE_C +
          scatter * SLOT_SCATTER_C,
        fault: fault(slot),
      };
    });

  return [
    ...build('RECTIFIER', cabinet.rectifiers, 'Rectifier', 'r', rectifierShare, () => 'NOT_REPORTED'),
    // `SSU 3`, not `Solar unit 3`, and the reason is the Alarms tab: the row a
    // reader is matching this card against says `SSU 3 Fault`, in the device's own
    // words, and history downstream is keyed on that raw string. A card that
    // renamed it would make the two screens name one module two ways. The plain
    // English is on the card's `Type` row, which is where an explanation belongs.
    ...build('SSU', cabinet.ssus, 'SSU', 's', ssuShare, (slot) =>
      faulted.has(slot) ? 'ASSERTED' : 'CLEAR',
    ),
  ];
};

/** How many slots the unit reports on individually — the honest denominator. */
export const reportedSlots = (modules: Array<SubrackModule>): number =>
  modules.filter((module) => module.fault !== 'NOT_REPORTED').length;
