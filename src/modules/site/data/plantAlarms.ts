import {monitoringUnit} from './monitoringUnit';
import type {MonitoringUnit} from './monitoringUnit';
import {SEVERITY_OF_HUAWEI} from '../types/plantAlarm.type';
import type {AlertSeverity, CabinetPart, Checkability, HuaweiSeverity, PlantAlarm, PlantAlarmCategory} from '../types/plantAlarm.type';
import {hasMains} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * The alarms the site's monitoring unit is set to poll — all fifty-eight of them.
 *
 * Transcribed from `esp32/docs/smu02c-alarms-chosen.md` at firmware 0.3.43, which
 * is the reasoning behind each choice. **Nothing here is invented**, in exactly the
 * sense `genset/types/alert.type.ts` means it: every row is a register on a device,
 * with the class the register map gives it and the corroboration argument the doc
 * makes for it. A plausible fifty-ninth alarm is not allowed in this file.
 *
 * ## Why the catalogue reports nothing
 *
 * Because nothing has been read. The gateway on site runs 0.3.21; this poll set is
 * 0.3.43, which is unbuilt, uncommitted and unflashed. There is therefore no
 * assertion to show, no `raisedAt` to stamp and nothing to acknowledge — and rather
 * than deal a handful of fake assertions so the page looks like an alarm list, the
 * four tabs report what the unit *watches*.
 *
 * That is not a smaller thing than it sounds. The register map's own warning is
 * that a `0` is ambiguous three ways and fourteen of these rows have nothing that
 * could contradict one, so **a screen showing most of the table quiet and a handful
 * red would be asserting a clean bill of health nobody can support.** A catalogue
 * that says which rows could be believed if they did fire is the honest version of
 * this page until a gateway has answered.
 *
 * ## Why one device feeds four tabs
 *
 * The category on each row is a **routing decision, not a device boundary**. There
 * is one box on the cabinet wall and it watches the whole −48 V plant; the four
 * buckets exist so a row lands in front of whoever fixes that thing. The counts are
 * lopsided on purpose — twenty-eight battery rows against nine solar — because that
 * is what the SMU02C actually instruments.
 *
 * ## The one category that depends on the site
 *
 * The nine per-phase AC rows. Huawei calls them mains alarms because the SMU
 * assumes a utility; **SBH-1336 is `SOLAR_HYBRID`, which in this model means no
 * incomer**, so the generator is the only AC source and a phase failure is a
 * dropped phase on the set. They are filed under Genset for that reason and for no
 * other, and `categoryFor` below re-files them the moment a reader flips the site to
 * `GRID_BACKUP` on its settings tab — which is the trap the doc names, made into
 * behaviour rather than a comment.
 */

/** A row as authored: everything but the id and the resolved severity. */
type AlarmSpec = {
  address: number;
  label: string;
  category: PlantAlarmCategory;
  /**
   * Which part of the cabinet the row is about — see `CabinetPart`.
   *
   * Optional on the spec and **required on every `SITE` row**, which `SITE_PARTS`
   * below checks on load. Optional because three quarters of this table is a bank, a
   * roof and an engine, and giving those a cabinet part would be inventing a fact to
   * satisfy a type.
   */
  part?: CabinetPart;
  huawei: HuaweiSeverity;
  /**
   * This site's ranking where it differs from the device's, and the argument for
   * it. Absent on a row that takes the device's class as it comes.
   */
  reranked?: {to: AlertSeverity; why: string};
  checkability: Checkability;
  /** The rule's line, where the register map documents one. See `PlantAlarm.threshold`. */
  threshold?: string;
  meaning: string;
  corroboration: string;
  invalidates?: ReadonlyArray<string>;
};

/** The three phases, for the nine AC rows. */
const PHASES = [1, 2, 3] as const;

