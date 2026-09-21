
/**
 * The three states a genset reports. Ordered by how much they want attention —
 * `RUN_STATES` is the sort key used by the "state" column, so a working unit
 * surfaces above a silent one.
 */
export const RUN_STATES = ['RUNNING', 'IDLE', 'OFFLINE'] as const;

export type RunState = (typeof RUN_STATES)[number];

export type GensetActivityKind = 'START' | 'STOP' | 'REFUEL' | 'SERVICE' | 'DEPLOY' | 'NOTE';

/**
 * Why this unit's run began — the controller's own reason for cranking.
 *
 * Two, and the distinction is the difference between an incident and a scheduled
 * chore:
 *
 * - `OUTAGE` — the mains failed and the controller picked the load up. The site
 *   is on generator because it has to be.
 * - `TEST` — a periodic exercise. Standby plant that is never run seizes, so it is
 *   started deliberately on a schedule, beside a perfectly healthy grid.
 *
 * It lives on the genset because starting is something a *controller* does, and it
 * is what lets the site page's intake meter agree with this unit's activity feed:
 * a set running on `TEST` cannot be drawn as evidence of a mains failure, which is
 * precisely the wrong answer an earlier version of the site diagram gave.
 */
export type StartReason = 'OUTAGE' | 'TEST';

export type GensetActivity = {
  id: string;
  kind: GensetActivityKind;
  message: string;
  /** ISO 8601. */
  at: string;
  /**
   * Where the entry came from — the controller's own event stream, the
   * dispatch feed, the service log, or a person typing.
   * Displayed beside the timestamp, because an audit trail whose entries
   * cannot say who put them there is a list rather than a log.
   */
  source?: string;
};

export type Genset = {
  id: string;
  /**
   * The machine's **serial number**, e.g. `CUM-739893` — its name everywhere in the
   * app, and what the search box matches first.
   *
   * It was a placename-derived asset tag: `KPT8033` at Kapit, `BLG4884` at Belaga.
   * That is a *stationary* convention and it breaks on the first lorry — a machine
   * called `KPT8033` standing in Tawau is a register arguing with itself, and on a
   * fleet whose whole subject is that machines move, it would be wrong more often
   * than right. A serial belongs to the machine and travels with it.
   *
   * Prefixed by the maker — `CUM`, `CAT`, `PRK`, `DNY`, `FGW`, `KHL` — because the
   * one thing a reader most often wants off a name in a list is what kind of set it
   * is, and the model column is not always beside it.
   */
  tag: string;
  /** e.g. `Cummins 1000 kVa`. */
  model: string;
  runState: RunState;
  /**
   * Why the current run started — or, on a stopped unit, why the last one did.
   *
   * Always present rather than optional-when-idle: every unit in the log has been
   * started by something, and a nullable field here would push the "we don't know"
   * case onto every reader for a fact that is never actually unknown.
   */
  startReason: StartReason;
  /**
   * The lorry or trailer plate this machine is registered under, or `null` when it
   * has none — a set on a plinth is not a road vehicle.
   *
   * **Every machine on this estate has one**, because every machine on it moves:
   * a set is dropped at a yard for a job measured in weeks and collected again, and
   * the plate is how it is identified on the road and on a delivery order. It stays
   * nullable rather than becoming required, for the reason `siteId` is: "this
   * machine has no plate" is a fact the register must be able to hold the day a set
   * is bolted down, and the details block already prints the row only when there is
   * one.
   *
   * Not to be confused with `DeploymentSession.lorryPlate`, which is the lorry that
   * *carried* the machine on one posting. This is the machine's own registration.
   */
  plateNumber: string | null;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /**
   * The site this unit is installed at, e.g. `wpkl-0207` — or `null` when it is in
   * the depot, owned but not deployed.
   *
   * The relationship is held **here rather than as a member list on the site**, and
   * that is the half of the old invariant still doing work: a unit can be at one
   * site or no site, never two, and a site cannot claim a unit that does not exist.
   * A hand-maintained list on the site gets both of those wrong eventually.
   *
   * The half deliberately given up is "never at no site". It was true only because
   * nothing could move a machine; once a set can be detached, a depot is where it
   * goes — and gensets genuinely exist before they are deployed and while they are
   * away being serviced. Pretending otherwise would force every removal to be a
   * transfer to somewhere it is not.
   *
   * `fleet.ts` seeds it. `deployment.ts` is what changes it.
   */
  siteId: string | null;
  /**
   * Human-readable placename, e.g. `Petaling Jaya, Selangor`.
   *
   * This is the *site's* placename — two gensets at the same site necessarily
   * report the same one, and `sites.ts` reads it back off them.
   */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /** ISO 8601 — when telemetry last arrived from this unit. */
  lastUpdated: string;
  activity: Array<GensetActivity>;
};

