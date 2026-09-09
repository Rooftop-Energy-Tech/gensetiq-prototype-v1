# SMU02C alarms: what went in, why, and what comes out

**Firmware 0.3.43, `hw-v2-MQTT-EXT1-TELCOIQ-HUAWEI-SMU02C`, 2026-09-07.**
**Not built, not committed, not flashed** — `dyna-gw-001` still runs 0.3.21.

The SMU02C poll table went from **19 entries with zero alarms** to **80 entries with 58**. This is the reasoning behind each choice, what the gateway publishes, and what Helios must not do with it.

| | |
|---|---|
| Table entries | **80** of `MAX_MODBUS_REGISTERS` = 100 |
| Modbus registers | **89** (U32 counts 2, U64 counts 4) |
| Alarm rows | **58** |
| Telemetry rows | **22** |
| Transactions per window | **80** — one FC3 each, nothing coalesced |

> ## 🛑 Stop adding rows until the poll window is measured
>
> The 100-register cap is no longer the constraint. **80 single-register FC3 transactions at 9600 baud against a 60-second window is.** `accumulateDeviceRange()` issues one transaction per entry and coalesces nothing, even where addresses are contiguous — the thirteen lithium rows and the four LVD pairs are adjacent and still cost one round trip each.>
> **Measure one full sweep on the first live run before adding anything else.**

---

## The rule every choice was made against

From the register map's section 18.6:

> **An alarm reading `0` is ambiguous three ways — healthy, hardware not fitted, or not supported on this build — and nothing in the protocol separates them.**

A `1` is always believable; something asserted it. The `0` is the problem. Only two things resolve it:

1. **An enable register**, where one exists. Only the LVD ladder has them.
2. **A measurement already in the poll set** that the alarm must agree with. Free — we are already reading it.

So every alarm below is graded on **what can catch it lying**:

| Grade | Count | Meaning |
|---|---|---|
| **both ways** | 11 | A polled register must agree. Contradiction is detectable continuously, in both directions. Trust these. |
| **partial** | 22 | A polled register should move, but not decisively. Suggestive. |
| **on demand** | 11 | An enable register exists and would settle it — but is not read yet. |
| **one way only** | 14 | Nothing can contradict it. Act on a `1`; conclude nothing from a `0`. |

⚠️ **14 of 58 alarms are one-way only.** That is the single most important fact in this document.

---

## Categories

Four buckets, so an alarm can be routed to whoever fixes that thing. **The count is
lopsided on purpose** — it reflects what the SMU02C actually instruments.

| Category | Alarms | What it covers |
|---|---|---|
| **Battery** | 28 | The bank, its protection ladder and its own modules — `0x5021`, the six `0x5500` rows, all eight LLVD, both BLVD, and the thirteen per-module lithium rows |
| **Site** | 17 | The plant, the cabinet and the load — both surge protectors, DC bus voltage, load fuse, door/water/smoke, the four rectifier rows, and **`SSU Lost` plus the four `SSU N Fault` rows** |
| **Genset** | 9 | The nine per-phase AC alarms |
| **Solar** | 4 | The four `PV N Array Fault` rows |

### 🆕 The rule the buckets are drawn on: where the thing physically is

**Anything that is a module in the subrack or inside the power cabinet is Site**
(Jeff, 2026-09-08). Not what it converts, not what it feeds — where an engineer has
to stand to touch it. That is what a category is *for* in this document: routing an
alarm to whoever fixes that thing.

Applied to J1PT's hardware, which the datasheets settle:

| Where it is | What is in there | Category |
|---|---|---|
| **`ICC330-H1-C8`** — the power cabinet and its subrack, everything on the SMU's internal CAN bus | rectifier shelf, **the four SSU modules**, `DCDU-600AN1` distribution, both SPDs, the SMU itself | **Site** |
| **`ESC330-D6`** × 2 — the separately ventilated battery cabinets | the thirteen `CloudLi-ESM-48150B1` modules and the bank's protection ladder | **Battery** |
| **On the roof** | 15 strings, 4 junction boxes, string fuses, DC wiring | **Solar** |
| **In the yard** | the 30 kVA set | **Genset** |

