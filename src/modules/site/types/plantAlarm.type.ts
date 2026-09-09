import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';

/**
 * One alarm on the site's DC power plant monitoring unit.
 *
 * ## Why this is neither `GensetAlert` nor `SystemAlert`
 *
 * `GensetAlert` is a bit on a genset controller with a **threshold on a reading**
 * behind it, and the pair is what lets a card print the number that tripped it.
 * `SystemAlert` is this app's own arithmetic over a generation model, and carries a
 * `source` because there is no register to print. Neither fits.
 *
 * A plant alarm is a **register on somebody else's device that nobody has read
 * yet**. It has no threshold, because the setpoint lives in a configuration
 * register the poll set does not include. It has no `raisedAt`, because nothing has
 * raised. What it has instead is the one thing the other two never needed:
 *
 * ## Checkability, and why it is on the type rather than in a comment
 *
 * The register map's own rule is that **an alarm reading `0` is ambiguous three
 * ways** — healthy, hardware not fitted, or unsupported on this build — and nothing
 * in the protocol separates them. A `1` is always believable; something asserted
 * it. So every row is graded on what could catch it lying, and fourteen of the
 * fifty-eight can be caught by nothing at all.
 *
 * That is not a footnote. A page that lists an alarm without saying which kind it
 * is has told a reader that an unpopulated smoke port and a smoke-free site are the
 * same fact, and it did so silently. `checkability` is a required field for exactly
 * that reason: a row cannot be added to this catalogue without somebody deciding
 * what would contradict it.
 *
 * ## Why Huawei's severity is carried beside our own
 *
 * Not because they disagree — as things stand they never do; `severity` is
 * `SEVERITY_OF_HUAWEI[huawei]` on all fifty-eight rows. It is because **four
 * classes go into three chips**, so the chip alone cannot say which of the two
 * critical classes a row is. `Smoke Alarm` is the device's own `CA` and `Rectifier
 * Missing` is `MA`; both are a call-out and both render `Critical`, and an operator
 * choosing between two red rows at two in the morning wants the difference.
 *
 * It is also what makes any future disagreement legible rather than looking like a
 * transcription error — see `reranked`, which nothing sets today.
 */

/**
 * Where the alarm is routed — whoever fixes that thing.
 *
 * The rule is **where the thing physically is**, not what it does (Jeff, 2026-09-08):
 * anything that is a module in the power cabinet's subrack is `SITE`, whatever it
 * converts. That is what put the rectifier shelf and the four solar conversion units
 * in the same bucket as the cabinet door, and left `PV N Array Fault` — strings on a
 * roof — as the only `SOLAR` rows. `plantAlarms.ts` carries the argument and the
 * hardware it is drawn from.
 *
 * Two categories are **site-dependent** rather than fixed, and both are documented
 * where they are assigned: the nine per-phase AC rows are `GENSET` only because this
 * site has no utility incomer, and the DC bus pair is `SITE` rather than `BATTERY`
 * because a sagging bus is a generation problem.
 */
export const PLANT_ALARM_CATEGORIES = ['SITE', 'BATTERY', 'GENSET', 'SOLAR'] as const;

export type PlantAlarmCategory = (typeof PLANT_ALARM_CATEGORIES)[number];

/**
 * How each category is written on a chip, a tag and a cross-reference.
 *
 * `SITE` reads **`Cabinet`**, and the gap between the id and the word is deliberate.
 * The id is `SITE` because that is what these rows were called when the poll set was
 * written and what the source document still calls them, and renaming it would touch
 * every row of `plantAlarms.ts` to say the same thing. The word is `Cabinet` because
 * after the 2026-09-08 recategorisation that is what the rows *are*: all seventeen
 * are inside or on the `ICC330-H1-C8` — the surge arresters, the DC bus pair, the
 * load fuse in the distribution unit, the door, water and smoke sensors on the
 * enclosure, the rectifier shelf and the SSUs.
 *
 * It also has somewhere to point now. The cabinet is an asset with its own pages, so
 * a reader clicking `Cabinet 2` on the site's pooled tab lands on a page called
 * Subrack Cabinet; when the chip said `Site` it named the page it was already on.
 */
