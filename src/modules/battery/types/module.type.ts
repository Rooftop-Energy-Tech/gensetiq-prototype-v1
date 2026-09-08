/**
 * One module inside a bank — a single rack module, with its own condition.
 *
 * ## Why the bank still owns the register, and this is not a `BatteryModule` page
 *
 * `bank.type.ts` argues that the bank is the leaf of the estate: it is what is
 * quoted, commissioned and failed, and a register with a row per module would be a
 * stores list. Nothing here reverses that. A module has no page, no id in a URL, no
 * alarms and no history — it exists only *inside* its bank's page, as the answer to
 * a question the bank's single percentage cannot answer on its own.
 *
 * That question is **imbalance**. A bank reading 57% is either thirteen modules all
 * sitting at 57, or twelve at 60 and one at 38 dragging the pack down and about to
 * take the site with it. The two are the same number on the strip, the same glyph
 * and the same row in the register, and they are completely different jobs. So the
 * modules are drawn on the bank's home page and nowhere else — see `ModuleRack`.
 *
 * ## Four figures now, from one draw
 *
 * This type used to be `{id, label, soc}` and its own note said so at length: no
 * temperature, no per-module state of health, because "every one of those is a real
 * field on a real BMS and inventing them here would be inventing readings".
 *
 * The position has moved and it is worth being exact about what changed. **They are
 * still derived**, and they are still not measurements. What is different is that
 * they are no longer *independent* inventions: `modules.ts` deals one number per
 * module and every figure below is that same number read through a different scale.
 * So a module cannot be the fullest and the sickest at once, the mean of the
 * modules' health is the bank's health to the last decimal, and a rack that looks
 * ragged looks ragged in all three columns at the same time.
 *
 * The distinction matters because the objection the old note raised was real and it
 * was about **contradiction**, not about derivation — this whole data layer is
 * derived. A per-module temperature drawn from its own seed would have put a hot
 * module at the top of the rack and a cold one at the bottom with nothing joining
 * them, which is noise with units on it. One draw, three scales, is a model.
 *
 * ## What is still not here
 *
 * No voltage, no cycle count, no serial. Cycles and serials have no source at all.
 * Voltage has one and it is the reason to leave it off: these modules sit in
 * **parallel** on a −48 V bus, so every module in a rack is at the same terminal
 * voltage by definition. Thirteen cards each reading `53.4 V` would be the bus
 * voltage printed thirteen times — a column with no information in it, which is
 * worse than a column that is missing.
 */
export type BatteryModule = {
  /** `sbh-1553/m03` — unique across the estate, for a key and nothing more. */
  id: string;
  /** `M03` — the number stencilled on the module's own faceplate, so a technician
   *  sent to replace one knows which slot to open. Padded to the width of the
   *  bank's count, so a rack of twelve reads `M01`–`M12` and never `M1` beside
   *  `M12`. */
  label: string;
  /** State of charge, `0`–`1`. The bank's `soc` is the mean of these. */
  soc: number;
  /**
   * State of health, `0`–`1` — what this module still holds against its nameplate.
   *
   * The bank's `soh` is the mean of these, exactly, for the reason `modules.ts`
   * gives about the charge: a reader who averaged the cards and got a different
   * number from the details band would have caught the app lying to them.
   *
   * It is the figure that **explains** the charge column rather than repeating it.
   * A module three points under the pack is a fact; a module three points under the
   * pack *and* four points down on health is a module to quote for.
   */
  soh: number;
  /**
   * Module temperature, °C.
   *
   * The bank has no measured temperature to divide up — its monitoring unit polls
   * two probes for the whole cabinet, not one per module — so this is derived like
   * the rest: a cabinet baseline for the site, a rise for how hard the bank is
   * working, and the module's own offset. See `modules.ts` for each.
   *
   * Warm is the *low* end of the draw, not the high one: the module that has lost
   * capacity has more internal resistance, so it dissipates more of the same
   * current as heat. That is what makes the three columns one story rather than
   * three — the low module is the tired module is the warm module.
   */
  tempC: number;
  /**
   * What is actually in this module right now, kWh.
   *
   * Nameplate × health × charge, and the health term is the part worth stating.
   * `BatteryBank.kwh` is deliberately **not** discounted by health — that note
   * explains why an ageing pack must not quietly shrink every figure on the page —
   * but a card that prints a module's health two lines above cannot then print an
   * energy that ignores it. A 7.15 kWh module at 90% health cannot hold 7.15 kWh
   * however full it is.
   *
   * So the rack's total is a fraction of a percent above `kwh × soh × soc`: the
   * mean of the products is not quite the product of the means. It is not printed
   * as a total anywhere, precisely because it would invite that subtraction.
   */
  storedKwh: number;
};
