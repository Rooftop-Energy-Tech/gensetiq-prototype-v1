/**
 * The DC power cabinet on a site — the subrack, and everything plugged into it.
 *
 * ## Why this is an asset and not a band on the site page
 *
 * Because it is the thing a technician is dispatched to, and until now it was the
 * only one of the four with nowhere to go. `monitoringUnit.ts` carried the rectifier
 * count with a note saying "nothing in this app models a rectifier … AC→DC
 * conversion has no page here", and the site's own Alarms category had seventeen
 * rows about a box the app never drew.
 *
 * That category settled the argument. After the 2026-09-08 recategorisation —
 * anything that is a module in the subrack is `SITE`, whatever it converts —
 * **every one of those seventeen rows is inside or on this cabinet**: both surge
 * arresters, the DC bus pair, the load fuse in the `DCDU-600AN1`, the door, water
 * and smoke sensors on the enclosure itself, the four rectifier rows and the five
 * SSU rows. There was already a complete alarm list for an asset with no page.
 *
 * ## Why only the instrumented site has one
 *
 * Every telecom site has a DC power plant — this is the most universal asset on the
 * estate, more so than a bank or an array. But the two facts that make a page worth
 * opening, **how many modules are in the shelf and what they are rated at**, are
 * real hardware at SBH-1336 and would be a guess anywhere else. `hybrid.ts` would
 * happily size a shelf from the load, and `monitoringUnit.ts` argues at length about
 * why that is the wrong kind of number: it would contradict the alarm rows beside
 * it, which are addresses on a device and not negotiable.
 *
 * So `subrackCabinet` answers `undefined` at the twenty-four sites with no unit, the
 * site rail drops the `Cabinet` row there, and nothing offers a door onto a page
 * that could only say "not instrumented". The day a second gateway goes in, one
 * entry in `UNITS` lights the whole section up.
 */
export type SubrackCabinet = {
  /** The cabinet's id, which is its site's — one DC plant per site. */
  id: string;
  siteId: string;
  /** The site's own name — `SBH-1336`. */
  siteName: string;
  locationLabel: string;
  /**
   * The monitoring unit on this cabinet's wall, as its readings are labelled, or
   * `null` where there is no unit — three of the four cabinets on this estate.
   *
   * `null` rather than a placeholder string, so every screen printing it has to say
   * what it does with an uninstrumented plant instead of rendering the word
   * "unknown" in the slot where a device name goes.
   */
  deviceName: string | null;
  /** Modbus slave id, as the gateway addresses it, or `null` with no unit. */
  slaveId: number | null;
  /**
   * Where the module counts come from.
   *
   * `READ` is `monitoringUnit.ts` — real hardware at the one site somebody has
   * visited. `SIZED` is `shelf.ts`'s model, which is the same footing the bank's kWh
   * and the array's kWp have stood on all along.
   *
   * It is on the cabinet rather than inferred from `deviceName` at each call site
   * because it is a claim about the *numbers*, and a screen quoting a module count
   * should not have to reason about a device name to find out how much to trust it.
   */
  shelf: 'READ' | 'SIZED';
  /** Rectifier modules in the shelf, and what one is rated at. */
  rectifiers: number;
  rectifierKw: number;
  /** Solar conversion units in the same shelf. */
  ssus: number;
  /**
   * What the rectifier shelf could pass, kW — `rectifiers × rectifierKw`.
   *
   * The **AC→DC** ceiling only. The SSUs add their own conversion beside it and are
   * deliberately not in this figure: the question this number answers is whether the
   * shelf can carry the tower when there is no sun, which is the state that ends in a
   * load-shed ladder. Adding the array's converters to it would answer that question
   * optimistically on exactly the night it matters.
   */
  capacityKw: number;
  /**
   * What the tower is drawing, kW — `null` when nothing is feeding it.
   *
   * `null` is an outage and says so rather than printing `0 kW`, which would read as
   * a load that had gone away. Every figure below is `null` in the same breath.
   */
  loadKw: number | null;
  /** The −48 V bus this cabinet delivers on, or `null` in an outage. */
  busVolts: number | null;
  busAmps: number | null;
  /**
   * What is holding the tower up, as this cabinet sees it.
   *
   * The shelf and the SSUs are in one box and only one of them is ever working: in
   * daylight the array carries through the SSUs and the rectifiers idle, and under a
   * genset or an incomer it is the other way round. A page that showed both
   * delivering would be describing a plant doing twice the tower's load.
   *
   * **`BATTERY` and `UNSERVED` are separate on purpose**, though the cabinet is
   * converting nothing in both. They are opposite facts: a bank carrying is a solar
   * hybrid working exactly as designed — it happens every night here — and an
   * unserved tower is an outage. An earlier version of this collapsed them into one
   * `NONE`, which made the page say "nothing converting" in a tone that fitted
   * neither.
   *
   * `MAINS` and `GENSET` both arrive through the rectifiers, which is what reduces
   * `siteFeed`'s five states to these four.
   */
  carrying: 'RECTIFIERS' | 'SSUS' | 'BATTERY' | 'UNSERVED';
  /** The enclosure's own temperature — see `enclosureTempC`. */
  tempC: number;
};