🎯 **This is what moved the five SSU rows out of Solar.** An SSU is a plug-in
converter in the same shelf as the rectifiers — it reads its own slot off detection
and power-identifying pins, which is why identity is positional — so `SSU 3 Fault` is
a module to swap in the cabinet, and the person dispatched is the person who swaps a
rectifier. It is not a solar problem in any sense that changes who goes or what they
carry.

⚠️ **`PV N Array Fault` deliberately did not move, and the pair is now split across
two categories.** That is the point rather than a casualty of it: `0x5901` and
`0x5903` are sixteen addresses apart and describe two different jobs — a module in a
rack, and a dead string or a blown string fuse in a junction box on the roof. Filing
them together only ever made sense because they share a stride.

🛑 **What the split costs: the `SSU N` / `PV N` pair is the device's best diagnostic
and it now spans a category boundary.** SSU 3 faulted with PV 3 clear is a module to
swap; PV 3 faulted with SSU 3 clear is a string to trace; both asserted is the
ambiguous case. Anything routing on category alone will send those to two different
queues. **Whatever presents these must keep the pair readable together** — the same
problem `0x500F` already has as the precursor to the Battery-category LVD ladder.

**Four assignments are judgement calls, not readings off the map:**

- 🛑 **The nine per-phase AC alarms are filed under Genset, and that is site-dependent.**
  Huawei calls them mains alarms because the SMU assumes a utility. **There is no grid at
  J1PT** (Jeff, 2026-09-02) — the generator is the only AC source, so these describe the
  genset's output quality, and a phase failure is a dropped phase on the set. ⚠️ **Add a
  grid connection here, or reuse this table at a site that has one, and all nine become
  Site.** Same trap as the `0x4024` label; see the site-dependence note in
  `shared-knowledge/product-telcoiq/hardware/`.
- **The four rectifier rows sit under Site**, and as of 2026-09-08 that is the rule
  rather than a fallback. `0x5020`, `0x5100`, `0x5101` and `0x5102` are about the shelf
  in the cabinet, which is the plant. The earlier reasoning here was weaker — *neither
  the battery nor the generator, and there is no Rectifier bucket* — and it landed in
  the right place for the wrong reason. If rectifier faults ever need their own
  dispatch path they should become a **fifth category**, not be spread across the
  other four.
- 🆕 **`SSU Lost` and the four `SSU N Fault` rows sit under Site for the same reason,
  and they used to sit under Solar.** They are modules in the same shelf as the
  rectifiers. What made the old filing tempting is that an SSU converts *solar* — but
  that is what it converts, not where it is or who swaps it. See the location table
  above, and the note on what splitting the `SSU N` / `PV N` pair costs.
- ⚠️ **`0x500E` / `0x500F` DC bus voltage are filed under Site, and this one is genuinely
  arguable.** In a −48 V plant the battery sits directly across the bus, so bus voltage
  *is* roughly battery terminal voltage — a fair case for Battery. They are Site because
  of what they tell you to go and look at: **a low bus is a generation-versus-load
  problem, not a battery fault.** The battery is doing its job by sagging. 🎯 **`0x500F`
  is the precursor to the Battery-category LVD ladder**, so an operator seeing it should
  expect LLVD rows next — one of **two** places the category boundary cuts across a
  causal chain, the other being the `SSU N` / `PV N` pair above.

**Category and severity are independent.** Route on category, rank on severity — and
⚠️ **re-rank the severities first**, per §5: `0x5900` SSU Lost ships as a mere `WA` at a
site where solar is the primary source.

---

## Every alarm chosen

Ordered by address, as the table is. All are booleans — `0x00` normal, `0x01` asserted — and all take the **most recent read**, never the window mean: averaging a boolean would publish `0.4` for a fault that appeared partway through a window, which is neither true nor false.

