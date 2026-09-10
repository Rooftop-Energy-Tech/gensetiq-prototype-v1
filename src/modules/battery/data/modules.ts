import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import {spread} from '@/modules/genset/data/spread';
import {isStanding} from '@/modules/genset/types/alarmState.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {enclosureTempC} from '@/modules/site/data/enclosure';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {BatteryBank} from '../types/bank.type';
import type {BatteryModule} from '../types/module.type';

/**
 * The modules a bank is built from, each with its own charge, health and
 * temperature.
 *
 * Derived, like everything else about a bank — see `banks.ts`. `bank.modules`
 * already says how many there are, `bank.soc` already says where the pack sits and
 * `bank.soh` already says how much of it is left; the only thing this file adds is
 * **how far apart the modules are inside those means**, and it gets that from the
 * bank's health rather than from a new seed.
 *
 * ## One draw per module, three scales
 *
 * This is the rule the whole file turns on. Each module gets exactly one number
 * out of the hash — `unit`, running −1 to +1 — and its charge, its health and its
 * temperature are all that number on different scales. A module at the bottom of
 * the draw is the emptiest, the sickest and the warmest of the rack; one at the top
 * is the fullest, healthiest and coolest.
 *
 * The alternative is three independent draws, and it is worth naming what it would
 * produce: a rack where the fullest module is regularly the one in worst health,
 * because nothing joins the columns. Three numbers per card that can contradict
 * each other are not three readings, they are noise with units on. `module.type.ts`
 * makes the same argument from the type's side.
 *
 * The physical story behind the sign is ordinary: a module that has lost capacity
 * has gained internal resistance, so it takes and gives back the same bus current
 * less efficiently, sits lower than its neighbours between balancing cycles, and
 * turns the difference into heat. Low, tired and warm are one condition seen three
 * ways, which is exactly what one draw expresses.
 *
 * ## Every mean is the bank's own figure, exactly
 *
 * Not approximately. `unit` has its own mean subtracted before anything is scaled
 * by it, so the modules average to `bank.soc` and to `bank.soh` to the last
 * decimal, and their mean temperature is the cabinet figure below with nothing
 * added. That is the estate's rule stated in the one place it would be easiest to
 * break: the strip, the glyph, the register's charge column, the site diagram's
 * `57%` and these thirteen cards are one number, and a reader who mentally averaged
 * the cards and got 60 would have caught the app lying to them.
 *
 * The one figure that is *not* a clean mean is `storedKwh`, because it is a product
 * of two of them — see its note in `module.type.ts`.
 *
 * ## Why the imbalance follows state of health
 *
 * A new pack is tight. Modules leave the factory matched, the BMS balances them
 * every cycle, and a percent or two is the whole story. What ages a pack is that
 * the modules stop ageing together: one cell string loses capacity faster than its
 * neighbours, the balancer runs out of authority to hold them level, and the spread
 * opens. By the time a bank is down to 78% health the drift is visible in the field
 * with a clamp meter.
 *
 * So every band below is a function of `soh` and nothing else, running from tight
 * at the top of the health range to loose at the bottom — the ends being
 * `hybridPlant`'s own `0.78`–`0.98`. The consequence is the point of drawing the
 * modules at all: the tired banks the register already sorts to the top are the
 * ones whose rack visibly disagrees with itself, and a reader moving from the
 * `State of health` row to these cards sees the same fact twice, once as a
 * percentage and once as a shape.
 *
 * It is *not* a second random draw on top of the first. An estate where module
 * spread were seeded independently would put a ragged rack under a 96%-healthy bank
 * about as often as under a 79% one, and the diagram would then be decoration.
 */

/** Charge spread, as a fraction of charge: ±2 points on a new pack, ±10 on a tired one. */
const TIGHT_SOC_BAND = 0.02;
const LOOSE_SOC_BAND = 0.1;

/**
 * Health spread, as a fraction: ±1 point on a new pack, ±6 on a tired one.
 *
 * Narrower than the charge band, and that ordering is the model. Health is the
 * slow quantity — it moves over years and a balancer cannot touch it — while
 * charge is what that lost capacity does to the pack *today*, amplified by every
 * cycle the balancer fails to level. A rack whose health spread was wider than its
 * charge spread would be describing a pack that had aged unevenly and then somehow
 * stayed in balance.
 */
const TIGHT_SOH_BAND = 0.01;
const LOOSE_SOH_BAND = 0.06;

/**
 * Temperature spread, °C: ±1.5 on a new pack, ±4.5 on a tired one.
 *
 * The end of the range is what a technician with an infrared thermometer would
 * call a finding rather than a reading — three degrees between the coolest and
 * warmest module in a cabinet is normal airflow, nine is a module to look at.
 */
