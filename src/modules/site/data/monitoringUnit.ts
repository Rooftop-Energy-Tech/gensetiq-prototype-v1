/**
 * The sites with a real monitoring unit on them, and what it is wired to.
 *
 * ## Why one site and not the estate
 *
 * Because one site is what is true. Every other figure in this prototype is
 * derived from a load and a hash — a bank sized from autonomy, an array sized from
 * peak sun hours — and that is honest for an estate nobody has visited. **SBH-1336
 * stands for J1PT**, where a gateway is actually going in against a Huawei SMU02C,
 * and the poll set below is the one in
 * `esp32/docs/smu02c-alarms-chosen.md` at firmware 0.3.43.
 *
 * So this file is the estate's one exception, and it is deliberately shaped as an
 * exception: a lookup that answers `undefined` for the other twenty-four sites, so
 * every screen reading it has to say what it does where no unit is fitted rather
 * than drawing a page of zeroes. A reader clicking through the estate sees the
 * alarm catalogue at exactly the site that has one, which is the difference between
 * a prototype and a mock-up.
 *
 * ## Why the plant counts live here and not in `hybrid.ts`
 *
 * Because they are **the real hardware**, and `hybrid.ts` is a sizing model. It
 * would put SBH-1336's bank at eighteen modules from its 5 kW load and its array at
 * three or five strings from its region's sun, and both would then contradict the
 * alarm list beside them — thirteen `Lithium Battery N Abnormal` rows against an
 * equipment tab reading eighteen modules, four `SSU N Fault` rows against three
 * strings. The alarm rows are not negotiable: they are addresses on a device.
 *
 * So the counts are stated here and `battery/data/banks.ts` and
 * `solar/data/systems.ts` defer to them for this site. Energy is still the model's
 * — the bank's kWh, the array's kWp and every chart drawn from them are unchanged.
 * What changes is only **how that energy is divided into boxes**, which is the one
 * thing the model was guessing and the site actually knows.
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
};

/**
 * Keyed by site id, because the unit is site plant.
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
  },
};

/** The unit at this site, or `undefined` — which is most sites. */
export const monitoringUnit = (siteId: string): MonitoringUnit | undefined => UNITS[siteId];

/** Whether anything on this site is instrumented. The predicate every screen asks. */
export const isMonitored = (siteId: string): boolean => UNITS[siteId] !== undefined;
