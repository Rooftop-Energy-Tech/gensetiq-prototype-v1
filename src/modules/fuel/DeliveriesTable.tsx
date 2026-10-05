import {Link} from '@tanstack/react-router';
import {ArrowUpRightIcon, DropletIcon} from 'lucide-react';
import {useRef, useState} from 'react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {
  Headline,
  SUMMARY_CARD_BOX,
  SUMMARY_CARD_LINK,
  SummaryCard,
  SummaryCardLabel,
  SummaryCardRow,
} from '@/components/global/SummaryCards';
import {TablePager} from '@/components/global/TablePager';
import {stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {fleet} from '@/modules/genset/data/deployment';
import {fuelLevelKind} from '@/modules/genset/types/fuelLevel.type';
import {gensetSearch} from '@/modules/genset/types/view.type';
import {ActiveFilters, EmptyTable, Gap, SearchBox, SortHeader, TD, matches, useSort} from './RegisterTable';
import type {Chip, Column, Direction} from './RegisterTable';
import {useTablePeriod} from './TablePeriod';
import type {PageWindow} from './TablePeriod';
import {DEPOTS} from './data/depotTank';
import {allFills} from './data/fills';
import {amount, figure} from './format';

/**
 * The Genset fills tab (`Deliveries` until 2026-10-05; the URL keeps
 * `?view=deliveries`), with the controls the Gensets and Deployments registers have
 * (Jeff, 2026-09-29), built from the same pieces as the truck log — see
 * `RegisterTable` — so the two tables behave alike.
 *
 * ## An overview row, as every Fuel tab now opens on
 *
 * Two cards (Jeff, 2026-10-01): the litres filled in the table's period, and
 * the gensets waiting for fuel now — see the comment over the row.
 */

export type DeliveryRow = {
  id: string;
  gensetId: string;
  name: string;
  at: number;
  litres: number;
  /**
   * The yard this machine drew from, by id, and its name for the row. Carried on
   * the row because it is what the list is filtered and sorted by.
   */
  depotId: string;
  depotName: string;
  /** `Klang depot, Selangor` — where the fill happened, since a yard fill is at the depot. */
  depotLocation: string;
};

type Sort = 'name' | 'depot' | 'at' | 'litres';

/** Names A to Z, the newest delivery and the biggest fill first. */
const NATURAL: Record<Sort, Direction> = {name: 'asc', depot: 'asc', at: 'desc', litres: 'desc'};

const COMPARE: Record<Sort, (a: DeliveryRow, b: DeliveryRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  depot: (a, b) => a.depotName.localeCompare(b.depotName),
  at: (a, b) => a.at - b.at,
  litres: (a, b) => a.litres - b.litres,
};

/** Rows per page — the Gensets and Deployments registers' twenty. */
const PAGE_SIZE = 20;

const COLUMNS: ReadonlyArray<Column<Sort>> = [
  {label: 'Number plate', sort: 'name'},
  {label: 'Depot', sort: 'depot', hide: 'hidden sm:table-cell'},
  {label: 'When', sort: 'at'},
  {label: 'Litres', sort: 'litres'},
];

/**
 * `rows` is every delivery the record holds; the table cuts it to the page's period,
 * or its own — see `useTablePeriod`.
 */
export const DeliveriesTable = ({rows, page: pageWindow}: {rows: ReadonlyArray<DeliveryRow>; page: PageWindow}) => {
  const [query, setQuery] = useState('');
  // `undefined` is every yard. A filter that defaults to one depot would hide most
  // of the estate behind a control a reader has not touched yet.
  const [depotId, setDepotId] = useState<string | undefined>(undefined);
  const {sort, direction, change, order} = useSort<Sort>(NATURAL, 'at');
  // Local, as the filters are, not in the URL. Any filter or sort change goes back to page 1, since the old page number means
  // nothing in the new list.
  const [page, setPage] = useState(1);
  const sectionRef = useRef<HTMLElement>(null);
  const refilter =
    <T,>(set: (next: T) => void) =>
    (next: T) => {
      set(next);
      setPage(1);
    };
  const period = useTablePeriod(pageWindow, 'When', () => setPage(1));

  const inRange = rows.filter((row) => row.at >= period.range.from && row.at <= period.range.to);
  const searched = inRange.filter((row) => matches(query, row.name));
  const byDepot = (list: Array<DeliveryRow>) =>
    depotId === undefined ? list : list.filter((row) => row.depotId === depotId);
  const shown = order(byDepot(searched), COMPARE);
  const litres = shown.reduce((sum, row) => sum + row.litres, 0);

  // The overview counts the whole period, not what the filters leave.
  const periodLitres = inRange.reduce((sum, row) => sum + row.litres, 0);
  const gensets = new Set(inRange.map((row) => row.gensetId)).size;
  // ## The machines waiting for fuel (Jeff, 2026-10-01)
  //
  // Below their reserve line now — the deliveries that have not happened yet, and
  // the one figure on this tab someone acts on. It was "low and not filled this
  // period" first, which over a month never fired: every low machine had had some
  // fill in it, just not enough. So the count is every low tank, as the Gensets
  // page's `Low fuel` filter counts, and the detail is how long the longest of
  // them has gone since any fill, by yard or by truck.
  const waiting = fleet().filter((genset) => fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres) !== undefined);
  const lastFill = new Map<string, number>();
  for (const fill of allFills()) lastFill.set(fill.gensetId, Math.max(lastFill.get(fill.gensetId) ?? 0, fill.at));
  const longestWait = waiting.reduce((most, genset) => {
    const at = lastFill.get(genset.id);
    return at === undefined ? most : Math.max(most, (pageWindow.now - at) / 86_400_000);
  }, 0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chips: Array<Chip> = [];
  if (query.trim() !== '') chips.push({key: 'q', label: `“${query.trim()}”`, clear: () => refilter(setQuery)('')});
  if (period.chip !== undefined) chips.push(period.chip);
  if (depotId !== undefined) {
    const depot = DEPOTS.find((d) => d.id === depotId);
    chips.push({key: 'depot', label: `${depot?.name ?? depotId} depot`, clear: () => refilter(setDepotId)(undefined)});
  }

  return (
    <section ref={sectionRef} id="fuel-deliveries" className="flex min-h-0 scroll-mt-3 flex-col gap-2">
      {/* ## Two cards, of what someone acts on (Jeff, 2026-10-01)
          What was filled, with how many fills and machines under it, and the
          machines below reserve now, which leads to the Gensets page filtered to
          low fuel. `Busiest depot` and `Latest delivery` were cut: one was
          interesting and acted on by nobody, the other nearly always said `just
          now`. */}
      <SummaryCardRow cappedColumns={2}>
        <SummaryCard label="Litres filled" pill={period.label}>
          <Headline
            value={amount(periodLitres, 'L')}
            detail={`${figure(inRange.length)} ${inRange.length === 1 ? 'fill' : 'fills'} · ${figure(gensets)} ${
              gensets === 1 ? 'genset' : 'gensets'
            }`}
          />
        </SummaryCard>
        <Link
          to="/gensets"
          search={gensetSearch({fuel: 'low'})}
          aria-label={`Waiting for fuel: ${waiting.length}`}
          className={cn(SUMMARY_CARD_BOX, SUMMARY_CARD_LINK)}
        >
          <SummaryCardLabel>
            Waiting for fuel
            {/* The arrow every other way out of this app carries — see
                `DeploymentsSummaryCards`. */}
            <ArrowUpRightIcon className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
          </SummaryCardLabel>
          <Headline
            value={waiting.length}
            unit={waiting.length === 1 ? 'genset' : 'gensets'}
            detail={
              waiting.length === 0
                ? 'no tank below reserve'
                : `below reserve · longest ${Math.floor(longestWait)} ${Math.floor(longestWait) === 1 ? 'day' : 'days'} since a fill`
            }
          />
        </Link>
      </SummaryCardRow>

      <h2 className="mt-2 text-base font-medium text-primary">Genset fills</h2>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SearchBox value={query} onChange={refilter(setQuery)} placeholder="Number plate" label="Search genset fills" />
        {/* Each option counts the deliveries the search leaves, so with a plate
            typed the dropdown says which depot filled it. */}
        <FilterSelect
          label="Depot"
          allLabel="All depots"
          value={depotId}
          onChange={refilter(setDepotId)}
          options={DEPOTS.map((depot) => ({
            key: depot.id,
            label: depot.name,
            count: searched.filter((row) => row.depotId === depot.id).length,
          }))}
        />
        {period.control}
        <p className="ml-auto text-xs text-secondary">
          {`${figure(shown.length)} in ${period.phrase} · ${figure(litres)} L`}
        </p>
      </div>

      <ActiveFilters chips={chips} />

      {shown.length === 0 ? (
        <EmptyTable>
          {inRange.length === 0 ? `No genset fill in ${period.phrase}.` : 'No genset fill matches these filters.'}
        </EmptyTable>
      ) : (
        // No overflow on this wrapper: the page scrolls, not the table — the
        // reason is in `FuelPage`. `Depot` drops below `sm` instead.
        <div className="rounded-md border border-subtle">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Gensets filled at a depot, by number plate, with the depot, when and litres
            </caption>
            <SortHeader columns={COLUMNS} sort={sort} direction={direction} onSort={refilter(change)} />
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-hover">
                  <td className={cn(TD, 'font-medium')}>
                    <Link
                      to="/gensets/$gensetId"
                      params={{gensetId: row.gensetId}}
                      className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <Gap hide="hidden sm:table-cell" />
                  <td className={cn(TD, 'hidden text-secondary sm:table-cell')}>{row.depotLocation}</td>
                  <Gap />
                  <td className={cn(TD, 'text-primary')}>{stampAt(new Date(row.at).toISOString())}</td>
                  <Gap />
                  <td className={cn(TD, 'text-primary tabular-nums')}>
                    <span className="inline-flex items-center gap-1.5">
                      <DropletIcon className="size-3.5 text-fuel" aria-hidden="true" />
                      {`${figure(row.litres)} L`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* The page scrolls, not the table, so turning a page brings the table's head
          back into view rather than leaving the reader at the foot of the new page. */}
      <TablePager
        label="Genset fills table pages"
        page={currentPage}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        total={shown.length}
        onPageChange={(next) => {
          setPage(next);
          sectionRef.current?.scrollIntoView({block: 'start'});
        }}
      />
    </section>
  );
};