const TIGHT_TEMP_SPAN_C = 1.5;
const LOOSE_TEMP_SPAN_C = 4.5;

/** The ends of `hybridPlant`'s health spread — see the note above. */
const HEALTHY_SOH = 0.98;
const TIRED_SOH = 0.78;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Where this bank sits between a new pack and a tired one, `0`–`1`. */
const aged = (soh: number): number => clamp((HEALTHY_SOH - soh) / (HEALTHY_SOH - TIRED_SOH));

/** A band's half-width at this bank's health, interpolated between its two ends. */
const band = (soh: number, tight: number, loose: number): number =>
  tight + aged(soh) * (loose - tight);

/**
 * The battery cabinet the rack sits in, before any module's own offset.
 *
 * `enclosureTempC` is shared with the **subrack** cabinet, which is a different box
 * on the same pad — the modules are in `ESC330-D6` cabinets and the rectifiers and
 * SSUs are in the `ICC330-H1-C8`. Same rule, its own salt, its own duty, so the two
 * read separately and cannot be mistaken for one measurement.
 *
 * The salt is unchanged from when this arithmetic lived here, so no module's
 * temperature moves by extracting it.
 *
 * Duty is guarded rather than assumed: `continuousKw` is a rounded product and a
 * bank small enough to round to zero would otherwise make the term infinite.
 */
const cabinetC = (bank: BatteryBank): number =>
  enclosureTempC(
    bank.id,
    'bank/cabinet-temp',
    bank.continuousKw > 0 ? Math.abs(bank.powerKw) / bank.continuousKw : 0,
  );

/**
 * A bank's modules, in **rack order** — `M01` first, whatever their condition.
 *
 * Not sorted by charge, deliberately, though a sorted rack would make the spread
 * easier to read. The cards carry the labels a technician opens a cabinet door and
 * reads, and a diagram that reorders them is a diagram you cannot take to site: the
 * whole use of finding `M07` low is knowing it is the seventh slot along. The range
 * is printed under the rack instead, and the low module is marked where it stands,
 * which is together the part sorting was going to buy.
 */
export const bankModules = (bank: BatteryBank): Array<BatteryModule> => {
  const socHalf = band(bank.soh, TIGHT_SOC_BAND, LOOSE_SOC_BAND);
  const sohHalf = band(bank.soh, TIGHT_SOH_BAND, LOOSE_SOH_BAND);
  const tempHalf = band(bank.soh, TIGHT_TEMP_SPAN_C, LOOSE_TEMP_SPAN_C);
  const cabinet = cabinetC(bank);

  // `M1` beside `M12` reads as a different naming scheme rather than a shorter
  // number, so the width comes from the count.
  const digits = String(bank.modules).length;

  // The one draw per module, −1 to +1, and the salt is unchanged from when charge
  // was the only thing it fed: a bank's rack must not reshuffle itself because two
  // more figures were hung off the same number.
  const draws = Array.from(
    {length: bank.modules},
    (_, index) => (spread(bank.id, `bank/module-soc/${index}`) - 0.5) * 2,
  );
  const drift = draws.reduce((total, draw) => total + draw, 0) / draws.length;

  return draws.map((draw, index) => {
    const number = String(index + 1).padStart(digits, '0');
    // Centred, so every mean below is the bank's own figure and not a figure near it.
    const unit = draw - drift;

    // The clamps are guards and not behaviours: `hybridState` holds charge between
    // roughly 0.34 and 0.9 and health between 0.78 and 0.98, so neither a ±10-point
    // charge band nor a ±6-point health band can reach a rail. They are here so that
    // a future model with a deeper discharge floor degrades to a flat module rather
    // than to a negative one.
    const soc = clamp(bank.soc + unit * socHalf);
    const soh = clamp(bank.soh + unit * sohHalf);

    return {
      id: `${bank.id}/m${number}`,
      label: `M${number}`,
      soc,
      soh,
      // Minus the offset, not plus: the low module is the warm one. See the header.
      tempC: cabinet - unit * tempHalf,
      storedKwh: bank.moduleKwh * soh * soc,
    };
  });
};