/**
 * The per-phase AC alarms — over-voltage, under-voltage, phase failure.
 *
 * Generated rather than written out because they are one rule three times, and
 * three hand-copied triples is three chances to put L2's address on L3's row. The
 * addresses are contiguous within each rule: `0x5003`–`0x5005`, `0x5006`–`0x5008`,
 * `0x5009`–`0x500B`.
 *
 * All nine are `ONE_WAY`, and the reason is a gap rather than a property of the
 * device: the per-phase voltages at `0x1006`–`0x1008` exist and are **not polled**,
 * so nothing in the payload can contradict a quiet phase-failure row. Adding three
 * registers would move all nine to `BOTH_WAYS`, which is the cheapest checkability
 * available anywhere in this table.
 *
 * The six voltage rows are `MI` and the three failure rows `MA`, so the voltage
 * rows come out as warnings and a dropped phase as a call-out. That is the register
 * map's own ranking and this file does not argue with it — see the note on
 * `SEVERITY_OF_HUAWEI` for why nothing here is re-ranked.
 *
 * All nine sit on the **AC input** and say so, which is the one thing about them that
 * does not move. They are `GENSET` rows at a site with no incomer and `SITE` rows at
 * one with a grid — `categoryFor` re-files them — so the site tab's third tier of
 * filter picks them up as part of the cabinet exactly where a grid exists, and they
 * stay filed under the set where it does not. Deriving the part from the category
 * would have lost it in one of the two configurations; see `PlantAlarm.part`.
 */
const AC_SPECS: ReadonlyArray<AlarmSpec> = [
  ...PHASES.map((phase): AlarmSpec => ({
    address: 0x5003 + phase - 1,
    label: `AC L${phase} Overvoltage`,
    category: 'GENSET',
    part: 'AC_INPUT',
    huawei: 'MI',
    checkability: 'ONE_WAY',
    threshold: '> 280 V (default)',
    meaning: `Phase L${phase} voltage above its window. With no incomer here, this is the set's own regulator rather than the mains.`,
    corroboration: `Threshold 0x2106, factory default 280 V, settable 60–300 V — not in the poll set, so the line shown is the default rather than this plant's setting. Per-phase voltage 0x100${5 + phase} is not polled either, so nothing can contradict a quiet row.`,
  })),
  ...PHASES.map((phase): AlarmSpec => ({
    address: 0x5006 + phase - 1,
    label: `AC L${phase} Undervoltage`,
    category: 'GENSET',
    part: 'AC_INPUT',
    huawei: 'MI',
    checkability: 'ONE_WAY',
    threshold: '< 180 V (default)',
    meaning: `Phase L${phase} voltage below its window — the set under load.`,
    corroboration: `Threshold 0x2107, factory default 180 V, settable 60–300 V — not in the poll set, so the line shown is the default rather than this plant's setting. Per-phase voltage 0x100${5 + phase} is not polled either, so nothing can contradict a quiet row.`,
  })),
  ...PHASES.map((phase): AlarmSpec => ({
    address: 0x5009 + phase - 1,
    label: `AC L${phase} Phase Failure`,
    category: 'GENSET',
    part: 'AC_INPUT',
    huawei: 'MA',
    checkability: 'ONE_WAY',
    meaning:
      phase === 1
        ? 'Phase L1 gone. On a generator this is a dropped phase, and the rectifiers carry the site on the other two.'
        : `Phase L${phase} gone.`,
    corroboration: `Per-phase voltage 0x100${5 + phase} is not in the poll set. The highest-value row of the nine and the least checkable.`,
  })),
];