| Addr | Label | **Category** | Sev | Why it is here | Checkable |
|---|---|---|---|---|---|
| `0x5000` | AC SPD Fault | **Site** | MA | Surge arrester on the AC input is spent. Plant runs normally, site unprotected. | **one way only** |
| `0x5001` | DC SPD Fault | **Site** | MA | Surge arrester on the -48 V side is spent. | **one way only** |
| `0x5003` | AC L1 Overvoltage | **Genset** | MI | Phase L1 voltage too high. At J1PT this is the genset straining, not mains. | **one way only** |
| `0x5004` | AC L2 Overvoltage | **Genset** | MI | Phase L2 voltage too high. | **one way only** |
| `0x5005` | AC L3 Overvoltage | **Genset** | MI | Phase L3 voltage too high. | **one way only** |
| `0x5006` | AC L1 Undervoltage | **Genset** | MI | Phase L1 voltage too low. | **one way only** |
| `0x5007` | AC L2 Undervoltage | **Genset** | MI | Phase L2 voltage too low. | **one way only** |
| `0x5008` | AC L3 Undervoltage | **Genset** | MI | Phase L3 voltage too low. | **one way only** |
| `0x5009` | AC L1 Phase Failure | **Genset** | MA | Phase L1 gone. On a genset this is a dropped phase; rectifiers carry the site on two. | **one way only** |
| `0x500A` | AC L2 Phase Failure | **Genset** | MA | Phase L2 gone. | **one way only** |
| `0x500B` | AC L3 Phase Failure | **Genset** | MA | Phase L3 gone. | **one way only** |
| `0x500E` | DC Overvoltage Alarm | **Site** | MI | DC bus pushed too high by the rectifiers. Risk is to the load. | **both ways** |
| `0x500F` | DC Undervoltage Alarm | **Site** | MA | DC bus sagging: less arriving than leaving. The state that precedes an LLVD trip. | **both ways** |
| `0x5010` | Load Fuse Break | **Site** | MA | A fuse on one DC load feed has blown. That circuit is dead; everything else reads normal. | **partial** |
| `0x5011` | Door Alarm | **Site** | MA | Cabinet door open. | **on demand** |
| `0x5012` | Water Alarm | **Site** | CA | Water ingress. One of only two CA alarms on the device. | **one way only** |
| `0x5013` | Smoke Alarm | **Site** | CA | Smoke. The other CA alarm. | **one way only** |
| `0x5017` | LLVD1 Warning | **Battery** | MA | LLVD1 about to shed its load stage. Site still up -- the actionable one. | **on demand** |
| `0x5018` | LLVD1 Disconnected | **Battery** | MA | LLVD1 has shed. That equipment is off the air. | **on demand** |
| `0x5019` | LLVD2 Warning | **Battery** | MA | LLVD2 about to shed. | **on demand** |
| `0x501A` | LLVD2 Disconnected | **Battery** | MA | LLVD2 has shed. | **on demand** |
| `0x5020` | Low Rectifier Capacity | **Site** | MA | Rectifier redundancy lost -- spare capacity above load has fallen below threshold. | **both ways** |
| `0x5021` | Battery Discharge Alarm | **Battery** | MA | Bank is discharging. Normal at night; the leading edge of the LVD sequence. | **both ways** |
| `0x5032` | LLVD3 Warning | **Battery** | MA | LLVD3 about to shed. | **on demand** |
| `0x5033` | LLVD3 Disconnected | **Battery** | MA | LLVD3 has shed. | **on demand** |
| `0x5034` | LLVD4 Warning | **Battery** | MA | LLVD4 about to shed. | **on demand** |
| `0x5035` | LLVD4 Disconnected | **Battery** | MA | LLVD4 has shed. | **on demand** |
| `0x5036` | Lithium Battery 1 Abnormal | **Battery** | MA | Module 1's own BMS reports a problem with itself. | **partial** |
| `0x5037` | Lithium Battery 2 Abnormal | **Battery** | MA | Module 2's own BMS reports a problem with itself. | **partial** |
| `0x5038` | Lithium Battery 3 Abnormal | **Battery** | MA | Module 3's own BMS reports a problem with itself. | **partial** |
| `0x5039` | Lithium Battery 4 Abnormal | **Battery** | MA | Module 4's own BMS reports a problem with itself. | **partial** |
| `0x503A` | Lithium Battery 5 Abnormal | **Battery** | MA | Module 5's own BMS reports a problem with itself. | **partial** |
| `0x503B` | Lithium Battery 6 Abnormal | **Battery** | MA | Module 6's own BMS reports a problem with itself. | **partial** |
| `0x503C` | Lithium Battery 7 Abnormal | **Battery** | MA | Module 7's own BMS reports a problem with itself. | **partial** |
| `0x503D` | Lithium Battery 8 Abnormal | **Battery** | MA | Module 8's own BMS reports a problem with itself. | **partial** |
| `0x503E` | Lithium Battery 9 Abnormal | **Battery** | MA | Module 9's own BMS reports a problem with itself. | **partial** |
| `0x503F` | Lithium Battery 10 Abnormal | **Battery** | MA | Module 10's own BMS reports a problem with itself. | **partial** |
| `0x5040` | Lithium Battery 11 Abnormal | **Battery** | MA | Module 11's own BMS reports a problem with itself. | **partial** |
| `0x5041` | Lithium Battery 12 Abnormal | **Battery** | MA | Module 12's own BMS reports a problem with itself. | **partial** |
| `0x5042` | Lithium Battery 13 Abnormal | **Battery** | MA | Module 13's own BMS reports a problem with itself. | **partial** |
| `0x5100` | Rectifier Missing | **Site** | MA | The SMU expected a rectifier and cannot find it. | **both ways** |
| `0x5101` | Rectifier Abnormal | **Site** | MA | At least one rectifier is unwell, without saying which. | **both ways** |
| `0x5102` | Rectifiers Comms Failure | **Site** | MA | SMU has lost the internal CAN bus to every rectifier and is BLIND. | **both ways** |
| `0x5500` | Battery High Temperature | **Battery** | MI | Bank too hot, by the plant's own definition. | **both ways** |
| `0x5501` | Battery Temp Sensor Fault | **Battery** | MA | The temperature sensor itself has failed. The plant is thermally blind. | **both ways** |
| `0x5502` | BLVD Disconnected | **Battery** | MA | BLVD has disconnected the battery. Site dark, bank saved. | **on demand** |
| `0x5503` | BLVD Warning | **Battery** | MA | BLVD about to disconnect. Site still up. Last chance. | **on demand** |
| `0x5505` | Battery Low Temperature | **Battery** | MI | Bank too cold. | **both ways** |
| `0x5506` | Battery Fuse Blown | **Battery** | MA | Fuse between bank and busbar is open. The battery is no longer part of the plant. | **one way only** |
| `0x5900` | SSU Lost | **Site** | WA | A solar module has fallen off the bus. | **both ways** |
| `0x5901` | SSU 1 Fault | **Site** | MA | SSU 1 itself has failed and is not converting. | **partial** |
| `0x5903` | PV 1 Array Fault | **Solar** | MA | The panels and wiring feeding SSU 1 -- a dead string, blown string fuse, junction box. | **partial** |
| `0x5911` | SSU 2 Fault | **Site** | MA | SSU 2 itself has failed and is not converting. | **partial** |
| `0x5913` | PV 2 Array Fault | **Solar** | MA | The panels and wiring feeding SSU 2 -- a dead string, blown string fuse, junction box. | **partial** |
| `0x5921` | SSU 3 Fault | **Site** | MA | SSU 3 itself has failed and is not converting. | **partial** |
| `0x5923` | PV 3 Array Fault | **Solar** | MA | The panels and wiring feeding SSU 3 -- a dead string, blown string fuse, junction box. | **partial** |
| `0x5931` | SSU 4 Fault | **Site** | MA | SSU 4 itself has failed and is not converting. | **partial** |
| `0x5933` | PV 4 Array Fault | **Solar** | MA | The panels and wiring feeding SSU 4 -- a dead string, blown string fuse, junction box. | **partial** |

