import {RUN_STATES} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

/**
 * Free-text filter behind the toolbar's search box.
 *
 * The placeholder says "Genset name", but matching only the tag would make the
 * box feel broken the first time someone types "Ipoh" or "Cummins" — both are
 * on screen in the row they're looking at. So it matches tag, model and place,
 * which is what the visible columns actually contain.
 */
export const searchGensets = (gensets: Array<Genset>, query: string): Array<Genset> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return gensets;

  return gensets.filter((genset) =>
    [genset.tag, genset.model, genset.locationLabel].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
};

const stateRank = (genset: Genset) => RUN_STATES.indexOf(genset.runState);

/**
 * Fleet order: anything demanding attention first, then alphabetical by tag.
 *
 * `RUN_STATES` is declared worst-first for exactly this, so a faulted unit leads
 * the table instead of hiding on whatever row the seed data happened to put it.
 */
export const sortGensets = (gensets: Array<Genset>): Array<Genset> =>
  [...gensets].sort((a, b) => stateRank(a) - stateRank(b) || a.tag.localeCompare(b.tag));