/** The site's own rows: the cabinet, the bus, the load and the rectifiers. */
const SITE_SPECS: ReadonlyArray<AlarmSpec> = [
  {
    address: 0x5000,
    label: 'AC SPD Fault',
    part: 'AC_INPUT',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'ONE_WAY',
    meaning:
      'The surge arrester on the AC input is spent. The plant runs normally and the site is unprotected.',
    corroboration:
      'The arrester is datasheet-confirmed fitted at 30 kA, so "not fitted" is ruled out — but nothing polled reports its health.',
  },
  {
    address: 0x5001,
    label: 'DC SPD Fault',
    part: 'DISTRIBUTION',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'ONE_WAY',
    meaning: 'The surge arrester on the −48 V side is spent.',
    corroboration:
      'Fitted at 10/20 kA and confirmed, so "not fitted" is ruled out. Healthy against unsupported is not.',
  },
  {
    address: 0x500e,
    label: 'DC Overvoltage Alarm',
    part: 'DISTRIBUTION',
    category: 'SITE',
    huawei: 'MI',
    checkability: 'BOTH_WAYS',
    threshold: '> 58 V (default)',
    meaning: 'The rectifiers have pushed the DC bus too high. The risk is to the load.',
    corroboration:
      'System DC Voltage is polled, so this one is corroborated in both directions. Threshold 0x2108, factory default 58 V, settable 53–60 V — the setting itself is not read.',
  },
  {
    address: 0x500f,
    label: 'DC Undervoltage Alarm',
    part: 'DISTRIBUTION',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    threshold: '< 45 V (default)',
    meaning:
      'The bus is sagging — less is arriving than leaving. This is the state that precedes a load-shed, so expect the battery ladder next.',
    corroboration:
      'System DC Voltage is polled. Threshold 0x2109, factory default 45 V, settable 35–57 V — the setting itself is not read. The register map names this alarm as needing no confirmation.',
  },
  {
    address: 0x5010,
    label: 'Load Fuse Break',
    part: 'DISTRIBUTION',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'PARTIAL',
    meaning:
      'A fuse on one DC load feed has blown. That circuit is dead and everything else reads normal.',
    corroboration:
      'Total DC Load Current should step down. It is published as a window mean, so a failure partway through a window blurs.',
  },
  {
    address: 0x5011,
    label: 'Door Alarm',
    part: 'ENCLOSURE',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'ON_DEMAND',
    meaning: 'The cabinet door is open.',
    corroboration:
      'Door Sensor 0x2251 is a 0/1 enable flag that would settle it, and the gateway does not read it yet.',
  },
  {
    address: 0x5012,
    label: 'Water Alarm',
    part: 'ENCLOSURE',
    category: 'SITE',
    huawei: 'CA',
    checkability: 'ONE_WAY',
    meaning: 'Water ingress. One of only two rows the device itself calls critical.',
    corroboration:
      'The sensor port may be unpopulated. Until somebody looks at the terminals on site, a quiet row is worth nothing.',
  },
  {
    address: 0x5013,
    label: 'Smoke Alarm',
    part: 'ENCLOSURE',
    category: 'SITE',
    huawei: 'CA',
    checkability: 'ONE_WAY',
    meaning: 'Smoke. The other critical row.',
    corroboration:
      'The sensor port may be unpopulated. An unpopulated smoke port and a smoke-free site publish the same 0.',
  },
  {
    address: 0x5020,
    label: 'Low Rectifier Capacity',
    part: 'RECTIFIERS',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning:
      'Rectifier redundancy is lost — spare capacity above the load has fallen below its threshold.',
    corroboration:
      'Rectifier Amount was added to the poll set for this and should read 6. Still unresolved: whether the SMU computes it from installed or from available capacity.',
  },
  {
    address: 0x5100,
    label: 'Rectifier Missing',
    part: 'RECTIFIERS',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning: 'The SMU expected a rectifier and cannot find it.',
    corroboration: 'Rectifier Amount is polled and should read 6.',
  },
  {
    address: 0x5101,
    label: 'Rectifier Abnormal',
    part: 'RECTIFIERS',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning: 'At least one rectifier is unwell, without saying which.',
    corroboration:
      'Rectifier Amount is polled. Which one is unwell needs the per-rectifier rows, and those are not safe to add until somebody confirms the six were hand-addressed on the LCD.',
  },
  {
    address: 0x5102,
    label: 'Rectifiers Comms Failure',
    part: 'RECTIFIERS',
    category: 'SITE',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning:
      'The SMU has lost the internal CAN bus to every rectifier and is blind to all of them.',
    corroboration:
      'Rectifier Amount is polled. Read this as invalidating the rectifier readings rather than as a fault report in its own right.',
    invalidates: ['Rectifier Voltage', 'Rectifier Amount', 'Rectifier Current'],
  },
];