### The corroboration notes, in full

- **`0x5000` AC SPD Fault** — SPD is datasheet-confirmed fitted (30 kA AC in), so "not fitted" is ruled out. No live partner.
- **`0x5001` DC SPD Fault** — Same: fitted (10/20 kA DC out) is confirmed, health vs unsupported is not.
- **`0x5003` AC L1 Overvoltage** — Per-phase voltages 0x1006-0x1008 are NOT polled, so nothing can contradict a 0.
- **`0x5004` AC L2 Overvoltage** — As above.
- **`0x5005` AC L3 Overvoltage** — As above.
- **`0x5006` AC L1 Undervoltage** — As above.
- **`0x5007` AC L2 Undervoltage** — As above.
- **`0x5008` AC L3 Undervoltage** — As above.
- **`0x5009` AC L1 Phase Failure** — As above. Highest-value of the nine.
- **`0x500A` AC L2 Phase Failure** — As above.
- **`0x500B` AC L3 Phase Failure** — As above.
- **`0x500E` DC Overvoltage Alarm** — 0x1000 System DC Voltage is polled. Threshold 0x2108, default 58 V.
- **`0x500F` DC Undervoltage Alarm** — 0x1000. Threshold 0x2109, default 45 V. Section 18.6 names this as needing no confirmation.
- **`0x5010` Load Fuse Break** — 0x1001 Total DC Load Current should step down. Averaged, so a mid-window failure blurs.
- **`0x5011` Door Alarm** — 0x2251 Door Sensor is a 0/1 enable flag. Not read yet.
- **`0x5012` Water Alarm** — Port may be unpopulated. A 0 is worthless until someone looks.
- **`0x5013` Smoke Alarm** — As above.
- **`0x5017` LLVD1 Warning** — Enable 0x2100 (default 1). Mode 0x210C decides what "about to" even means.
- **`0x5018` LLVD1 Disconnected** — Enable 0x2100. Disconnect 45.0 V, reconnect 51.5 V.
- **`0x5019` LLVD2 Warning** — Enable 0x2103 DEFAULTS TO 0. On a stock plant this reads 0 forever.
- **`0x501A` LLVD2 Disconnected** — Enable 0x2103, default disabled. Same caveat.
- **`0x5020` Low Rectifier Capacity** — Now checkable: 0x1101 Rectifier Amount was added alongside, should read 6.
- **`0x5021` Battery Discharge Alarm** — 0x1401 Total Battery Current is polled and its SIGN is the same fact.
- **`0x5032` LLVD3 Warning** — Enable 0x2116 (default 1), mode 0x2119.
- **`0x5033` LLVD3 Disconnected** — Enable 0x2116.
- **`0x5034` LLVD4 Warning** — Enable 0x211E (default 1), mode 0x2121.
- **`0x5035` LLVD4 Disconnected** — Enable 0x211E.
- **`0x5036` Lithium Battery 1 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5037` Lithium Battery 2 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5038` Lithium Battery 3 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5039` Lithium Battery 4 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503A` Lithium Battery 5 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503B` Lithium Battery 6 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503C` Lithium Battery 7 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503D` Lithium Battery 8 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503E` Lithium Battery 9 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x503F` Lithium Battery 10 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5040` Lithium Battery 11 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5041` Lithium Battery 12 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5042` Lithium Battery 13 Abnormal** — 0x1404 Battery Amount (13). Catches a module vanishing, not one present-and-faulted.
- **`0x5100` Rectifier Missing** — 0x1101 Rectifier Amount, should read 6.
- **`0x5101` Rectifier Abnormal** — 0x1101.
- **`0x5102` Rectifiers Comms Failure** — 0x1101. Treat as INVALIDATING 0x1100/0x1101/0x1102 rather than as a fault report.
- **`0x5500` Battery High Temperature** — 0x1403 and 0x1601 are polled. No threshold register identified in the digested map.
- **`0x5501` Battery Temp Sensor Fault** — Self-confirming: sensible values on 0x1403 prove the sensor. INVALIDATES 0x1403/0x5500/0x5505.
- **`0x5502` BLVD Disconnected** — Enable 0x2303 (default 1), mode 0x2307. Disconnect 43.2 V, reconnect 51.5 V.
- **`0x5503` BLVD Warning** — Enable 0x2303, mode 0x2307.
- **`0x5505` Battery Low Temperature** — 0x1403/0x1601. At an equatorial site an assertion is better evidence the sensor is wrong.
- **`0x5506` Battery Fuse Blown** — No partner, no enable. Indirect check for Helios: 0x1401 should read a hard 0.
- **`0x5900` SSU Lost** — 0x1801 SSU Amount is polled, should read 4. DO NOT INHERIT THE WA SEVERITY.
- **`0x5901` SSU 1 Fault** — 0x1801 SSU Amount (4). Positional identity, so "SSU 1" is reliably slot 1.
- **`0x5903` PV 1 Array Fault** — 0x1801. The ONLY register separating "cloud" from "a string is gone".
- **`0x5911` SSU 2 Fault** — 0x1801 SSU Amount (4). Positional identity, so "SSU 2" is reliably slot 2.
- **`0x5913` PV 2 Array Fault** — 0x1801. The ONLY register separating "cloud" from "a string is gone".
- **`0x5921` SSU 3 Fault** — 0x1801 SSU Amount (4). Positional identity, so "SSU 3" is reliably slot 3.
- **`0x5923` PV 3 Array Fault** — 0x1801. The ONLY register separating "cloud" from "a string is gone".
- **`0x5931` SSU 4 Fault** — 0x1801 SSU Amount (4). Positional identity, so "SSU 4" is reliably slot 4.
- **`0x5933` PV 4 Array Fault** — 0x1801. The ONLY register separating "cloud" from "a string is gone".