/**
 * Which part of the cabinet a `SITE` row is about — the third tier of filter.
 *
 * ## Why the Cabinet category needed splitting and the other three did not
 *
 * Because `Cabinet` is the only category that is not one thing. `Battery` is a bank,
 * `Solar` is an array, `Genset` is an engine; `Cabinet` is a **box with a shelf of
 * modules in it**, and after the 2026-09-08 recategorisation it is also the biggest
 * category on the plant at a grid-backed site — twenty-six rows, spanning a smoke
 * detector, a bus voltage, six rectifiers and four converters. "Something in the
 * cabinet is wrong" is a true statement that does not tell a technician what to put
 * in the van.
 *
 * Five parts, and each one is a different call-out:
 *
 * - `RECTIFIERS` — the AC→DC shelf. Four rows, and **every one of them is about the
 *   six as a group** rather than a bay, because rectifier addresses are hand-set on
 *   the LCD and the thirty per-rectifier registers are deliberately unpolled.
 * - `SSUS` — the solar conversion units in the same shelf. Five rows: one per bay,
 *   which is trustworthy because SSU identity is positional, plus `SSU Lost` for the
 *   group.
 * - `DISTRIBUTION` — the `DCDU-600AN1` and the −48 V bus leaving through it: the load
 *   fuse, the DC arrester, and the bus over- and under-voltage pair.
 * - `AC_INPUT` — what arrives before the rectifiers. One row at a site with no
 *   incomer and ten where there is one, because `categoryFor` re-files the nine
 *   per-phase rows out of `GENSET` the moment a grid exists.
 * - `ENCLOSURE` — the box itself: door, water, smoke. Not a module in the shelf and
 *   deliberately not filed as one.
 *
 * ## Why it is on the row and not a lookup beside it
 *
 * The obvious cheap version is a function mapping a row's name to a part, kept
 * wherever the filter is drawn. It would have worked and it would have been the
 * second list of these rows in the app — and the one that silently stops matching
 * when a row is added, because a name that classifies to nothing simply vanishes from
 * a filtered table rather than erroring.
 *
 * So the part is declared on the spec, one line under the category, and `SITE_PARTS`
 * below asserts that every `SITE` row has one. A new row without a part fails on
 * load rather than disappearing from a filter three months later.
 */
export const CABINET_PARTS = [
  'RECTIFIERS',
  'SSUS',
  'DISTRIBUTION',
  'AC_INPUT',
  'ENCLOSURE',
] as const;

export type CabinetPart = (typeof CABINET_PARTS)[number];

/**
 * How each part is written on its chip.
 *
 * Plural where the part is a group of bays and singular where it is one thing, which
 * is doing real work rather than being grammar: `Rectifiers 2` says two rows about
 * the shelf, and a reader who saw `Rectifier 2` would reasonably read it as the
 * second rectifier. The figure on the cabinet page has exactly that chip-versus-bay
 * collision available to it, so the two must not use one word.
 *
 * `Solar Supply Units` rather than `SSUs`. The chips sit under `Cabinet` beside
 * `Solar`, and an acronym is the wrong thing to make a reader decode while they are
 * choosing a filter — the device's own word is on the rows themselves, which is where
 * it has to be exact.
 *
 * It reads the vendor's name in full rather than the `Solar units` it used to, because
 * the cabinet page now does: the bays in the elevation are labelled
 * `Solar Supply Unit 1` to `4`, the panel beside them is headed with it, and the strip
 * and caption count them by it. A chip filtering rows about a part is the wrong place
 * for a fifth name for that part — and this is the widest of the five chips by some
 * way, which is the cost and the only one.
 */