/**
 * The four load-shed stages and the battery's own, as the register map lays them
 * out.
 *
 * Written as a table because the addresses do not follow a formula — stages 1 and 2
 * sit at `0x5017`–`0x501A` and stages 3 and 4 were added later at `0x5032`–`0x5035`
 * — and because each stage has its own enable register, which is the whole reason
 * these rows are `ON_DEMAND` rather than trustworthy.
 *
 * **LLVD2 is the one to read twice.** Its enable at `0x2103` defaults to `0`, so on
 * a plant nobody has configured those two rows read quiet forever and mean nothing
 * whatever. That is the clearest example in the table of why silence is not
 * evidence.
 */
const LVD_STAGES: ReadonlyArray<{
  warningAt: number;
  disconnectedAt: number;
  label: string;
  /** Enable register, and what it ships as. See the note above on `LLVD2`. */
  enable: string;
  enabledByDefault: boolean;
  /** Where the stage sheds and where it comes back, volts — §15.2 defaults. */
  disconnectV: string;
  reconnectV: string;
  disconnectRegister: string;
  reconnectRegister: string;
  /** Disconnect-mode register. The reason the voltages carry a caveat. */
  mode: string;
  /** Remaining state of charge the stage sheds at in capacity mode. */
  capacity: string;
}> = [
  {
    warningAt: 0x5017,
    disconnectedAt: 0x5018,
    label: 'LLVD1',
    enable: '0x2100',
    enabledByDefault: true,
    disconnectV: '45.0 V',
    reconnectV: '51.5 V',
    disconnectRegister: '0x2101',
    reconnectRegister: '0x2102',
    mode: '0x210C',
    capacity: '25%',
  },
  {
    warningAt: 0x5019,
    disconnectedAt: 0x501a,
    label: 'LLVD2',
    enable: '0x2103',
    enabledByDefault: false,
    disconnectV: '44.0 V',
    reconnectV: '51.5 V',
    disconnectRegister: '0x2104',
    reconnectRegister: '0x2105',
    mode: '0x2111',
    capacity: '15%',
  },
  {
    warningAt: 0x5032,
    disconnectedAt: 0x5033,
    label: 'LLVD3',
    enable: '0x2116',
    enabledByDefault: true,
    disconnectV: '44.0 V',
    reconnectV: '51.5 V',
    disconnectRegister: '0x2117',
    reconnectRegister: '0x2118',
    mode: '0x2119',
    capacity: '15%',
  },
  {
    warningAt: 0x5034,
    disconnectedAt: 0x5035,
    label: 'LLVD4',
    enable: '0x211E',
    enabledByDefault: true,
    disconnectV: '44.0 V',
    reconnectV: '51.5 V',
    disconnectRegister: '0x211F',
    reconnectRegister: '0x2120',
    mode: '0x2121',
    capacity: '15%',
  },
];

/**
 * ⚠️ **A shed voltage is only the shed voltage in voltage mode.**
 *
 * Every stage has a `Disconnect Mode` register — `0` voltage, `1` elapsed time, `2`
 * remaining capacity — and all five ship on voltage. **None of the five is polled.**
 * A plant somebody switched to capacity mode sheds at 25% state of charge and trips
 * at a bus voltage that looks perfectly healthy, so a page printing `45.0 V` as
 * *the* line would be describing a plant nobody has confirmed this is.
 *
 * The same is true of the numbers themselves: the disconnect and reconnect
 * registers are settable across 35–56 V and 37–58 V and are not read either. So
 * every LVD row says `default`, names the register that would settle it, and names
 * the mode register beside it. That is the `ON_DEMAND` grade doing its job on the
 * screen instead of in a comment.
 *
 * There is also a **high-temperature disconnect** on every stage, default off at
 * 65 °C — a thermal shed rather than a voltage one, and worth ruling out before
 * attributing a trip to a flat battery.
 */