---

## Three alarms that change how you read other rows

These do not describe the plant. They tell you other readings have stopped meaning anything, and **nothing else in the payload says so.**

| Alarm | Invalidates |
|---|---|
| `0x5102` Rectifiers Comms Failure | `0x1100`, `0x1101`, `0x1102` — the SMU lost the CAN bus and those three go stale while still returning their last values |
| `0x5501` Battery Temp Sensor Fault | `0x1403`, and therefore `0x5500` and `0x5505` too |
| `0x501F` LVD Disabled *(not polled)* | every LLVD and BLVD row — they would read `0` **correctly**, because the mechanism is switched off |

🛑 **`0x501F` is the gap worth closing next.** One register. Without it, ten LVD alarms reading quiet cannot be told apart from a plant with its protection turned off.

---

## Telemetry rows that carry the corroboration

These earn their place twice — once as readings, once as the thing that catches an alarm lying.

| Addr | Label | Checks |
|---|---|---|
| `0x1000` | System DC Voltage | `0x500E`, `0x500F` |
| `0x1001` | Total DC Load Current | `0x5010` (partial) |
| `0x1101` | Rectifier Amount — **added for this** | `0x5020`, `0x5100`, `0x5101`, `0x5102` |
| `0x1401` | Total Battery Current — **the sign is the signal** | `0x5021`, and `0x5506` indirectly |
| `0x1403` / `0x1601` | Battery temperatures | `0x5500`, `0x5501`, `0x5505` |
| `0x1404` | Battery Amount (13) | the thirteen lithium rows |
| `0x1801` | SSU Amount (4) | `0x5900`, the four `SSU N Fault` rows (Site) and the four `PV N Array Fault` rows (Solar) |

