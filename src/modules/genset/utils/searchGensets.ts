import type {SitePowerRole} from '@/modules/site/types/site.type';
import {gensetCustomer, gensetPowerRole} from '../data/fleetSummary';
import {gensetStatus} from '../data/fleetStatus';
import {isDueForService} from '../data/services';
import type {FleetStatus} from '../data/fleetStatus';
import {gensetLabel, RUN_STATES} from '../types/genset.type';
import type {AlertSeverity} from '../types/alert.type';
import {alarmRank, alarmRankCount} from '@/modules/site/data/siteAlarmQueue';
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
 * The placeholder says "Number plate", but matching only the plate would make the
 * box feel broken the first time someone types "Ipoh" or "Cummins" — both are
 * on screen in the row they're looking at. So it matches plate, serial, model and
 * place, which is what the visible columns actually contain.
 */
export const searchGensets = (gensets: Array<Genset>, query: string): Array<Genset> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return gensets;

  return gensets.filter((genset) =>
    [gensetLabel(genset), genset.tag, genset.model, genset.locationLabel].some((field) =>
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
  /**
   * Every set's standing counts, for the `alarms` key.
   *
   * Passed in rather than read here, for the reason `sortSites` takes the same
   * argument: the counts are a hook's answer and this is a pure function, and the
   * register, the map and this ordering must all rank off one reading. A set the
   * pass has not reached sorts as quiet, which is what `alarmRank` already says
   * about `undefined`.
   */
  counts: Record<string, Record<AlertSeverity, number>> = {},
): Array<Genset> => {
  const byName = (a: Genset, b: Genset) => gensetLabel(a).localeCompare(gensetLabel(b));

  /**
   * Each key's comparator, written **the way that key naturally runs**, and turned
   * round once below if the reader flipped the header. `sortSites` is this function
   * over yards and the two are kept identical on purpose.
   */
  const primary = (a: Genset, b: Genset): number => {
    if (sort === 'name') return byName(a, b);

    if (sort === 'fuel') {
      const level = (genset: Genset) =>
        genset.fuelCapacityLitres > 0
          ? genset.fuelLitres / genset.fuelCapacityLitres
          : Number.POSITIVE_INFINITY;

      return level(a) - level(b);
    }

    if (sort === 'alarms') {
      // Severity before volume — see `alarmRank`. The rank counts *down* from the
      // worst, so ascending rank is the worst first; the default direction calls
      // that end `desc` because that is the reader's word for it, not the integer's.
      return (
        alarmRank(counts[a.id]) - alarmRank(counts[b.id]) ||
        alarmRankCount(counts[b.id]) - alarmRankCount(counts[a.id])
      );
    }

    // `stateRank` is written so rank 0 is the machine to look at first.
    return stateRank(a) - stateRank(b);
  };

  /**
   * **Relative to the key's own default, not to `asc`.**
   *
   * This is the line that matters, and getting it wrong is silent: write it as
   * `direction === 'asc' ? 1 : -1` and every key whose natural grain is `desc` comes
   * out backwards — `alarms` put the quietest machines at the top of a list whose
   * whole job is to surface the loud ones, with no error anywhere to say so.
   */
  const sign = direction === GENSET_SORT_DEFAULT_DIRECTION[sort] ? 1 : -1;

  // The name tie-break stays A to Z whichever way the column runs: it is not part of
  // the ordering the reader chose, it is what stops the quiet foot of the list
  // reshuffling between renders.
  return [...gensets].sort((a, b) => sign * primary(a, b) || byName(a, b));
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