const lvdNote = (stage: (typeof LVD_STAGES)[number]): string =>
  [
    `Disconnect ${stage.disconnectRegister}, default ${stage.disconnectV}, settable 35–56 V;`,
    `reconnect ${stage.reconnectRegister}, default ${stage.reconnectV}.`,
    `Mode ${stage.mode} ships on voltage — in capacity mode this stage sheds at ${stage.capacity} instead, at a bus voltage that looks healthy.`,
    stage.enabledByDefault
      ? `Enable ${stage.enable}, default 1. Not read yet.`
      : `Enable ${stage.enable} ships at 0 — on a stock plant this row reads 0 forever and says nothing at all.`,
  ].join(' ');

const LVD_SPECS: ReadonlyArray<AlarmSpec> = LVD_STAGES.flatMap(
  (stage): Array<AlarmSpec> => [
    {
      address: stage.warningAt,
      label: `${stage.label} Warning`,
      category: 'BATTERY',
      huawei: 'MA',
      checkability: 'ON_DEMAND',
      // The stage's own shed line rather than a line of the warning's own, because
      // the map documents no separate warning threshold: what "about to" means is
      // decided by the mode register. Phrased as a fact about the stage — it sheds
      // here — instead of a claim about where this row trips.
      threshold: `sheds at ${stage.disconnectV} (default)`,
      meaning: `${stage.label} is about to shed its load stage. The site is still up — this is the actionable one.`,
      corroboration: `No separate warning line is documented; what "about to" means is decided by the mode. ${lvdNote(stage)}`,
    },
    {
      address: stage.disconnectedAt,
      label: `${stage.label} Disconnected`,
      category: 'BATTERY',
      huawei: 'MA',
      checkability: 'ON_DEMAND',
      threshold: `< ${stage.disconnectV}, back at ${stage.reconnectV} (default)`,
      meaning: `${stage.label} has shed. The equipment on that stage is off the air.`,
      corroboration: lvdNote(stage),
    },
  ],
);

/** The bank itself: its discharge state, its protection, its temperature and its fuse. */
const BATTERY_SPECS: ReadonlyArray<AlarmSpec> = [
  {
    address: 0x5021,
    label: 'Battery Discharge Alarm',
    category: 'BATTERY',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning:
      'The bank is discharging. Normal at night, and the leading edge of the load-shed sequence when it is not.',
    corroboration:
      'Total Battery Current is polled and the sign of it is the same fact. Nothing in this table is better corroborated.',
  },
  {
    address: 0x5500,
    label: 'Battery High Temperature',
    category: 'BATTERY',
    huawei: 'MI',
    checkability: 'BOTH_WAYS',
    meaning: 'The bank is too hot, by the plant’s own definition of hot.',
    corroboration:
      'Both battery temperatures are polled. No threshold register has been identified in the digested map, so the line itself is unknown.',
  },
  {
    address: 0x5501,
    label: 'Battery Temp Sensor Fault',
    category: 'BATTERY',
    huawei: 'MA',
    checkability: 'BOTH_WAYS',
    meaning: 'The temperature sensor has failed. The plant is thermally blind.',
    corroboration:
      'Self-confirming: sensible values on the temperature register prove the sensor is alive.',
    invalidates: [
      'Battery Temperature',
      'Battery High Temperature',
      'Battery Low Temperature',
    ],
  },
  {
    address: 0x5502,
    label: 'BLVD Disconnected',
    category: 'BATTERY',
    huawei: 'MA',
    checkability: 'ON_DEMAND',
    threshold: '< 43.2 V, back at 51.5 V (default)',
    meaning: 'The battery has been disconnected from the bus. Site dark, bank saved.',
    // The last rung on the ladder, and the lowest: 43.2 V against LLVD1's 45.0, so
    // the load stages shed first and the bank is what the plant protects last.
    corroboration:
      'Disconnect 0x2304, default 43.2 V; reconnect 0x2305, default 51.5 V. Mode 0x2307 ships on voltage — in capacity mode it sheds at 5% instead. Enable 0x2303, default 1. None of the four is read yet.',
  },
  {
    address: 0x5503,
    label: 'BLVD Warning',
    category: 'BATTERY',
    huawei: 'MA',
    checkability: 'ON_DEMAND',
    threshold: 'sheds at 43.2 V (default)',
    meaning: 'The battery is about to be disconnected. The site is still up — last chance.',
    corroboration:
      'No separate warning line is documented; what "about to" means is decided by the mode. Disconnect 0x2304, default 43.2 V; reconnect 0x2305, default 51.5 V. Mode 0x2307 ships on voltage — in capacity mode it sheds at 5%. Enable 0x2303, default 1. Not read yet.',
  },
  {
    address: 0x5505,
    label: 'Battery Low Temperature',
    category: 'BATTERY',
    huawei: 'MI',
    checkability: 'BOTH_WAYS',
    meaning: 'The bank is too cold.',
    corroboration:
      'Both battery temperatures are polled. At an equatorial site an assertion here is better evidence that the sensor is wrong than that the bank is cold.',
  },
  {
    address: 0x5506,
    label: 'Battery Fuse Blown',
    category: 'BATTERY',
    huawei: 'MA',
    checkability: 'ONE_WAY',
    meaning:
      'The fuse between the bank and the busbar is open. The battery is no longer part of the plant.',
    corroboration:
      'No partner and no enable register. The indirect check is that Total Battery Current should then read a hard 0.',
  },
];