🎯 **`0x1101` is the lesson.** Section 18.6 called the rectifier alarms corroborated *because* this count proves the subsystem is alive — but the table had `0x1100` and `0x1102` and had **skipped the count**. The corroboration was asserted in the doc and not actually available in the firmware. **One register bought checkability for four alarms.**

---

## What comes out

One MQTT message per chunk, `MODBUS_DATA_MAX_READINGS_PER_CHUNK` = 25 readings each, so **4 chunks** plus one health chunk. `MODBUS_DATA_MAX_CHUNKS` = 20, so there is headroom.

```json
{
  "type": "data",
  "chunk": 1,
  "totalChunks": 4,
  "devices": [{
    "slaveId": 33,
    "name": "Huawei SMU02C",
    "readings": [
      { "label": "System DC Voltage",   "value": 53.5 },
      { "label": "BLVD Disconnected",   "value": 0 },
      { "label": "PV 2 Array Fault",    "value": 1 },
      { "label": "AC L3 Phase Failure", "value": null }
    ]
  }]
}
```

**Three things about that shape:**

- **`label` is the key, not the address.** Helios keys history on the raw label string, which is why `0x4024` is still called "Cumulative Mains Energy" at a site with no mains, and why `0x1403` was **not** renamed to "Battery 1 Temperature" when `0x1601` arrived. **Renaming a label orphans every historical reading under the old key.** Treat these 80 strings as a published interface.
- **`value: null` means the register did not answer this window** — an exception, a timeout, a bad CRC. ⚠️ **`null` is not `0`.** An alarm that fails to read is not an alarm reading clear, and anything downstream that coerces `null` to `0` turns a comms failure into a false all-clear.
- **Alarms arrive as `0` or `1` in a float field.** The `average` flag is `false` on every alarm row, which makes the accumulator store the last scaled read rather than a running sum, so the published number is exactly what the register last returned.