export const CABINET_PART_LABEL: Record<CabinetPart, string> = {
  RECTIFIERS: 'Rectifiers',
  SSUS: 'Solar Supply Units',
  DISTRIBUTION: 'Distribution',
  AC_INPUT: 'AC input',
  ENCLOSURE: 'Enclosure',
};

export const PLANT_ALARM_CATEGORY_LABEL: Record<PlantAlarmCategory, string> = {
  SITE: 'Cabinet',
  BATTERY: 'Battery',
  GENSET: 'Genset',
  SOLAR: 'Solar',
};

/**
 * The device's own protection class, in its own letters.
 *
 * Left as the register map writes them rather than spelled out, because they are
 * what a reader will see on the SMU's own display and in Huawei's documentation,
 * and a page that renamed them would be a page nobody could check. The words are in
 * `HUAWEI_SEVERITY_LABEL` for the tooltip.
 */
export const HUAWEI_SEVERITIES = ['CA', 'MA', 'MI', 'WA'] as const;

export type HuaweiSeverity = (typeof HUAWEI_SEVERITIES)[number];

export const HUAWEI_SEVERITY_LABEL: Record<HuaweiSeverity, string> = {
  CA: 'Critical alarm',
  MA: 'Major alarm',
  MI: 'Minor alarm',
  WA: 'Warning',
};

/**
 * Huawei's class, read as this app's three chips — **rank order preserved**.
 *
 * Four classes into three chips, and the only join that keeps the ordering intact
 * is at the top: `CA` and `MA` are both a call-out, so both are `CRITICAL`. `MI` is
 * `WARNING` and `WA` is `NEUTRAL`, this app's "a note, not a problem" — the same
 * reading `Info` gets on a genset controller.
 *
 * ## Why `MA` is not pushed down to `WARNING`
 *
 * It was, and it was wrong. The argument for it was legibility: forty-six of the
 * fifty-eight rows are major, so `CRITICAL` covers most of the catalogue, and a
 * chip that says the same thing about nearly every row discriminates less than one
 * that spreads them out.
 *
 * That reasoning breaks on a single row. `AC L2 Phase Failure` is a dropped phase —
 * the site running on two of three, the rectifiers derating, somebody driving out
 * tonight — and it rendered as `Warning`, beside a coolant-temperature note rated
 * exactly the same. **A chip that is legible and wrong is worse than one that is
 * monotonous and right**, because the ranking exists to say what an operator does
 * about the row, and nobody turns out for a warning.
 *
 * The lopsidedness is real, and it is the device's rather than ours: an SMU02C's
 * alarm table genuinely is mostly service-affecting, because Huawei did not put a
 * register on the plant for conditions that do not matter. Sorting *within* the
 * critical band is what `checkability` and the corroboration note are for, and that
 * is where the useful discrimination on this page actually lives.
 *
 * A row may override this in either direction, and none does. See `reranked`.
 */
export const SEVERITY_OF_HUAWEI: Record<HuaweiSeverity, AlertSeverity> = {
  CA: 'CRITICAL',
  MA: 'CRITICAL',
  MI: 'WARNING',
  WA: 'NEUTRAL',
};

/**
 * What could catch this alarm lying, worst-first.
 *
 * Ordered so a reader scanning the list meets the untrustworthy grade first, which
 * is the opposite of how the register map orders it and deliberate: the page's job
 * is to stop somebody reading a quiet catalogue as a healthy site.
 */
export const CHECKABILITIES = ['ONE_WAY', 'ON_DEMAND', 'PARTIAL', 'BOTH_WAYS'] as const;

export type Checkability = (typeof CHECKABILITIES)[number];

export const CHECKABILITY_META: Record<
  Checkability,
  {label: string; blurb: string; textClassName: string}