/**
 * The solar block: the bus, each conversion unit, and the array feeding it.
 *
 * `SSU N Fault` and `PV N Array Fault` are sixteen addresses apart per unit, so the
 * four units land on `0x5901`/`0x5903`, `0x5911`/`0x5913` and so on. Identity is
 * **positional** — slot 1 is reliably SSU 1 — which is what makes generating them
 * safe here and is not true of the rectifiers, whose addresses are hand-set on the
 * LCD.
 *
 * The pair matters more than either row. `PV N Array Fault` is the only register in
 * the whole poll set that separates "a cloud went over" from "a string is gone".
 *
 * ## Why these nine rows are not all `SOLAR`
 *
 * Because a category here answers *who is dispatched*, and the rule the register map's
 * own notes were recategorised on (2026-09-08) is **where the thing physically is**:
 * anything that is a module in the subrack or inside the power cabinet is `SITE`.
 *
 * An SSU is a plug-in converter in the same shelf as the rectifiers — it reads its own
 * slot off detection pins, which is exactly why identity is positional — so `SSU 3
 * Fault` is a module to swap in the cabinet, and the person who goes is the person who
 * swaps a rectifier. What it converts is solar; where it is, is the plant. So `SSU
 * Lost` and the four `SSU N Fault` rows are `SITE`, alongside `Low Rectifier Capacity`
 * and the three rectifier summary rows already there.
 *
 * `PV N Array Fault` stays `SOLAR`. It is not the module — it is fifteen strings across
 * four junction boxes on the roof, and a dead string is traced by somebody with a
 * clamp meter and a ladder.
 *
 * ⚠️ **The consequence is that the pair now spans two categories, and the pair is the
 * point.** SSU 3 faulted with PV 3 clear is a module to swap; PV 3 clear with SSU 3
 * faulted is a string to trace; both asserted is the ambiguous case. The site's pooled
 * Alarms tab is what keeps them readable together — it is the one screen that shows all
 * four categories in one queue, which is most of the argument for it existing.
 */
