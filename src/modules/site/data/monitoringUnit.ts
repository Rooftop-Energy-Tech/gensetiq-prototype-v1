/**
 * The sites with a monitoring unit on them, and what it is wired to.
 *
 * ## ⚠️ One of these four records is a survey. Three are assertions.
 *
 * Read this before trusting any number below.
 *
 * **SBH-1336 stands for J1PT.** A gateway is actually going in there against a Huawei
 * SMU02C, its poll set is the one in `esp32/docs/smu02c-alarms-chosen.md` at firmware
 * 0.3.43, and its module counts were read off the hardware. Everything in that record
 * is a fact about a box somebody has opened.
 *
 * **SBH-1495, SWK-0559 and SWK-1163 are not.** Nobody has visited them. Their records
 * were added on 2026-09-09 at Jeff's direction so the cabinet page reads the same at
 * all four solar hybrids, and they assert that each site has the estate's standard
 * fit-out — the same SMU02C, the same poll set, the same rollout — rather than
 * reporting a survey. The claim is plausible and it is still a claim.
 *
 * What each of those three carries that is genuinely its own:
 *
 *  - its **gateway id**, one per site;
 *  - its **rectifier and solar unit counts**, which are exactly the numbers
 *    `shelf.ts`'s `sizedShelf` had been modelling for it, so nothing about the plant
 *    changed when the record appeared — only where the numbers are read from;
 *  - its **battery module count**, its own bank's kWh divided by SBH-1336's 7.15 kWh
 *    per module;
 *  - its **row counts**, which are what `plantAlarms` actually generates for those
 *    counts. That is not cosmetic: `PlantAlarmCatalogue` prints "N of the `alarmRows`
 *    alarms in its poll table", so a stated total that disagreed with the generated one
 *    would have the page contradict itself inside a sentence.
 *
 * ## What adding them did, beyond the cabinet
 *
 * More than the cabinet page, which is worth knowing because the cabinet page is why
 * they were added. `plantAlarms` returns `[]` without a unit, so those three sites had
 * **no plant alarms at all** and now have a full catalogue; `banks.ts` and `systems.ts`
 * both defer to this file, so their bank module counts and array string counts are now
 * stated here rather than sized; and `SubrackCabinet.shelf` reads `READ` at all four,
 * so every screen printing `Shelf make-up` says `Counted`. That last one is the sharpest
 * edge: the app now asserts four surveyed shelves where one has been surveyed.
 *
 * ## Why the plant counts live here and not in `hybrid.ts`
 *
 * Because at SBH-1336 they are **the real hardware**, and `hybrid.ts` is a sizing
 * model. It would put SBH-1336's bank at eighteen modules from its 5 kW load and its
 * array at three or five strings from its region's sun, and both would then
 * contradict the alarm list beside them — thirteen `Lithium Battery N Abnormal` rows
 * against an equipment tab reading eighteen modules, four `SSU N Fault` rows against
 * three strings. The alarm rows are not negotiable: they are addresses on a device.
 *
 * So the counts are stated here and `battery/data/banks.ts` and
 * `solar/data/systems.ts` defer to them. Energy is still the model's — every bank's
 * kWh, every array's kWp and every chart drawn from them are unchanged. What changes
 * is only **how that energy is divided into boxes**, which at SBH-1336 is the one
 * thing the model was guessing and the site actually knows, and at the other three
 * is the standard fit-out asserted in its place.
 *
 * ## Nothing here has been read
 *
 * `dyna-gw-001` runs 0.3.21 and the poll set is 0.3.43, which is unbuilt. Every
 * screen fed from this file therefore reports what the unit *watches*, never what
 * it has said — see `plantAlarms.ts` and the note the catalogue prints.
 */

