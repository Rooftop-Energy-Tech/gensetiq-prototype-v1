import type {SitePowerRole} from '@/modules/site/types/site.type';
import {gensetCustomer, gensetPowerRole} from '../data/fleetSummary';
import {gensetStatus} from '../data/fleetStatus';
import type {FleetStatus} from '../data/fleetStatus';
import {RUN_STATES} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

/** What the chips above the list narrow by. Every field is optional and ANDs. */
export type GensetFilters = {
  /** A `CustomerId`, or `DEPOT` for sets standing at no site. */
  customer?: string;
  role?: SitePowerRole | 'DEPOT';
  status?: FleetStatus;
};

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

/**
 * The card chips, applied. Absent fields don't narrow anything.
 *
 * Kept beside the free-text search rather than folded into it because the two are
 * different acts: the box is somebody typing a guess, the chips are somebody
 * choosing a known bucket. They compose — a query *and* a customer *and* a duty —
 * and each is independently clearable, which is what a single combined filter
 * string would take away.
 */
export const filterGensets = (
  gensets: Array<Genset>,
  filters: GensetFilters,
  roles: Record<string, SitePowerRole>,
): Array<Genset> =>
  gensets.filter((genset) => {
    if (filters.customer !== undefined) {
      if ((gensetCustomer(genset) ?? 'DEPOT') !== filters.customer) return false;
    }
    if (filters.role !== undefined) {
      if ((gensetPowerRole(genset, roles) ?? 'DEPOT') !== filters.role) return false;
    }
    if (filters.status !== undefined && gensetStatus(genset) !== filters.status) return false;
    return true;
  });