const solarSpecs = (ssus: number): ReadonlyArray<AlarmSpec> => [
  {
    address: 0x5900,
    label: 'SSU Lost',
    // `SITE`, not `SOLAR` — a module in the cabinet. See the note above.
    category: 'SITE',
    part: 'SSUS',
    huawei: 'WA',
    checkability: 'BOTH_WAYS',
    meaning: 'A solar conversion unit has fallen off the bus.',
    // 🛑 The source document is emphatic that this one should not be inherited:
    // the device rates it a warning because it assumes solar is a bonus, and here
    // the array is the primary source, so a quarter of it leaving the bus is a
    // generation shortfall that ends at the load-shed ladder a few nights later.
    // It is inherited anyway, because the dashboard's rule is now the register
    // map's Sev column and nothing else — see `SEVERITY_OF_HUAWEI`. This is the
    // row to revisit first if that rule ever loosens.
    corroboration: `SSU Amount is polled and should read ${ssus}. The register map rates this the device's lowest class; the alarms-chosen note argues it should not stay there at a solar-primary site.`,
  },
  ...Array.from({length: ssus}, (_unused, index): Array<AlarmSpec> => {
    const unit = index + 1;
    const base = 0x5901 + index * 0x10;

    return [
      {
        address: base,
        label: `SSU ${unit} Fault`,
        // `SITE`, not `SOLAR` — a module in the cabinet. See the note above.
        category: 'SITE',
        part: 'SSUS',
        huawei: 'MA',
        checkability: 'PARTIAL',
        meaning: `Conversion unit ${unit} has failed and is not converting.`,
        corroboration: `SSU Amount is polled and should read ${ssus}. Identity is positional, so "SSU ${unit}" is reliably slot ${unit}.`,
      },
      {
        address: base + 2,
        label: `PV ${unit} Array Fault`,
        // The one row in this block that stays `SOLAR`: strings on a roof, not a
        // module in a rack.
        category: 'SOLAR',
        huawei: 'MA',
        checkability: 'PARTIAL',
        meaning: `The panels and wiring feeding unit ${unit} — a dead string, a blown string fuse, a junction box.`,
        corroboration:
          'SSU Amount is polled. This is the only register in the poll set that separates cloud from a string being gone.',
      },
    ];
  }).flat(),
];

/**
 * One row per lithium module, indexed from `0x5036`.
 *
 * Generated from the unit's own module count rather than from a literal thirteen,
 * so the catalogue and the bank's equipment tab cannot disagree about how many
 * modules there are — see `monitoringUnit.ts` on why that count is stated as
 * hardware instead of sized from the load.
 *
 * Every one of them is `PARTIAL`, and the reason is worth reading: Battery Amount
 * catches a module **vanishing** from the bus, not one that is present and faulted.
 * A module's own BMS reporting a problem with itself is exactly the case the count
 * cannot see.
 */
const lithiumSpecs = (modules: number): ReadonlyArray<AlarmSpec> =>
  Array.from({length: modules}, (_unused, index): AlarmSpec => {
    const unit = index + 1;

    return {
      address: 0x5036 + index,
      label: `Lithium Battery ${unit} Abnormal`,
      category: 'BATTERY',
      huawei: 'MA',
      checkability: 'PARTIAL',
      meaning: `Module ${unit}'s own BMS reports a problem with itself.`,
      corroboration: `Battery Amount is polled and should read ${modules}. It catches a module vanishing, not one present and faulted.`,
    };
  });

/**
 * Where a row is filed, given how the site is fed.
 *
 * Only the nine AC rows move, and they move as a set. The register map calls them
 * mains alarms; whether that is what they describe depends on whether this
 * particular site has a mains, and a reader can change that answer from the site's
 * settings tab. **Add an incomer and all nine become Site rows** — the generator is
 * no longer the only AC source, so a phase failure stops being a statement about the
 * set.
 *
 * The alternative was a comment saying "re-file these if the site ever gets a grid",
 * which is the kind of comment that is still there three sites later.
 */
const categoryFor = (spec: AlarmSpec, role: SitePowerRole): PlantAlarmCategory =>
  spec.category === 'GENSET' && hasMains(role) ? 'SITE' : spec.category;

const build = (spec: AlarmSpec, siteId: string, role: SitePowerRole): PlantAlarm => ({
  id: `${siteId}-${spec.address.toString(16)}`,
  address: spec.address,
  label: spec.label,
  category: categoryFor(spec, role),
  // The row's own part, whatever category it lands in — see `PlantAlarm.part`.
  part: spec.part ?? null,
  huawei: spec.huawei,
  // **No row sets `reranked`, and that is the current rule rather than an
  // oversight.** Severity is the register map's `Sev` column put through one
  // table, so a reader can check any row on any of the four tabs against the map
  // and get the same answer, and nobody has to know which rows somebody once
  // argued about.
  //
  // The escape hatch stays wired because the source document asks for it — its
  // rule 2 is "never inherit Huawei's severities unexamined", and `SSU Lost` is
  // the row it names. Setting `reranked` on a spec is all it would take, in either
  // direction, and the row would then print the device's class, this site's
  // ranking and the argument between them.
  severity: spec.reranked?.to ?? SEVERITY_OF_HUAWEI[spec.huawei],
  reranked: spec.reranked?.why ?? null,
  checkability: spec.checkability,
  threshold: spec.threshold ?? null,
  meaning: spec.meaning,
  corroboration: spec.corroboration,
  invalidates: spec.invalidates ?? [],
});

