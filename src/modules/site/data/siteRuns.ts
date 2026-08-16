import {gensetRuns} from '@/modules/genset/data/history';
import type {Genset} from '@/modules/genset/types/genset.type';
import type {GensetRun} from '@/modules/genset/types/run.type';
import type {SiteGenset} from './sites';

/**
 * A site's run log: every set standing here, merged into one time-ordered list.
 *
 * ## Why this lives in the site module
 *
 * Membership flows one way. Gensets name their site and the site module groups
 * them, so the site module imports the genset module and never the reverse. A
 * `siteRuns()` sitting beside `gensetRuns()` in `genset/data/history.ts` would
 * close that loop for one convenience function.
 *
 * ## Why it takes the members rather than a site id
 *
 * Because membership is **live**. Sets can be attached and detached
 * (`genset/data/deployment.ts`), so "which machines stand here" is a question with
 * a changing answer, and looking it up in here would freeze it at whatever it was
 * when this ran. Taking the summary's own members means the log follows the same
 * store every other tab on the site reads, and cannot list a set the header has
 * already let go of.
 *
 * ## What a merged log can say that a single set's cannot
 *
 * **Coverage.** Two sets alternating read as an interleaved list, and a stretch
 * where neither ran is a gap in the site's supply rather than a quiet spell for one
 * machine. That is this tab's justification for existing beside the per-genset one.
 *
 * ## The caveat this cannot fix
 *
 * A run is a fact about a *machine*, and a machine's site can change. This lists
 * the runs of the sets standing here **now**, so a set that arrived last week
 * brings its whole history with it, including runs it performed in another yard.
 *
 * Fixing that needs a time-bounded record of where a machine was, which this app
 * does not model — a `Genset` carries one current `siteId` and no history of it.
 * Until it does, this is the honest limit of a site-level log.
 */
export type SiteRunRow = {run: GensetRun; genset: Genset};

export const siteRuns = (members: Array<SiteGenset>): Array<SiteRunRow> =>
  members
    .flatMap(({genset}) => gensetRuns(genset.id).map((run) => ({run, genset})))
    .sort(
      (left, right) =>
        new Date(right.run.startedAt).getTime() - new Date(left.run.startedAt).getTime(),
    );
