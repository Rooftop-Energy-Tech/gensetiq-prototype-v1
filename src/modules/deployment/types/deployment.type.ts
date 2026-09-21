/**
 * A deployment is the unit a mobile fleet is *managed* in: one job, at one site,
 * over one window, with the machines that stood there on it.
 *
 * ## Why the window is on the job and not on the machine
 *
 * The record this replaces was one posting per genset, each with its own window —
 * the shape Helios `DeploymentSession` has. That models the paperwork correctly and
 * models the *work* wrongly: a yard that needs three sets for five weeks is one job,
 * and three records with identical dates is that job with its identity taken away.
 * Tristan's call, 2026-09-21: the job owns the window, and a machine's presence on
 * it is a `DeploymentMembership` with no dates of its own.
 *
 * What that buys is one elapsed time, one set of totals and one "collect the job"
 * action. What it costs is stated plainly, because it is the thing to revisit first:
 * **a fourth set arriving in week three cannot join this job.** It needs a successor
 * job, which splits the identity in two. If that turns out to be how Express
 * Mission actually work, the two dates move onto the membership and nothing else
 * here changes.
 *
 * ## What is derived, and what is stored
 *
 * The **state** is derived from the window and the clock, never stored: a stored
 * state is a second answer to a question the window already answers, and the two
 * drift the moment a demo sits overnight. A **genset's site** is derived from its
 * active membership, which is the whole point of the model — a machine is at a yard
 * because a job puts it there. See `modules/genset/data/deployment.ts` for the
 * derivation and for why its *position* is last-known rather than derived.
 *
 * A run answers "when did the engine turn"; a job answers "where was the fleet
 * posted, and what did the posting cost". The distinction is why both exist: a
 * fortnight at a substation may contain thirty runs, and the questions asked of it —
 * litres in, litres burned, hours on load — are asked of the fortnight.
 */
export type Deployment = {
  id: string;
  /** `DEP-0142`. What the operations room says out loud. */
  reference: string;
  /** The yard this job stood the machines at. */
  siteId: string;
  /** The yard's placename at the time — copied so history survives a rename. */
  locationLabel: string;
  /** ISO 8601. May be in the future, which is what `planned` means. */
  startsAt: string;
  /** ISO 8601, or `null` while the job is open. */
  endsAt: string | null;
};

/**
 * One machine on one job.
 *
 * **No window of its own: the job owns that.** A machine joins at the job's start
 * and leaves at its close, which is what "one shared window" means and why there is
 * no `startsAt` here.
 *
 * `collectedAt` is the one date, and it is a *close* rather than a window. It exists
 * because collecting one set early is a real thing a reader does on an active job,
 * and the alternative was deleting the membership — which would take the machine out
 * of the record as though it had never stood there. A job that ran a fortnight with
 * one of its three sets pulled out on day nine is a fact worth keeping.
 *
 * The two fuel figures are the tank at the machine's own edges, which is what makes
 * fuel attributable per machine on a job that has three of them. The live level
 * during an open posting is *derived* from tank telemetry rather than stored. The
 * plate is here rather than on the job because each set rides its own lorry.
 */
export type DeploymentMembership = {
  id: string;
  deploymentId: string;
  gensetId: string;
  /** The lorry that took this set out. */
  lorryPlate: string;
  /** Tank level when the machine arrived, litres. */
  startFuelLitres: number;
  /** Tank level when it was collected, litres — `null` while it is still standing. */
  endFuelLitres: number | null;
  /**
   * ISO 8601 if this machine left before the job closed, `null` if it stayed to the
   * end. A membership with `collectedAt` set on an *active* job is a machine that
   * has gone home while the job runs on.
   */
  collectedAt: string | null;
};

/**
 * Three states, and all three are readings of the window against the clock.
 *
 * `planned` is the one the earlier model could not hold at all: a commitment that
 * has not started, which is what a mobilisation is. It moves nothing — the machines
 * on a planned job stay where they are standing, and the lorry is not called by an
 * app that has no dispatch write path.
 */