---

## 🛑 What Helios must not do

1. **Never build a "site is healthy" indicator from these.** 14 of 58 alarms cannot distinguish a quiet site from a dead register. An unpopulated smoke port and a smoke-free site are the same `0`. Presenting that as reassurance is worse than showing nothing.
2. **Never inherit Huawei's severities unexamined.** `0x5900` SSU Lost is rated **WA**, a warning — sensible where solar is a bonus. At J1PT solar is the **primary source**, so losing a quarter of the array is a generation shortfall that ends in an LLVD trip a few nights later. `0x5083` Main AC Breaker Trip is rated **MI**. Rank by what it costs at this site.
3. **Never treat a `0` from a one-way alarm as evidence.** Alert on the `1`. Say nothing on the `0`.
4. **Never write a register.** Section 16: `0x3004` deliberately runs the bank down and `0x3005` turns off the tower. The gateway exposes `writeRegister` — it must never point at this device.

---

## Deliberately left out

| Not added | Why |
|---|---|
| `0x5002` AC Failure | At a site with no utility an installer may have disabled the mains-failure alarm, so it reads `0` forever. `0x1004` AC Voltage stays the primary genset run-state signal. |
| `0x5103` Multi-Rectifier Fault | The register map lists **no severity**, unlike its three MA neighbours. `0x5101` already covers "a module is unwell"; "more than one" changes no action. |
| `0x501B` / `0x501C` DC Ultra High / Low | The **escalation** rung outside `0x500E`/`0x500F` (59 V and 44 V against 58 V and 45 V), MA against MI. Only 1 V apart at each end, so on a slow sag both fire in the same poll window. |
| `0x501E` Battery Test Failure | A test must be *started* to fail, and starting one is a write to `0x3004` which we must never send. Its diagnostic registers `0xA717`-`0xA71C` carry no applicability mark and `0xA719` collides with a reserved range. |
| `0x5022` Battery Missing | ⚠️ **Reconsider.** Now corroboratable via `0x1404`, which the earlier reasoning predates. Scope unclear — the `0x1502` enum lists "all batteries offline" and "battery missing" separately. |
| `0x5023`-`0x502E` DI1-DI12 | The UIM05B1 provides **`DIN1`-`DIN4`**, not twelve, and `DIN1`-`DIN3` are multiplexed with alarm outputs `ALM1`-`ALM3`. Eight have no terminal at all. And a DI number means nothing until someone documents what is wired to it. |
| `0x502F`-`0x5031` CELLNEX alarms | Marked "not standard, for special customer CELLNEX". User-defined; J1PT is not a CELLNEX site. |
| `0x5504` Battery Forcibly Connection | Not understood well enough. Appears to report a manual contactor override. |
| `0x5507` Battery Contactor Fault | ⚠️ **Reconsider.** It is the switch BLVD operates, so a stuck one **silently defeats `0x5502`** while every LVD register still looks healthy. Left out only because nothing corroborates it. |
| `0x5508` Battery Reversely Connected | An **installation** error, not an operating condition. Section 18.6 names it as unprovable — testing it means reversing a battery. Permanent `0`, indistinguishable from broken. |
| `0x5520+` Battery N Fuse Break (CA), `0x5521+` Middle Voltage Imbalance (WA) | 🛑 **`N <= 6` and J1PT has 13 modules.** Either these index battery *branches* — the `DCDU-600AN1` has exactly 3 x 200 A — or six of thirteen modules. Unresolved. Adding a CA alarm under a possibly-wrong label is the worst case. |
| `0x5083` Main AC Breaker Trip | Sits in the **AC2** block, and which input the genset feeds has never been established. Read `0x1030` first. Largely redundant with `0x1004` plus the three phase-failure rows. |
| `0x5120+` per-rectifier alarms (5 x 6 = 30 registers) | 🛑 **Rectifier addresses are hand-set on the LCD**, 1-60, by watching an indicator blink. Until someone confirms the six were addressed, "Rectifier 3 Fault" is a real value under a wrong name. |
| `0x5902+` SSU N Comms Failure, `0x5904+` SSU N Protection | As cheap and as positional as the SSU rows taken, just lower value — `0x5900` plus `0x1801` already catch a module leaving the bus. 4 registers each if wanted. Both would be **Site**, like every other SSU row. |
| `0x5700` / `0x5701` Return Air / Outdoor Temp Sensor Fault | Almost certainly part of the absent HVAC subsystem — "return air" is aircon vocabulary. Left out despite `0x5701` being one of only four CA alarms. |
| `0x5720`-`0x5723` Fan 1-4 Fault | Fans **exist** (sealed 2500 W heat exchanger, ventilated battery cabinets) but whether they report to the SMU is unverified. Would be partially corroborated by `0x1500` ambient creeping. Take once confirmed. |
| `0x5740`-`0x5745`, `0x5760`-`0x5772` Air conditioner (~19 registers) | ❌ **There is no air conditioning at J1PT.** Datasheet-confirmed: `ICC330` cools by sealed LTS heat exchanger, `ESC330` by direct ventilation. Never add. |
| `0x8431+` per-string lithium alarms | Several alarms x 13 strings. Needs its own budget conversation, and the window is already the constraint. |

