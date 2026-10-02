import {TriangleAlertIcon} from 'lucide-react';
import {useMemo, useRef, useState} from 'react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {FilterCard, SummaryCardRow} from '@/components/global/SummaryCards';
import {TablePager} from '@/components/global/TablePager';
import {stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {seededGenset} from '@/modules/genset/data/fleet';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {useTablePeriod} from './TablePeriod';
import type {PageWindow} from './TablePeriod';
import {ActiveFilters, EmptyTable, Gap, SearchBox, SortHeader, TD, matches, useSort} from './RegisterTable';
import type {Chip, Column, Direction} from './RegisterTable';
import {describeEvent} from './TruckPanel';
import {allTruckEvents, missingOf} from './data/truckRuns';
import type {TruckEvent, TruckEventKind} from './data/truckRuns';
import {truckById} from './data/trucks';
import {amount, figure} from './format';

/**
 * Every load and every stop in the period, newest first, with the same controls as
 * the Depots tab's deliveries (Jeff, 2026-09-29) — see `RegisterTable`.
 *
 * Each row puts the readings that are checked against each other side by side:
 * what was recorded (the nozzle meter at a stop, the depot pump at a load), the
 * truck's tank, and the genset's rise. Missing only fills in past the 10% line, so
 * the column is empty unless something went wrong. A loss with the meter idle has
 * nothing recorded at all, which is the whole point of it.
 *
 * A tab of its own since 2026-09-30 (Jeff), no longer under the truck register:
 * so it is every truck's log, and its own search and dropdowns narrow it.
 *
 * ## An overview card, as every Fuel tab now opens on
 *
 * One card over the log's period: the entries with fuel missing, which filters the
 * table and leaves a chip (Jeff, 2026-10-01). An `Entries` count was cut, since the
 * toolbar counts them, and the `Depot loads` and `Genset fills` cards, which did
 * the *Activity* dropdown's job from a second place.
 */

type Row = {
  event: TruckEvent;
  plate: string;
  genset: string | undefined;
  recorded: number | undefined;
  arrived: number | undefined;
  missing: number | undefined;
};

type Sort = 'at' | 'truck' | 'operator' | 'recorded' | 'tank' | 'arrived' | 'missing';

const NATURAL: Record<Sort, Direction> = {
  at: 'desc',
  truck: 'asc',
  operator: 'asc',
  recorded: 'desc',
  tank: 'desc',
  arrived: 'desc',
  missing: 'desc',
};

/** Blanks sort last whichever way the column runs, so a flip never opens on dashes. */
const byNumber = (a: number | undefined, b: number | undefined) =>
  a === undefined ? (b === undefined ? 0 : -1) : b === undefined ? 1 : a - b;

const COMPARE: Record<Sort, (a: Row, b: Row) => number> = {
  at: (a, b) => a.event.at - b.event.at,
  truck: (a, b) => a.plate.localeCompare(b.plate),
  operator: (a, b) => a.event.driver.localeCompare(b.event.driver),
  recorded: (a, b) => byNumber(a.recorded, b.recorded),
  tank: (a, b) => a.event.levelChange - b.event.levelChange,
  arrived: (a, b) => byNumber(a.arrived, b.arrived),
  missing: (a, b) => byNumber(a.missing, b.missing),
};

const COLUMNS: ReadonlyArray<Column<Sort>> = [
  {label: 'When', sort: 'at'},
  {label: 'Truck', sort: 'truck', hide: 'hidden sm:table-cell'},
  {label: 'Operator', sort: 'operator', hide: 'hidden sm:table-cell'},
  {label: 'Activity', sort: undefined},
  {label: 'Recorded', sort: 'recorded', hide: 'hidden md:table-cell', align: 'right'},
  {label: 'Truck tank', sort: 'tank', hide: 'hidden md:table-cell', align: 'right'},
  {label: 'Genset rose', sort: 'arrived', hide: 'hidden md:table-cell', align: 'right'},
  {label: 'Missing', sort: 'missing', align: 'right'},
];

/** The `Activity` dropdown, in the order a truck's day runs. */
const KIND_LABEL: Record<TruckEventKind, string> = {
  'depot-load': 'Loaded at depot',
  fill: 'Filled a genset',
  siphon: 'Level fell, meter idle',
};
const KINDS = Object.keys(KIND_LABEL) as Array<TruckEventKind>;

/** Rows per page — the Gensets and Deployments registers' twenty. */
const PAGE_SIZE = 20;

const litres = (value: number) => amount(Math.round(value), 'L');

export const TruckLog = ({
  page: pageWindow,
  initialQuery,
}: {
  page: PageWindow;
  /** A plate to open searched to — from a truck panel's `View in Truck log`. */
  initialQuery?: string;
}) => {
  const all = useMemo(
    () =>
      allTruckEvents().map((event): Row => {
        const genset = event.stop === undefined ? undefined : seededGenset(event.stop.gensetId);
        return {
          event,
          plate: truckById(event.truckId)?.plate ?? event.truckId,
          genset:
            event.stop === undefined ? undefined : genset === undefined ? event.stop.gensetId : gensetLabel(genset),
          recorded: event.stop?.meteredLitres ?? event.soldLitres,
          arrived: event.stop?.arrivedLitres,
          missing: missingOf(event)?.litres,
        };
      }),
    [],
  );
  const [query, setQuery] = useState(initialQuery ?? '');
  const [operator, setOperator] = useState<string | undefined>(undefined);
  const [kind, setKind] = useState<TruckEventKind | undefined>(undefined);
  const [missingOnly, setMissingOnly] = useState(false);
  const {sort, direction, change, order} = useSort<Sort>(NATURAL, 'at');
  // Local, as the filters are. Any filter or sort change goes back to page 1, as
  // `DeliveriesTable`'s does.
  const [page, setPage] = useState(1);
  const sectionRef = useRef<HTMLElement>(null);
  const refilter =
    <T,>(set: (next: T) => void) =>
    (next: T) => {
      set(next);
      setPage(1);
    };
  const period = useTablePeriod(pageWindow, 'Logged', () => setPage(1));
  const inScope = all.filter((row) => row.event.at >= period.range.from && row.event.at <= period.range.to);

  // Each dropdown counts the rows every *other* filter leaves, as the Gensets
  // toolbar's do, so an option's count is what picking it would show.
  const searched = inScope.filter((row) => matches(query, row.plate, row.genset ?? ''));
  const byOperator = (rows: Array<Row>) =>
    operator === undefined ? rows : rows.filter((row) => row.event.driver === operator);
  const byKind = (rows: Array<Row>) => (kind === undefined ? rows : rows.filter((row) => row.event.kind === kind));
  const byMissing = (rows: Array<Row>) => (missingOnly ? rows.filter((row) => row.missing !== undefined) : rows);
  const shown = order(byMissing(byKind(byOperator(searched))), COMPARE);

  // The overview counts the whole period, not what the filters leave, so a card's
  // figure does not fall to its own count the moment it is clicked.
  const losses = inScope.filter((row) => row.missing !== undefined);

  const operators = [...new Set(inScope.map((row) => row.event.driver))].sort();
  const lost = shown.reduce((sum, row) => sum + (row.missing ?? 0), 0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chips: Array<Chip> = [];
  if (period.chip !== undefined) chips.push(period.chip);
  if (query.trim() !== '') chips.push({key: 'q', label: `“${query.trim()}”`, clear: () => refilter(setQuery)('')});
  if (operator !== undefined)
    chips.push({key: 'operator', label: operator, clear: () => refilter(setOperator)(undefined)});
  if (kind !== undefined) chips.push({key: 'kind', label: KIND_LABEL[kind], clear: () => refilter(setKind)(undefined)});
  if (missingOnly)
    chips.push({key: 'missing', label: 'Missing from trucks', clear: () => refilter(setMissingOnly)(false)});

  const dash = <span className="text-tertiary">—</span>;

  return (
    <section ref={sectionRef} id="fuel-log" className="flex min-h-0 scroll-mt-3 flex-col gap-2">
      <SummaryCardRow cappedColumns={1}>
        <FilterCard
          label="Missing from trucks"
          count={losses.length}
          unit={losses.length === 1 ? 'entry' : 'entries'}
          detail={
            losses.length === 0
              ? 'none missing'
              : `${litres(losses.reduce((sum, row) => sum + (row.missing ?? 0), 0))} missing`
          }
          tone={losses.length > 0 ? 'critical' : 'neutral'}
          active={missingOnly}
          onToggle={refilter(setMissingOnly)}
        />
      </SummaryCardRow>

      <h2 className="mt-2 text-sm font-medium text-primary">Truck log</h2>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SearchBox
          value={query}
          onChange={refilter(setQuery)}
          placeholder="Number plate"
          label="Search the truck log"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Operator"
            allLabel="All operators"
            value={operator}
            onChange={refilter(setOperator)}
            options={operators.map((name) => ({
              key: name,
              label: name,
              count: byKind(searched).filter((row) => row.event.driver === name).length,
            }))}
          />
          <FilterSelect<TruckEventKind>
            label="Activity"
            allLabel="All activities"
            value={kind}
            onChange={refilter(setKind)}
            options={KINDS.map((key) => ({
              key,
              label: KIND_LABEL[key],
              count: byOperator(searched).filter((row) => row.event.kind === key).length,
              tone: key === 'siphon' ? 'critical' : undefined,
            }))}
          />
        </div>
        {period.control}
        <p className="ml-auto text-xs text-secondary">
          {`${figure(shown.length)} in ${period.phrase}`}
          {lost > 0 && <span className="text-severity-critical">{` · ${litres(lost)} missing`}</span>}
        </p>
      </div>

      <ActiveFilters chips={chips} />

      {shown.length === 0 ? (
        <EmptyTable>
          {inScope.length === 0 ? `Nothing logged in ${period.phrase}.` : 'Nothing matches these filters.'}
        </EmptyTable>
      ) : (
        // No overflow on the wrapper, for the reason `FuelPage` gives: the page
        // scrolls, not the table. Columns drop at narrow widths instead.
        <div className="rounded-md border border-subtle">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Truck loads and stops, with the truck, its operator, what was recorded, the truck tank's change, the
              genset's rise and any fuel missing
            </caption>
            <SortHeader columns={COLUMNS} sort={sort} direction={direction} onSort={refilter(change)} />
            <tbody>
              {pageRows.map(({event, plate, recorded, arrived, missing}) => (
                // No row tint: the red missing cell is enough to find the row, and a
                // tinted band on top of it read as the whole log shouting.
                <tr key={event.id} className="transition-colors hover:bg-hover">
                  <td className={cn(TD, 'text-primary')}>{stampAt(new Date(event.at).toISOString())}</td>
                  <Gap hide="hidden sm:table-cell" />
                  <td className={cn(TD, 'hidden text-secondary sm:table-cell')}>{plate}</td>
                  <Gap hide="hidden sm:table-cell" />
                  <td className={cn(TD, 'hidden text-secondary sm:table-cell')}>{event.driver}</td>
                  <Gap />
                  <td className={cn(TD, 'text-primary')}>{describeEvent(event)}</td>
                  <Gap hide="hidden md:table-cell" />
                  <td className={cn(TD, 'hidden text-right text-primary tabular-nums md:table-cell')}>
                    {recorded === undefined ? dash : litres(recorded)}
                  </td>
                  <Gap hide="hidden md:table-cell" />
                  <td
                    className={cn(
                      TD,
                      'hidden text-right tabular-nums md:table-cell',
                      event.levelChange > 0 ? 'text-primary' : 'text-secondary',
                    )}
                  >
                    {`${event.levelChange > 0 ? '+' : '−'}${litres(Math.abs(event.levelChange))}`}
                  </td>
                  <Gap hide="hidden md:table-cell" />
                  <td className={cn(TD, 'hidden text-right text-primary tabular-nums md:table-cell')}>
                    {arrived === undefined ? dash : litres(arrived)}
                  </td>
                  <Gap />
                  <td className={cn(TD, 'text-right tabular-nums')}>
                    {missing !== undefined && (
                      <span className="inline-flex items-center gap-1 font-semibold text-severity-critical">
                        <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                        {litres(missing)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TablePager
        label="Truck log pages"
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
