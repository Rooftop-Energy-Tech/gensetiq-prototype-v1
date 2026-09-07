/**
 * One module inside a bank — a single rack module, with its own charge.
 *
 * ## Why the bank still owns the register, and this is not a `BatteryModule` page
 *
 * `bank.type.ts` argues that the bank is the leaf of the estate: it is what is
 * quoted, commissioned and failed, and a register with a row per module would be a
 * stores list. Nothing here reverses that. A module has no page, no id in a URL, no
 * alarms and no history — it exists only *inside* its bank's page, as the answer to
 * a question the bank's single percentage cannot answer on its own.
 *
 * That question is **imbalance**. A bank reading 61% is either twelve modules all
 * sitting at 61, or eleven at 64 and one at 38 dragging the pack down and about to
 * take the site with it. The two are the same number on the strip, the same dial
 * and the same row in the register, and they are completely different jobs. So the
 * modules are drawn on the bank's home page and nowhere else — see `ModuleRack`.
 *
 * ## What is deliberately not here
 *
 * No temperature, no voltage, no cycle count, no per-module state of health, no
 * serial. Every one of those is a real field on a real BMS and inventing them here
 * would be inventing readings: this model has one source for a bank's condition
 * (`hybridState`) and nothing underneath it that could disagree. Charge is derivable
 * from what the bank already knows — see `modules.ts` — and the rest is not.
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
};
