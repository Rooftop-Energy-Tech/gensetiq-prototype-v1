/**
 * An installation is the unit a **permanent** estate is managed in: the period
 * during which one genset is fitted at one site and its runs, fuel and alarms
 * are attributable to that fitting.
 *
 * The shape mirrors the production data model (Helios `DeploymentSession`) and
 * the mobile-fleet build reads it as a *posting* — dropped at a yard, run,
 * collected, dropped somewhere else. Nothing about the record changes here;
 * what changes is how many of them a machine has. On this estate a genset is
 * bolted to a plinth beside the tower it feeds, so it has **one** installation,
 * opened at commissioning and still open. Movement exists — a set goes to the
 * workshop and a replacement takes the plinth — and when it does it closes one
 * record and opens another, which is exactly what `endedAt` is for.
 *
 * `endedAt` is `null` while the installation stands, exactly one may be open per
 * genset, and the fuel level is persisted across installations by recording the
 * level at commissioning (`startFuelLitres`) and the level at removal
 * (`endFuelLitres`, `null` until then). The live level is *derived* — tank
 * telemetry, not a stored figure.
 *
 * A run answers "when did the engine turn"; an installation answers "since when
 * has this machine been the one feeding this site, and what has it cost". On a
 * mobile fleet that second question is asked of a fortnight. Here it is asked of
 * a year, which is why the answer belongs on the site rather than in a log of
 * its own.
 */
export type Installation = {
  id: string;
  gensetId: string;
  /** The site this installation stands the machine at. */
  siteId: string;
  /** The site's placename at the time — copied so history survives a rename. */
  locationLabel: string;
  /** Who commissioned the set onto the plinth — the record's responsible party. */
  installer: string;
  /** ISO 8601 — when the set was commissioned here. */
  startedAt: string;
  /** ISO 8601, or `null` while the set is still fitted. */
  endedAt: string | null;
  /** Tank level at commissioning, litres. */
  startFuelLitres: number;
  /** Tank level recorded at removal, litres — `null` while fitted. */
  endFuelLitres: number | null;
};