/**
 * `Cabinet | SBH-1336` — what the rail, the breadcrumb and the page heading print.
 *
 * The asset first and its site code second, matching `Battery | SBH-1336` and
 * `Solar | SBH-1336`: see `battery/types/bank.type.ts` for why every asset in this
 * app is named that way round now. The shelf's rating that used to stand here is
 * the third figure in the page's own summary band and a row in the rail's info
 * glyph, and it never told two cabinets apart — there is one DC plant per site.
 *
 * This is also what let the page heading drop its `Subrack Cabinet · ` prefix. The
 * heading said the type of the thing because the name did not; now the name does.
 */
export const cabinetName = (cabinet: SubrackCabinet): string =>
  `Cabinet | ${cabinet.siteName}`;

/**
 * How much of the shelf's capacity the tower's load would take, `0`–`1`.
 *
 * A **headroom** question rather than a throughput one: *could this shelf carry this
 * tower.* That distinction is the whole of why it is computed against the load rather
 * than against what the rectifiers are actually passing — which, at this site, is
 * nothing for most of the day.
 *
 * A shelf idling behind a generating array or a discharging bank is the plant working
 * as designed, and a reading of zero through all of it would have nothing to say on
 * the one question a plant engineer opens this page with. Read as headroom it is true
 * in every state: 5 kW against 24 says the shelf could take the tower the moment the
 * sun goes in, which is exactly the event it exists for.
 *
 * ## It is a badge now, not a dial
 *
 * This was the page's hero `TickGauge` and it is `79% headroom` in a badge instead.
 * The argument above survives the change intact and is the reason for it: a dial
 * looks like a measurement of *now*, and this was never that — it was an answer to a
 * hypothetical, sitting a fifth of the way round a scale whose two ends were both
 * printed in the strip directly above it.
 *
 * As a percentage it also says the thing a reader wants, which the arc could not. A
 * telecom plant is specified N+1 and this one is nearer N+4 — six modules at 4 kW
 * against a 5 kW tower — so `79% headroom` is four of the six gone before the fifth
 * is in trouble. A needle sitting low was merely low.
 *
 * The badges beside it are what say whether the shelf is currently converting at all,
 * and the bays in the figure below read `0.0 kW` and `standby` when it is not.
 *
 * `0` in an outage rather than `null`: an unserved tower is genuinely drawing nothing,
 * so the headroom is genuinely total. The strip says `Not served` in words, which is
 * where that fact belongs.
 */
export const cabinetDuty = (cabinet: SubrackCabinet): number =>
  cabinet.capacityKw > 0 && cabinet.loadKw !== null
    ? Math.min(1, cabinet.loadKw / cabinet.capacityKw)
    : 0;