export const DEPLOYMENT_STATES = ['planned', 'active', 'completed'] as const;

export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

/**
 * Which state a job is in, at one clock reading.
 *
 * `now` is passed rather than read for the reason `deploymentElapsedMs` gives: a
 * screen drawing eighty jobs should measure them all against one reading, or two
 * rows a millisecond apart can disagree about whether a job has started.
 */
export const deploymentState = (deployment: Deployment, now: number): DeploymentState => {
  if (deployment.endsAt !== null && new Date(deployment.endsAt).getTime() <= now) {
    return 'completed';
  }
  return new Date(deployment.startsAt).getTime() > now ? 'planned' : 'active';
};

/** True while the job is standing — the row the register leads with. */
export const isActive = (deployment: Deployment, now: number): boolean =>
  deploymentState(deployment, now) === 'active';

/**
 * How far the job has actually got: its close, or `now`.
 *
 * **Clamped at the present**, which matters because an active job may carry an
 * *agreed* end in the future. Returning that would make a bar on the timeline claim
 * days the machines have not yet stood, and a window's totals read against energy
 * nobody has produced. The agreed end is a separate fact, drawn as the dashed tail
 * on the timeline and stated as `Agreed end` on the job's own page.
 */
export const deploymentEndMs = (deployment: Deployment, now: number): number =>
  deployment.endsAt === null ? now : Math.min(new Date(deployment.endsAt).getTime(), now);

/**
 * How long the job has stood, in milliseconds.
 *
 * Measured to `now` on anything still running, including a job quoted to a date in
 * the future: a five-week hire in its first week has stood a week, and reading the
 * agreed end would have it standing five. A planned job has not started, so it is
 * zero rather than the negative number a naive subtraction would give.
 */
export const deploymentElapsedMs = (deployment: Deployment, now: number): number => {
  const start = new Date(deployment.startsAt).getTime();
  if (start > now) return 0;
  return Math.max(0, deploymentEndMs(deployment, now) - start);
};

/**
 * Do two job windows overlap?
 *
 * Half-open `[start, end)`, so a job ending at the moment the next one starts is
 * **not** a conflict: a set collected on the 14th and dropped somewhere else on the
 * 14th is an ordinary day's work, and refusing it would make the commonest
 * transfer impossible. An open-ended job runs to infinity, which is why an
 * unclosed job blocks everything after it.
 */
export const windowsOverlap = (left: Deployment, right: Deployment): boolean => {
  const leftStart = new Date(left.startsAt).getTime();
  const leftEnd = left.endsAt === null ? Number.POSITIVE_INFINITY : new Date(left.endsAt).getTime();
  const rightStart = new Date(right.startsAt).getTime();
  const rightEnd =
    right.endsAt === null ? Number.POSITIVE_INFINITY : new Date(right.endsAt).getTime();

  return leftStart < rightEnd && rightStart < leftEnd;
};

/**
 * One machine's posting: its membership joined to the job it is on.
 *
 * The genset side of the app asks per-machine questions — what has this set been on,
 * what did each posting cost, where is it now — and every one of them needs fields
 * from both records. This is that join, and it is what a machine's own pages read
 * in place of the per-genset session they used to.
 */
export type GensetPosting = {
  deployment: Deployment;
  membership: DeploymentMembership;
};

/**
 * When this machine's posting ended, or `null` while it is still standing.
 *
 * An early collection wins over the job's own close, which is the whole reason
 * `collectedAt` exists: the machine's runs, fuel and hours belong to the days it
 * was actually there.
 */
export const postingEnd = (posting: GensetPosting): string | null =>
  posting.membership.collectedAt ?? posting.deployment.endsAt;

/** True while the machine is standing on the job: it has neither closed nor left. */
export const isStanding = (posting: GensetPosting, now: number): boolean =>
  posting.membership.collectedAt === null && isActive(posting.deployment, now);