/**
 * `Genset | WPKL-0207` — the asset, then the site it stands at.
 *
 * It read `Genset | BRF9540` until 2026-09-14, naming the machine by its own tag.
 * The tag is a placeholder: this estate has no genset names recorded yet, and a
 * fixture tag is not one — so the name falls back to the fact the prototype can
 * actually answer for, which is where the set is. The bank, the array and the
 * cabinet already name their site, so this is the shape the other three use.
 *
 * ⚠️ **Five sites on this estate hold two sets, so five pairs of rows now carry the
 * same name.** That is the cost of the fallback and it is not a rendering fault:
 * the register still keys, selects and links by `genset.id`, so the rows are
 * distinct objects that happen to read alike. The tag has not gone anywhere — it is
 * still on the `Genset` record and still what the search box matches — so restoring
 * it, or appending it where a site holds a pair, is a change to this one line.
 *
 * The model this used to carry is in the rail's info glyph, one row under the
 * serial. It is not what identifies a set, and the name's job here is to say *what
 * kind of thing* the page is about before saying which one.
 */
export const gensetName = (genset: Genset): string => `Genset | ${gensetLabel(genset)}`;

/**
 * What a machine is called — **its road plate**, `WVA 5385`.
 *
 * ## It was the serial until 2026-09-21
 *
 * `genset.tag`, `CUM-739893`. Unique and durable, but nobody in the yard says it:
 * the plate is what is painted on the machine, what the driver quotes over the
 * radio, and what a refuel docket is signed against. The serial has not gone
 * anywhere — it is the `Asset tag` line on the detail shell, and the search box
 * still matches it — so a reader who knows a set by its serial can still find it.
 *
 * Every seeded unit on both estates carries a plate and no two share one, so the
 * register keys, sorts and reads distinctly. The fallback to the tag is for the
 * machine that arrives without a plate recorded, which the seed allows.
 *
 * ## And it was the site's name before that
 *
 * `siteLabel(genset.siteId)`, falling back to the tag only for a set in the depot.
 * That was defensible on a permanent estate, where a set is bolted beside one tower
 * for its life and "the machine at PPU-022" identifies it as well as anything.
 *
 * On a mobile fleet it is wrong twice over. A machine posted to PPU-022 was *called*
 * PPU-022 until the lorry came and then called something else — a name that changes
 * when nothing about the object has — and **two sets standing in one yard had the
 * same name**, which a register whose rows are machines cannot afford. It also made
 * the fleet list a list of places: sort it by name and you were sorting by where
 * things happened to be.
 *
 * The serial fixed both — the machine's own, and it survives the drive — and the
 * plate now does the same job in the words the fleet actually uses.
 *
 * Where the machine *is* has not gone anywhere — it is the `Location` column beside
 * this one on the register, and the deployment log's whole subject.
 *
 * **`gensetName` above is still the right one for a detail page**: a page titled
 * `WVA 5385` alone does not say what kind of thing it is about, and the rail it
 * sits in lists the site's other assets. A column header cannot be in two places at
 * once; a page title has to carry its own.
 */
export const gensetLabel = (genset: Genset): string => genset.plateNumber ?? genset.tag;
