import {spread} from '@/modules/genset/data/spread';
import type {BatteryBank} from '../types/bank.type';
import type {BatteryModule} from '../types/module.type';

/**
 * The modules a bank is built from, each with its own state of charge.
 *
 * Derived, like everything else about a bank — see `banks.ts`. `bank.modules` already
 * says how many there are and `bank.soc` already says where the pack sits; the only
 * thing this file adds is **how far apart the modules are inside that mean**, and it
 * gets that from the bank's health rather than from a new seed.
 *
 * ## The mean is the bank's charge, exactly
 *
 * Not approximately. The offsets below are dealt from the hash and then have their
 * own mean subtracted, so the modules average to `bank.soc` to the last decimal.
 * That is the estate's rule stated in the one place it would be easiest to break:
 * the strip, the dial, the register's charge column, the site diagram's `61%` and
 * these twelve tiles are one number, and a reader who mentally averaged the tiles
 * and got 64 would have caught the app lying to them.
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
 * So the band is a function of `soh` and nothing else, running from **±2 points at
 * the top of the health range to ±10 at the bottom** — the ends being
 * `hybridPlant`'s own `0.78`–`0.98`. The consequence is the point of drawing the
 * modules at all: the tired banks the register already sorts to the top are the
 * ones whose rack visibly disagrees with itself, and a reader moving from the
 * `State of health` row to these tiles sees the same fact twice, once as a
 * percentage and once as a shape.
 *
 * It is *not* a second random draw on top of the first. An estate where module
 * spread were seeded independently would put a ragged rack under a 96%-healthy bank
 * about as often as under a 79% one, and the diagram would then be decoration.
 */
const TIGHT_BAND = 0.02;
const LOOSE_BAND = 0.1;

/** The ends of `hybridPlant`'s health spread — see the note above. */
const HEALTHY_SOH = 0.98;
const TIRED_SOH = 0.78;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Half-width of the module spread at this bank's health, as a fraction of charge. */
const band = (soh: number): number => {
  const aged = clamp((HEALTHY_SOH - soh) / (HEALTHY_SOH - TIRED_SOH));
  return TIGHT_BAND + aged * (LOOSE_BAND - TIGHT_BAND);
};

/**
 * A bank's modules, in **rack order** — `M01` first, whatever their charge.
 *
 * Not sorted by charge, deliberately, though a sorted rack would make the spread
 * easier to read. The tiles carry the labels a technician opens a cabinet door and
 * reads, and a diagram that reorders them is a diagram you cannot take to site: the
 * whole use of finding `M07` low is knowing it is the seventh slot along. The range
 * is printed under the rack instead, which is the part sorting was going to buy.
 */
export const bankModules = (bank: BatteryBank): Array<BatteryModule> => {
  const half = band(bank.soh);
  // `M1` beside `M12` reads as a different naming scheme rather than a shorter
  // number, so the width comes from the count.
  const digits = String(bank.modules).length;

  const offsets = Array.from(
    {length: bank.modules},
    (_, index) => (spread(bank.id, `bank/module-soc/${index}`) - 0.5) * 2 * half,
  );
  const drift = offsets.reduce((total, offset) => total + offset, 0) / offsets.length;

  return offsets.map((offset, index) => {
    const number = String(index + 1).padStart(digits, '0');

    return {
      id: `${bank.id}/m${number}`,
      label: `M${number}`,
      // The clamp is a guard and not a behaviour: `hybridState` holds charge between
      // roughly 0.34 and 0.9, so a ±10-point band cannot reach either rail. It is
      // here so that a future model with a deeper discharge floor degrades to a flat
      // module rather than to a negative one.
      soc: clamp(bank.soc + offset - drift),
    };
  });
};

/** The lowest and highest module in a rack, `0`–`1` — the caption's range. */
export const moduleChargeRange = (
  modules: Array<BatteryModule>,
): {low: number; high: number} =>
  modules.reduce(
    (range, module) => ({
      low: Math.min(range.low, module.soc),
      high: Math.max(range.high, module.soc),
    }),
    {low: 1, high: 0},
  );