/**
 * Every `SITE` row declares a cabinet part — checked on load, not hoped for.
 *
 * The third tier of filter on the site's Alarms tab is drawn from `PlantAlarm.part`,
 * and a Cabinet row without one would not error: it would simply never match a part
 * chip, so selecting any of the five would hide it. A row that vanishes from a
 * filtered table is the hardest kind of wrong to notice, because the table still
 * looks like a table.
 *
 * So this runs once at module load, over the specs rather than over one site's built
 * rows, and throws with the offending labels. It is the same argument
 * `assertDatasetIntegrity` makes for the brand datasets — a fact the compiler cannot
 * check gets checked at startup instead of at the first screenshot.
 *
 * The `SITE` list is taken **before** `categoryFor` runs, so it does not depend on a
 * power role. The nine AC rows are `GENSET` specs that become `SITE` at a grid-backed
 * site and they carry a part anyway, which is why they are not in this check and do
 * not need to be.
 */
const assertSiteRowsHaveParts = (): void => {
  const orphans = [...SITE_SPECS, ...solarSpecs(MAX_SSUS), ...LVD_SPECS, ...BATTERY_SPECS]
    .filter((spec) => spec.category === 'SITE' && spec.part === undefined)
    .map((spec) => `${spec.label} (0x${spec.address.toString(16)})`);

  if (orphans.length > 0) {
    throw new Error(
      `Cabinet alarm rows with no part, so the site tab's part filter would hide them: ${orphans.join(', ')}`,
    );
  }
};

/**
 * Enough SSUs to generate every `SSU N Fault` any unit in `UNITS` could have, for the
 * check above only.
 *
 * The generated rows all take one part, so the number only has to be at least the
 * largest real shelf — it is not a claim about any site's hardware and nothing else
 * reads it.
 */
const MAX_SSUS = 16;

assertSiteRowsHaveParts();

/**
 * Every alarm the unit at this site polls, in address order.
 *
 * **Address order, as the poll table is**, rather than sorted by severity or by
 * category. Two reasons: it is the order somebody comparing this page against the
 * register map or against the firmware's table will be reading in, and the
 * addresses are grouped by subsystem anyway — the `0x50` block is the plant, `0x55`
 * the battery, `0x59` the solar — so the physical grouping comes out of the sort for
 * free.
 *
 * Returns `[]` for a site with no unit, which is twenty-four of the twenty-five.
 */
export const plantAlarms = (
  siteId: string,
  role: SitePowerRole,
): ReadonlyArray<PlantAlarm> => {
  const unit = monitoringUnit(siteId);
  if (unit === undefined) return [];

  return [
    ...SITE_SPECS,
    ...AC_SPECS,
    ...LVD_SPECS,
    ...BATTERY_SPECS,
    ...lithiumSpecs(unit.batteryModules),
    ...solarSpecs(unit.ssus),
  ]
    .map((spec) => build(spec, siteId, role))
    .sort((left, right) => left.address - right.address);
};

/** The rows for one tab. The only reader any of the four alarm pages needs. */
export const plantAlarmsIn = (
  siteId: string,
  role: SitePowerRole,
  category: PlantAlarmCategory,
): ReadonlyArray<PlantAlarm> =>
  plantAlarms(siteId, role).filter((alarm) => alarm.category === category);

/**
 * The unit behind a tab, or `undefined` where the site has none.
 *
 * Re-exported through this module so the four pages have one import rather than
 * two, and so nothing outside here has to know that the plant counts and the alarm
 * rows come from the same fixture.
 */
export const plantMonitoringUnit = (siteId: string): MonitoringUnit | undefined =>
  monitoringUnit(siteId);
