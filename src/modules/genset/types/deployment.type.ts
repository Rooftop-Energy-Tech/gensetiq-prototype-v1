/**
 * A deployment is the unit a mobile fleet is *managed* in: one contiguous
 * period during which a genset stands at one site and its runs, fuel and
 * alarms are attributable to one operational posting.
 *
 * The shape mirrors the production data model (Helios `DeploymentSession`):
 * `endedAt` is `null` while the posting is ongoing, exactly one deployment per
 * genset may be open, and the fuel level is persisted across postings by
 * recording the level when the deployment opened (`startFuelLitres`) and the
 * level at close (`endFuelLitres`, `null` until then). The live level during
 * an open deployment is *derived* — tank telemetry, not a stored figure.
 *
 * A run answers "when did the engine turn"; a deployment answers "where was
 * the machine posted, and what did the posting cost". The distinction is why
 * both exist: a fortnight's posting at a substation may contain thirty runs,
 * and the questions asked of it — litres in, litres burned, hours on load —
 * are asked of the fortnight, not of any one run.
 */
export type DeploymentSession = {
  id: string;
  gensetId: string;
  /** The yard this posting stood the machine at. */
  siteId: string;
  /** The yard's placename at the time — copied so history survives a site rename. */
  locationLabel: string;
  /** The lorry that carried the set out — the dispatch fact the feed shows. */
  lorryPlate: string;
  /** ISO 8601 — when the posting opened. */
  startedAt: string;
  /** ISO 8601, or `null` while the posting is ongoing. */
  endedAt: string | null;
  /** Tank level when the posting opened, litres. */
  startFuelLitres: number;
  /** Tank level recorded at close, litres — `null` while ongoing. */
  endFuelLitres: number | null;
};

/** True while the posting is ongoing — the row the dispatch feed leads with. */
export const isOngoing = (deployment: DeploymentSession): boolean => deployment.endedAt === null;

/**
 * How long the posting has lasted, in milliseconds.
 *
 * An ongoing posting is measured to `now`, which is why the caller passes it:
 * a feed rendering several postings should measure them all against one clock
 * reading, or two rows a millisecond apart can disagree about the current day.
 */
export const deploymentElapsedMs = (
  deployment: DeploymentSession,
  now: number = Date.now(),
): number => {
  const end = deployment.endedAt === null ? now : new Date(deployment.endedAt).getTime();
  return end - new Date(deployment.startedAt).getTime();
};
