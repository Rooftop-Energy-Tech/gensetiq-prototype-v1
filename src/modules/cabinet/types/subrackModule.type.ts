/**
 * One module plugged into the cabinet's shelf.
 *
 * ## Two kinds in one rack, which is the point
 *
 * A rectifier turns the incomer or the genset's AC into −48 V; an SSU turns the
 * array's DC into the same −48 V. They are different jobs and they sit in the same
 * shelf on the same backplane, which is exactly why the SSU alarms moved out of
 * Solar: the person who swaps one is the person who swaps the other.
 *
 * So they are one type with a `kind` rather than two racks. A reader looking at this
 * cabinet is asking *what is converting for this tower*, and the answer is a shelf
 * with ten modules in it of which some subset is working.
 */
export type SubrackSlotKind = 'RECTIFIER' | 'SSU';

/**
 * Whether the monitoring unit reports a fault **against this slot**.
 *
 * Three values, and the third is the honest one. `NOT_REPORTED` is a slot the device
 * says nothing per-module about — and it is every rectifier, for a reason worth
 * stating on the type:
 *
 * **Rectifier addresses are hand-set on the LCD**, 1–60, by watching an indicator
 * blink, and nobody has confirmed the six at this site were addressed. The register
 * map has thirty per-rectifier alarm registers and the poll set deliberately takes
 * none of them, because "Rectifier 3 Fault" against an unconfirmed address is a real
 * value under a wrong name — worse than no data. What the unit does report is the
 * shelf as a **group**: missing, abnormal, comms failure, low capacity.
 *
 * **SSU identity is positional** — each module reads its own slot off detection and
 * power-identifying pins — so `SSU 3 Fault` reliably means the module in slot 3, and
 * those four rows are in the poll set. That asymmetry is the whole difference between
 * the two halves of this rack, and a page that quietly drew every rectifier as
 * healthy would be inventing the reassurance.
 */
export type SubrackSlotFault = 'ASSERTED' | 'CLEAR' | 'NOT_REPORTED';

export type SubrackModule = {
  /** `sbh-1336/r3` — unique across the estate, for a key and nothing more. */
  id: string;
  /**
   * `Rectifier 3`, `SSU 2` — the slot as a technician at the open cabinet counts it.
   *
   * Each in **its own device's word**. `SSU` rather than `Solar unit` because that is
   * what the alarm row beside it says — `SSU 2 Fault` — and matching a card to the
   * row that sent you to it is the whole use of a label here.
   */
  label: string;
  kind: SubrackSlotKind;
  /** 1-based position in its own group, which is what the alarm rows index. */
  slot: number;
  /**
   * What this module is delivering right now, kW.
   *
   * The tower's load divided across whichever group is **carrying** — see
   * `SubrackCabinet.carrying`. The other group reads `0`, which is not a fault: a
   * rectifier shelf idling behind a generating array is the plant working correctly,
   * and it is the state that makes `Low Rectifier Capacity` ambiguous enough for the
   * source document to want it watched on the first live run.
   */
  outputKw: number;
  /** The module's own temperature — the enclosure's, plus its own work. */
  tempC: number;
  fault: SubrackSlotFault;
};
