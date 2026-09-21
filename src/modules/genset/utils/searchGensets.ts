import type {SitePowerRole} from '@/modules/site/types/site.type';
import {gensetCustomer, gensetPowerRole} from '../data/fleetSummary';
import {gensetStatus} from '../data/fleetStatus';
import {isDueForService} from '../data/services';
import type {FleetStatus} from '../data/fleetStatus';
import {RUN_STATES} from '../types/genset.type';
import {GENSET_SORT_DEFAULT_DIRECTION} from '../types/view.type';
import type {GensetSort, GensetSortDirection} from '../types/view.type';
import type {Genset} from '../types/genset.type';

/** What the chips above the list narrow by. Every field is optional and ANDs. */
export type GensetFilters = {
  /** A `CustomerId`, or `WORKSHOP` for sets standing at no site. */
  customer?: string;
  role?: SitePowerRole | 'WORKSHOP';
  status?: FleetStatus;
  /**
   * Sets inside their service window.
   *
   * A cross-cut rather than a bucket — it says nothing about fuel or alarms, and a
   * set can be `OK` on the readiness tiles and still be due. Kept as `'due'` rather
   * than a boolean because it arrives from the URL, where `?service=false` and
   * `?service=0` are both things a hand-editing reader will write and neither means
   * what they'd expect.
   */
  service?: 'due';
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
 * `RUN_STATES` is declared attention-first for exactly this, so a turning unit leads
 * the table instead of hiding on whatever row the seed data happened to put it.
 */
/**
 * Order the register. Every key falls back to the serial, so ties resolve the same
 * way on every render — see `sortSites`, which takes the identical shape over yards.
 *
 * `fuel` is a **fraction**: a 200 L tank at a tenth and a 3,000 L tank at a tenth
 * are the same urgency, and ordering by litres would rank the fleet by tank size.
 */
export const sortGensets = (
  gensets: Array<Genset>,
  sort: GensetSort = 'state',
  direction: GensetSortDirection = GENSET_SORT_DEFAULT_DIRECTION[sort],
): Array<Genset> => {
  const flip = direction === 'desc' ? -1 : 1;
  const byName = (a: Genset, b: Genset) => a.tag.localeCompare(b.tag);

  // The tiebreak is **not** flipped. Reversing a sort should reverse the thing it
  // sorts by and leave the tiebreak alone: with `desc` on `state`, an operator still
  // reads the serials A to Z inside each run state, and flipping both would shuffle
  // rows that did not change rank. The sites register does the same.
  if (sort === 'name') return [...gensets].sort((a, b) => flip * byName(a, b));

  if (sort === 'fuel') {
    const level = (genset: Genset) =>
      genset.fuelCapacityLitres > 0
        ? genset.fuelLitres / genset.fuelCapacityLitres
        : Number.POSITIVE_INFINITY;

    return [...gensets].sort((a, b) => flip * (level(a) - level(b)) || byName(a, b));
  }

  return [...gensets].sort(
    (a, b) => flip * (stateRank(a) - stateRank(b)) || byName(a, b),
  );
};

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
      if ((gensetCustomer(genset) ?? 'WORKSHOP') !== filters.customer) return false;
    }
    if (filters.role !== undefined) {
      if ((gensetPowerRole(genset, roles) ?? 'WORKSHOP') !== filters.role) return false;
    }
    if (filters.status !== undefined && gensetStatus(genset) !== filters.status) return false;
    if (filters.service === 'due' && !isDueForService(genset.id)) return false;
    return true;
  });