> = {
  ONE_WAY: {
    label: 'one way only',
    blurb:
      'Nothing in the poll set can contradict this. Act on an assertion; conclude nothing from silence.',
    textClassName: 'text-severity-critical',
  },
  ON_DEMAND: {
    label: 'on demand',
    blurb:
      'An enable register would settle it, and the gateway does not read one yet. Until it does, a quiet row may be a disabled mechanism.',
    textClassName: 'text-severity-warning',
  },
  PARTIAL: {
    label: 'partial',
    blurb:
      'A polled reading should move with this, but not decisively. Suggestive, not conclusive.',
    textClassName: 'text-secondary',
  },
  BOTH_WAYS: {
    label: 'both ways',
    blurb:
      'A polled reading must agree with this. A contradiction is detectable continuously, in either direction.',
    textClassName: 'text-severity-ok',
  },
};

export type PlantAlarm = {
  /** `sbh-1336-5913` — this register on this site's unit. Unique across the estate. */
  id: string;
  /**
   * The Modbus register, as a number.
   *
   * **Held but not printed.** It is the row's identity and it is how an
   * invalidation names its target, so it has to be here; the catalogue does not
   * show it because a hex address is not what sends anybody to site, and the four
   * pages this feeds are read by operators rather than by whoever is writing the
   * firmware. `hexAddress` exists for the day that changes.
   */
  address: number;
  /**
   * The label the gateway publishes, exactly.
   *
   * ⚠️ **A published interface, not a display string.** Helios keys history on the
   * raw label, so renaming one orphans every reading ever stored under the old
   * name. That is why `Cumulative Mains Energy` keeps its name at a site with no
   * mains. Nothing on any screen may prettify these.
   */
  label: string;
  category: PlantAlarmCategory;
  /**
   * Which part of the cabinet this row is about, or `null` where the question does
   * not apply.
   *
   * `null` on every `BATTERY`, `SOLAR` and `GENSET` row, which is most of the table —
   * a bank is not in the subrack and neither is a roof. It is **never** null on a
   * `SITE` row, and `SITE_PARTS` in `plantAlarms.ts` asserts it: a Cabinet row with
   * no part would disappear from the site tab's third tier of filter rather than
   * failing, which is the quiet kind of wrong this whole type is written against.
   *
   * Note it is a property of the **row**, not of the category the row currently
   * lands in. The nine per-phase AC rows are `GENSET` at a site with no incomer and
   * `SITE` at one with a grid — see `categoryFor` — and they are on the AC input
   * either way. Deriving the part from the category would have made them lose it in
   * one of the two configurations.
   */
  part: CabinetPart | null;
  huawei: HuaweiSeverity;
  /**
   * This site's ranking — `SEVERITY_OF_HUAWEI[huawei]` unless `reranked` says why
   * not.
   */
  severity: AlertSeverity;
  /**
   * Why this row's severity is not the device's, or `null` where it is.
   *
   * **`null` on every row today.** The dashboard's rule is the register map's `Sev`
   * column and nothing else, so any row can be checked against the map and comes
   * out the same on all four tabs.
   *
   * The field stays because the source document asks for it. Its rule 2 is "never
   * inherit Huawei's severities unexamined", and `0x5900 SSU Lost` is the row it
   * names in bold: the device rates it a warning because it assumes solar is a
   * bonus, and at this site the array is the primary source. If that argument ever
   * wins, this is where it goes — prose rather than a flag, because a re-rank is an
   * argument and an operator who disagrees should be able to read it.
   *
   * **Which way it went is not stored**, because it is already known: compare
   * `severity` against `SEVERITY_OF_HUAWEI[huawei]` and the direction falls out. A
   * field for it could disagree with the pair it describes; `rerankDirection`
   * cannot.
   */
  reranked: string | null;
  checkability: Checkability;
  /**
   * The line the register trips on, as the rule reads — `< 180 V` — or `null` for a
   * row that has no line.
   *
   * ## Why so few rows have one
   *
   * Because a setpoint lives in a **configuration register the gateway does not
   * read**. The register map documents a threshold register, a factory default and a
   * settable band for the voltage alarms and for almost nothing else: a smoke
   * detector has no threshold, `Rectifier Missing` has no threshold, and a module's
   * own BMS decides for itself what abnormal means. So this is set on eight of the
   * fifty-eight rows and honestly `null` on the other fifty.
   *
   * ## What the number is, and what it is not
   *
   * **It is the factory default, not this plant's setting.** `0x2107` is settable
   * from 60 V to 300 V and nobody has read it here — that is precisely the "on
   * demand" problem the checkability grade describes, one register away from being
   * answered. A page that printed `< 180 V` as though it had been measured would be
   * asserting a setpoint nobody has confirmed, which is the same mistake the genset
   * module refuses to make on its own settings screen.
   *
   * So every one of these says `default` on the row, and the corroboration note
   * names the register that would settle it.
   */
  threshold: string | null;
  /** What the alarm means, in the register map's terms. One sentence. */
  meaning: string;
  /**
   * What in the poll set would catch it — the reasoning behind `checkability`.
   *
   * Never empty, including for a `ONE_WAY` row: "nothing polled can contradict a
   * `0`" is the note, and stating it is the whole point.
   */
  corroboration: string;
  /**
   * Readings this alarm makes meaningless while it is asserted, by their published
   * labels.
   *
   * Only two rows carry any, and they are the reason the field exists: the SMU
   * losing its internal bus to the rectifiers leaves three rectifier readings
   * returning their last values forever, and a failed temperature sensor takes the
   * temperatures and both temperature alarms with it. **Nothing else in the payload
   * says so** — a consumer that does not model this reads stale numbers as current
   * ones.
   */
  invalidates: ReadonlyArray<string>;
};