/**
 * Which modules the unit is asserting a fault against, and the row that says so.
 *
 * The bank's half of `faultedSsuSlots`, and deliberately the same shape of thing: one
 * positional row per module, read off the **actual alarm list** rather than derived,
 * so a card marked faulted here has a row on the Alarms tab and vice versa.
 * `lithiumSpecs` generates `Lithium Battery 4 Abnormal` from the unit's own module
 * count, which is why the join lands on a module that exists.
 *
 * Parsed out of the row's **label** rather than its address, for the reason the
 * cabinet's version gives: the label is what the gateway publishes and what every
 * other screen keys on, and an address stride here would be a second copy of
 * arithmetic that already lives in `plantAlarms.ts`.
 *
 * ## Why this returns the row and not a boolean
 *
 * Because both drawings need more than *whether*. It was written for the card rack,
 * which had no panel to defer to: a card in a wrapping grid has to carry the register
 * name, the link and the severity itself or not at all, so the row came back whole and
 * the card printed its published name.
 *
 * The bank has a panel now — `ModuleCabinets` draws the line-up with `ModuleSlotPanel`
 * beside it, the shape the subrack has had since its own card rack was replaced — and
 * the answer does not change. The panel names the register and links to the tab, and
 * the *slot* still needs the severity to take its edge and tint from. One row, read by
 * the drawing and the panel together, is what keeps them agreeing.
 *
 * ## Why standing rather than asserted
 *
 * `assertedPlantAlarms` includes rows somebody has cleared — that is what the Alarms
 * tab's second table is — and a module marked faulted after its row has been dealt
 * with is the two screens disagreeing about the same alarm. Clearing
 * `Lithium Battery 4 Abnormal` on the tab unmarks `M04` on the way back, which is the
 * behaviour a reader will check first.
 *
 * ## Why a parenthesised prefix is skipped before matching
 *
 * **Which module a row is about is a property of the register, not of how the row is
 * labelled**, so the match steps over a leading `(...)` marker rather than failing on it.
 *
 * `demoPlantAlarms.ts` names its invented rows `(test) Lithium Battery 2 Abnormal` so
 * nobody reads a fabricated warning as a BMS actually complaining, and with the pattern
 * anchored hard at `Lithium` those rows silently stop marking their cards — the rack goes
 * unmarked while the Alarms tab lists the faults, which is the exact disagreement the rest
 * of this function is built to prevent. The array page hit this first and
 * `junctionBoxes.faultedBoxes` carries the same guard.
 *
 * The tolerance is narrow: a parenthesised group and optional space, then the register
 * name exactly. `Spare Lithium Battery 2 Abnormal` does not match, and neither does
 * `Lithium Battery 2 Abnormal cleared`.
 *
 * ## What it returns where nothing is watching
 *
 * An empty map, at the twenty-four sites with no monitoring unit — and the rack must
 * not draw that as a clean bill of health. `BankAlarms` makes the argument at length;
 * `ModuleRack`'s caption is the other half of it.
 */
export const faultedModules = (
  bank: BatteryBank,
  role: SitePowerRole,
  handling: Record<string, AlarmHandling>,
): ReadonlyMap<number, AlarmView> => {
  const faults = new Map<number, AlarmView>();

  for (const row of assertedPlantAlarms(bank.id, role, 'BATTERY', handling)) {
    if (!isStanding(row)) continue;

    const match = /^(?:\([^)]*\)\s*)?Lithium Battery (\d+) Abnormal$/.exec(row.name);
    if (match?.[1] !== undefined) faults.set(Number(match[1]), row);
  }

  return faults;
};

/** The lowest and highest of a numeric reading across a rack — the caption's ranges. */
const rangeOf = (
  modules: Array<BatteryModule>,
  read: (module: BatteryModule) => number,
): {low: number; high: number} =>
  modules.reduce(
    (range, module) => ({
      low: Math.min(range.low, read(module)),
      high: Math.max(range.high, read(module)),
    }),
    {low: Number.POSITIVE_INFINITY, high: Number.NEGATIVE_INFINITY},
  );

/** The lowest and highest module in a rack, `0`–`1`. */
export const moduleChargeRange = (
  modules: Array<BatteryModule>,
): {low: number; high: number} => rangeOf(modules, (module) => module.soc);

/** The coolest and warmest module in a rack, °C. */
export const moduleTempRange = (
  modules: Array<BatteryModule>,
): {low: number; high: number} => rangeOf(modules, (module) => module.tempC);

/**
 * How far under the pack a module has to sit before it is called out: **5 points.**
 *
 * An absolute line rather than a rank or a multiple of the rack's own spread, and
 * that is the whole of the decision. Marking the lowest module of every rack as a
 * problem would put a warning on all seven banks on this estate including the pack
 * sitting at 54–60%, which is a healthy pack — and a badge that is always lit is a
 * badge nobody reads. Scaling the line to the rack's spread has the same fault
 * wearing arithmetic: a tight pack would always have an outlier because some module
 * has to be last.
 *
 * Five points is roughly where field practice puts a module imbalance worth
 * investigating, and on this estate it fires exactly where it should: nothing on
 * the four banks above 90% health, and the low module on the two around 80%.
 */
export const IMBALANCE_POINTS = 5;