export type MonitoringUnit = {
  /** The device as its readings are labelled — the `name` in the MQTT payload. */
  deviceName: string;
  /** Modbus slave id, as the gateway addresses it. */
  slaveId: number;
  /** The gateway on site, and the firmware the poll set belongs to. */
  gatewayId: string;
  /** What that gateway is actually running, which is not the poll set's version. */
  gatewayFirmware: string;
  pollFirmware: string;
  /** Entries in the poll table, and how many Modbus registers that is. */
  pollEntries: number;
  pollRegisters: number;
  /** How many of those entries are alarms, and how many are readings. */
  alarmRows: number;
  telemetryRows: number;
  /**
   * Lithium modules in the bank — the count the thirteen `Lithium Battery N
   * Abnormal` rows index, and the count the battery equipment tab must agree with.
   */
  batteryModules: number;
  /** Solar conversion units, one `SSU N Fault` and one `PV N Array Fault` each. */
  ssus: number;
  /**
   * Rectifiers in the plant, and what one of them is rated at.
   *
   * `rectifiers` is what `Rectifier Amount` should read, and it is the number that
   * makes `Rectifier Missing` and `Low Rectifier Capacity` checkable at all.
   *
   * The note that used to sit here said this was carried "although **nothing in this
   * app models a rectifier** … no equipment page does, because AC→DC conversion has
   * no page here". That stopped being true: the **subrack cabinet** is an asset now,
   * and these two are its nameplate — see `cabinet/data/cabinets.ts`. The pair is
   * why `rectifierKw` was added alongside; the count alone cannot say whether six
   * modules can carry the tower.
   *
   * 4 kW is off the firmware's own reasoning about this plant — "six rectifiers at
   * ~4 kW against a 3.2 kW load means five of six must be gone before headroom is
   * tight", which is the argument for `Low Rectifier Capacity` essentially never
   * firing here. ⚠️ It is a **stated figure, not a read one**: no register in the
   * poll set reports a module's rating, and nobody has read the shelf's labels.
   */
  rectifiers: number;
  rectifierKw: number;
  /**
   * What one solar conversion unit is rated at, kW — the `S4875G1`'s **4013 W**.
   *
   * A **stated figure, not a read one**, exactly as `rectifierKw` is. Nothing in the
   * poll set publishes a per-module rating; this is the part's datasheet, confirmed
   * 2026-08-26, for the part the site census counted. Four of them is 16.05 kW of
   * nameplate against a 16.20 kWp array — a DC:AC ratio of 1.009, which is the
   * corroboration worth having: the SSU stage was sized to the roof.
   *
   * ⚠️ **`shelf.ts` sizes with 7 kW per SSU, not 4.** That constant guesses a shelf
   * where no unit is fitted; this is the rating of the module actually in this one.
   * They are different kinds of number and they disagree — a sized shelf comes out
   * with fewer, larger units than the real site has. Worth reconciling, and not
   * silently, which is why both are documented where they are used rather than one
   * being quietly changed to match the other.
   */
  ssuKw: number;
};

/**
 * Keyed by site id, because the unit is site plant.
 *
 * Four entries now, of which one is a survey — see the warning at the top of this
 * file before quoting anything from the other three.
 *
 * It is not the battery's and not the array's, even though most of its alarms are
 * about one or the other: it is the box on the wall of the cabinet that watches the
 * whole −48 V plant. That is why the four alarm categories are a *routing* of one
 * device's rows rather than four devices — see `plantAlarms.ts`.
 */
const UNITS: Readonly<Record<string, MonitoringUnit>> = {
  'sbh-1336': {
    deviceName: 'Huawei SMU02C',
    slaveId: 33,
    gatewayId: 'dyna-gw-001',
    gatewayFirmware: '0.3.21',
    pollFirmware: '0.3.43',
    pollEntries: 80,
    pollRegisters: 89,
    alarmRows: 58,
    telemetryRows: 22,
    batteryModules: 13,
    ssus: 4,
    rectifiers: 6,
    rectifierKw: 4,
    ssuKw: 4.013,
  },

  /* The three below are **asserted, not surveyed** — see "The other three" above.
     Every field is the SBH-1336 record's, except the four that are each site's own:
     the gateway id, the two module counts `sizedShelf` had been modelling, and a
     battery module count divided out of that site's own bank at SBH-1336's 7.15 kWh
     per module. `alarmRows` is the count `plantAlarms` actually generates for those
     counts, because `PlantAlarmCatalogue` prints "N of the alarmRows alarms in its
     poll table" and a stated total that disagreed with the generated one would have
     the page contradict itself in a sentence. */
  'sbh-1495': {
    deviceName: 'Huawei SMU02C',
    slaveId: 33,
    gatewayId: 'dyna-gw-002',
    gatewayFirmware: '0.3.21',
    pollFirmware: '0.3.43',
    pollEntries: 78,
    pollRegisters: 87,
    alarmRows: 56,
    telemetryRows: 22,
    batteryModules: 11,
    ssus: 4,
    rectifiers: 5,
    rectifierKw: 4,
    ssuKw: 4.013,
  },
  'swk-0559': {
    deviceName: 'Huawei SMU02C',
    slaveId: 33,
    gatewayId: 'dyna-gw-003',
    gatewayFirmware: '0.3.21',
    pollFirmware: '0.3.43',
    pollEntries: 82,
    pollRegisters: 91,
    alarmRows: 60,
    telemetryRows: 22,
    batteryModules: 13,
    ssus: 5,
    rectifiers: 6,
    rectifierKw: 4,
    ssuKw: 4.013,
  },
  'swk-1163': {
    deviceName: 'Huawei SMU02C',
    slaveId: 33,
    gatewayId: 'dyna-gw-004',
    gatewayFirmware: '0.3.21',
    pollFirmware: '0.3.43',
    pollEntries: 77,
    pollRegisters: 86,
    alarmRows: 55,
    telemetryRows: 22,
    batteryModules: 10,
    ssus: 4,
    rectifiers: 5,
    rectifierKw: 4,
    ssuKw: 4.013,
  },
};

/** The unit at this site, or `undefined` — which is most sites. */
export const monitoringUnit = (siteId: string): MonitoringUnit | undefined => UNITS[siteId];

/** Whether anything on this site is instrumented. The predicate every screen asks. */
export const isMonitored = (siteId: string): boolean => UNITS[siteId] !== undefined;