---

## Open questions, ranked by how many alarms they unblock

| # | Question | Unblocks | How to answer |
|---|---|---|---|
| 1 | **A one-time boot-read path for config registers** | ~20 alarms move from "on demand" to "both ways" | Firmware. ~20 registers read once, published once, never polled — they only change when a person changes them. **The highest-value change outstanding on this line.** |
| 2 | Which UIM05B1 sensor ports are populated? | 17 alarms, incl. both CA rows | Look at the ports on the site visit |
| 3 | Is the dialect right — function code and addressing base? | **all 80 rows** | Read `0x1001`; it should return ~667 (3.2 kW at 48 V, precision 1) |
| 4 | Is `AC Type` `0x2126` 3-phase 4-wire? | the nine per-phase AC rows | One read, or the LCD |
| 5 | Is lithium battery `N` positional or assigned? | the thirteen lithium rows | `0x1404` reads 13 — do all thirteen registers answer? |
| 6 | Have the six rectifiers been hand-addressed? | 30 per-rectifier alarms | LCD, on site |
| 7 | Do `0x5520+` rows index modules or branches? | 2 x N alarms incl. a CA | Site visit; also settles the 3 x 200 A branch question |
| 8 | Is `0x5020` computed from installed or available capacity? | whether `0x5020` is a signal or noise | Watch it against `0x1004` — asserted while AC is near 0 and clear while the genset runs means availability-based, and the row should be dropped |

⚠️ **Question 3 sits above all the others.** The workbook is `DPCP V300R024C10 (SMU02X)` and this unit is `SMU02C V500R003C10`. **Every address here is *probably* right, not confirmed right.** Nothing in this document is real until a gateway reads it on site.

---

## See also

- [`smu02c-lvd-diagnosis.md`](smu02c-lvd-diagnosis.md) — the register read order for answering *why* an LVD disconnected. Every read in it works today over the existing `readRegister` MQTT command.
- `shared-knowledge/product-telcoiq/hardware/smu02c-modbus-register-map.md` — the source map. Section 18 is the alarm block, 18.6 the rule above.
- `shared-knowledge/re-hardware-team/knowledge/firmware-flash-register.md` — version ledger. **0.3.43 is unbuilt and uncommitted, so the number is not burned.**
