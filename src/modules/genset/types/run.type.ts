/**
 * A run is the unit of work a genset does: one start to one stop.
 *
 * Runs are not something an operator creates. The controller opens one the
 * moment the engine starts and closes it the moment the engine stops, so the run
 * log *is* the machine's history — there is no way to have a run without the
 * engine having turned, and no way for the engine to turn outside a run.
 *
 * That is why `endedAt` is nullable rather than optional: exactly one run per
 * genset can be open, and `endedAt === null` is what marks it. Anything asking
 * "what is this genset doing right now" is asking about the open run.
 */
export type GensetRun = {
  id: string;
  gensetId: string;
  /** ISO 8601 — when the controller saw the engine come up. */
  startedAt: string;
  /** ISO 8601, or `null` while the engine is still turning. */
  endedAt: string | null;
  /** Energy delivered across the whole run, not an instantaneous rate. */
  energyProducedKwh: number;
  /** Diesel burned across the whole run. */
  fuelConsumedLitres: number;
};

/** True while the engine is still turning — the run the home page reports on. */
export const isOpen = (run: GensetRun): boolean => run.endedAt === null;

/**
 * How long the run has lasted, in milliseconds.
 *
 * An open run is measured to `now`, which is why the caller passes it: a page
 * that renders several runs should measure them all against one clock reading,
 * or two rows a millisecond apart can disagree about the current minute.
 */
export const runElapsedMs = (run: GensetRun, now: number = Date.now()): number => {
  const end = run.endedAt === null ? now : new Date(run.endedAt).getTime();
  return end - new Date(run.startedAt).getTime();
};