/**
 * Which way a re-rank went, for a row that has one.
 *
 * Both directions are legitimate and they read very differently on the page, which
 * is why this is derived rather than left to a caller's eye. **Up** is this site
 * saying the device under-rated something: `SSU Lost` ships as the device's lowest
 * class and is a generation shortfall here, because the array is the primary
 * source. **Down** is the opposite claim and the more common one on an AC bus with
 * no utility behind it — the device's classes assume a grid, and a register that
 * describes somebody else's network misbehaving describes this generator's own
 * regulator doing its job.
 *
 * A downgrade is the one that has to be shown quietly and shown anyway. Quietly,
 * because a row this site has decided not to shout about should not shout about not
 * shouting; anyway, because an operator comparing this page against Huawei's own
 * display has to be able to see that the difference is deliberate rather than a
 * transcription error.
 */
export const rerankDirection = (alarm: PlantAlarm): 'up' | 'down' | null => {
  if (alarm.reranked === null) return null;

  const inherited = ALERT_SEVERITIES.indexOf(SEVERITY_OF_HUAWEI[alarm.huawei]);
  const here = ALERT_SEVERITIES.indexOf(alarm.severity);

  // `ALERT_SEVERITIES` is ordered worst-first, so a *lower* index is more serious.
  return here === inherited ? null : here < inherited ? 'up' : 'down';
};

/** `0x5913`, for anywhere a register has to be quoted. */
export const hexAddress = (alarm: PlantAlarm): string =>
  `0x${alarm.address.toString(16).toUpperCase().padStart(4, '0')}`;

export {ALERT_SEVERITIES};
export type {AlertSeverity};

/** How many rows sit at each checkability — the counts above the catalogue. */
export const countByCheckability = (
  alarms: ReadonlyArray<PlantAlarm>,
): Record<Checkability, number> => {
  const counts: Record<Checkability, number> = {
    ONE_WAY: 0,
    ON_DEMAND: 0,
    PARTIAL: 0,
    BOTH_WAYS: 0,
  };
  for (const alarm of alarms) counts[alarm.checkability] += 1;
  return counts;
};
