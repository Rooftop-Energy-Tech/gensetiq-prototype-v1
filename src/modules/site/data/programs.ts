import {DATASET} from '@/brands';
import type {BrandProgram, ProgramId} from '@/brands';

/**
 * The rollout programmes sites can be filed under — the active dataset's own.
 *
 * A twin of `customers.ts` in shape and a different thing entirely in meaning, and
 * the difference is the whole reason both exist.
 *
 * ## Region and programme are not the same axis
 *
 * A **region** is where the site is. It is settled by geography and an operator
 * does not get a say: Kapit is in Sarawak, and it stays in Sarawak whatever anybody
 * decides about it. Everything derived from a region follows from that — the peak
 * sun hours every solar figure at the site is built from live on it, because the
 * sun is a fact about the place.
 *
 * A **programme** is a line the operator draws across the estate for their own
 * reasons: a funding round, a build wave, a conversion campaign. It is a grouping
 * and *only* a grouping — **nothing derives from it.** No figure, no diagram, no
 * default, no behaviour. It exists so somebody can say "show me the SWK build" and
 * get exactly the sites they filed under it.
 *
 * The two happen to line up on the carrier estate, where the programmes are
 * state-scoped, and that coincidence is exactly why the four peninsular sites are
 * in **no** programme: without them a reader would quite reasonably conclude that
 * programme is a second name for region, and start expecting one to imply the
 * other.
 *
 * ## Why unassigned is a first-class answer
 *
 * A site nobody has filed is unassigned, and that is a complete state rather than a
 * gap. The utility estate makes the point at scale — twenty of its twenty-five
 * substations are in no programme, because they are not *work*, they are the
 * network. Forcing every row into the nearest plausible bucket would make the
 * grouping useless the moment somebody filtered by it.
 */
export type Program = BrandProgram;

export type {ProgramId};

export const PROGRAMS: ReadonlyArray<Program> = DATASET.programs;

/** Does this estate have programmes at all — a dataset may declare none. */
export const HAS_PROGRAMS: boolean = PROGRAMS.length > 0;

const BY_ID: Record<ProgramId, Program> = Object.fromEntries(
  PROGRAMS.map((entry) => [entry.id, entry]),
);

/**
 * A programme by id, or `undefined` for a site in none.
 *
 * Unlike `customer()` this does **not** throw on an unknown id, and the asymmetry
 * is deliberate. A missing region takes `NaN` peak sun hours into every solar
 * figure on the page, which is worth stopping the app for. A missing programme
 * takes nothing anywhere — it is a label and no more — so the safe reading is the
 * one `programShortName` gives: unassigned.
 */
export const program = (id: ProgramId | null | undefined): Program | undefined =>
  id === null || id === undefined ? undefined : BY_ID[id];

/**
 * How a programme is written in a chip or a detail row, including the word for a
 * site in none.
 *
 * One function rather than `program(id)?.shortName ?? '…'` at each call site,
 * because every caller has the same absent case to answer and they should answer it
 * with the same word.
 */
export const programShortName = (id: ProgramId | null | undefined): string =>
  program(id)?.shortName ?? 'Unassigned';
