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
 * ## Which sites have one
 *
 * Every telecom site has a DC power plant — this is the most universal asset on the
 * estate, more so than a bank or an array. For a while only the instrumented one had
 * a page, on the argument that **how many modules are in the shelf** would be a guess
 * anywhere else and would contradict the alarm rows beside it, which are addresses on
 * a device and not negotiable.
 *
 * `shelf.ts` narrowed that argument to where it holds. A contradiction needs something
 * to contradict, and at a site with no unit there is nothing indexing a slot — so a
 * shelf sized from the bank's recharge duty is in exactly the position the bank and
 * the array are already in, both of which `hybridPlant` sizes. `siteHasCabinet` gives
 * a page to every solar hybrid, `shelf` carries `READ` or `SIZED`, and every screen
 * that prints a module count says which it is looking at.
 *
 * So `subrackCabinet` answers `undefined` only where there is neither a unit nor an
 * array, and the site rail drops the `Cabinet` row there. **The traced elevation is
 * drawn at every one of them**, which it was not: it used to require a shelf that had
 * been counted, on the argument that the front of a box is not something a model can
 * size. The bays are a fact about the cabinet model and the modules in them are the
 * site's, so the geometry is shared and `fitted` carries the difference — a
 * five-rectifier shelf is this drawing with one bay drawn empty. See `shelfLayoutFits`,
 * which now asks only whether the counts fit the bays.
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
   * What one of them is rated at, kW, or `null` where nothing states it.
   *
   * `null` on a sized shelf, and that is the whole reason it is nullable: a rating is
   * a fact about a part somebody identified, and at a site where the module count was
   * modelled rather than counted there is no part to have a datasheet. The panel
   * prints `—` there rather than borrowing this site's figure.
   */
  ssuKw: number | null;
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
  /**
   * What the array is making, kW — and therefore what the SSUs are converting.
   *
   * `0` at night and at a site with no array. It is **not** a share of `loadKw` and
   * that is the point: at 08:40 this site's roof makes 1.1 kW against a 5 kW tower, so
   * the bank carries and `carrying` reads `BATTERY` — but 1.1 kW is flowing through
   * the solar units onto the bus the whole time.
   *
   * The shelf used to divide the tower's load across whichever group `carrying` named
   * and give the other group zero, which drew four SSU bays reading `0.0 kW` under a
   * generating array. One group can be the one *carrying the tower*; both can be
   * *converting*. See `subrackModules`.
   */
  solarKw: number;
  /**
   * What the bank is doing, kW — **positive discharging, negative charging.**
   *
   * Carried so the shelf's caption can say whether the array is charging the bank or
   * merely offsetting it, which is the difference between a hybrid working and a
   * hybrid falling behind. The sign convention is `HybridState.batteryKw`'s and is
   * not reinterpreted here.
   *
   * ⚠️ **Not an energy balance with `solarKw` and `loadKw`.** At noon this site makes
   * 13.7 kW against a 5 kW tower while the bank charges at 4.4 kW, and 13.7 − 5 is
   * not 4.4. `hybridState` models the three curves separately and nothing in this app
   * reconciles them, so the caption reads the *sign* of this figure and never
   * subtracts it from anything.
   */
  batteryKw: number;
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
 * What is happening on this cabinet's bus, in the words the shelf's caption prints.
 *
 * ## Why it is clauses and not one of four labels
 *
 * It was a `Record` keyed on `carrying`, which said exactly one thing was going on.
 * That is wrong about a hybrid, and wrong in the ordinary case rather than an edge
 * one: `carrying` names whichever source is holding the *tower* up, and at 08:40 here
 * that is the bank — while 1.1 kW from the roof is running through the solar units
 * onto the same bus. Both facts are true and a single label had to drop one.
 *
 * So each thing that is happening contributes a clause and they are joined. Every
 * combination the plant can reach comes out readable, including the two-source ones
 * the old map could not express — a grid-backed site converting mains through the
 * rectifiers *and* sun through the SSUs at the same time.
 *
 * ## What each clause is read from
 *
 * - **Rectifiers** from `carrying`, because they only pass the tower's load and only
 *   when they are the ones passing it.
 * - **Solar units** from `solarKw`, because they convert whatever the roof makes
 *   whoever is carrying.
 * - **The bank** from the *sign* of `batteryKw`, never from arithmetic on the other
 *   two — see the warning on that field.
 *
 * `Nothing served, shelf idle` only when no clause fired at all, which is a genuine
 * outage rather than a quiet shelf.
 *
 * ## Why this replaced `cabinetDuty`
 *
 * The page used to carry a hero dial of the tower's load against the shelf's ceiling,
 * then three badges where the dial had been, and now neither: the shelf itself is the
 * page. `cabinetDuty` existed for that dial and then for a `79% headroom` badge, and
 * both figures it was built from — the load and the capacity — are columns in the
 * strip at the top of the page, so it went with them rather than staying as an export
 * nothing called.
 *
 * This is the one thing those badges said that the strip cannot. A bus output of 5 kW
 * does not say whether the rectifiers, the solar units or the bank is providing it,
 * and that is the first question anybody opens a cabinet page with. It belongs on the
 * shelf's caption rather than in a band of its own, because it is a fact *about the
 * shelf* — the bays in the drawing under it agree with it to the kilowatt.
 */
export const cabinetFlowLabel = (cabinet: SubrackCabinet): string => {
  const clauses: Array<string> = [];

  if (cabinet.carrying === 'RECTIFIERS') clauses.push('rectifiers carrying');
  if (cabinet.solarKw > 0) clauses.push('Solar Supply Units converting');

  if (cabinet.batteryKw < 0) clauses.push('bank charging');
  else if (cabinet.batteryKw > 0) clauses.push('bank carrying');

  if (clauses.length === 0) return 'Nothing served, shelf idle';

  // Every clause is written lower case and the sentence is capitalised once, at the
  // front, whichever clause got there first. Capitalising them individually read as
  // `Bank carrying` at night and `Rectifiers carrying, bank carrying` under a genset —
  // the same clause with two different capitals depending on what else was true.
  //
  // `Solar Supply Units` is the exception and not a break in the rule: it is the
  // vendor's name for the part, so its capitals belong to it wherever it lands in the
  // sentence. The leading upper-case below is a no-op when that clause comes first.
  const sentence = clauses.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};
