import {useNavigate} from '@tanstack/react-router';
import {
  ColumnsIcon,
  GlobeIcon,
  MenuIcon,
  SearchXIcon,
  TriangleAlertIcon,
  WarehouseIcon,
} from 'lucide-react';
import {useState} from 'react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {PlantMap} from '@/components/global/PlantMap';
import type {PlantPoint, PlantTone} from '@/components/global/PlantMap';
import {FilterCard, Headline, SummaryCard, SummaryCardRow} from '@/components/global/SummaryCards';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useIsCompact} from '@/lib/useIsCompact';
import {cn} from '@/lib/utils';
import {lightToken} from '@/styles/colors';
import {ActiveFilters, Gap, SearchBox, SortHeader, TD, matches, useSort} from './RegisterTable';
import type {Chip, Column, Direction} from './RegisterTable';
import {TankBar, TruckList, whereNow} from './TruckList';
import {TruckDetailPanel, TruckPanel} from './TruckPanel';
import {DEPOTS} from './data/depots';
import {currentDriver, missingIn, reconcileTruck, truckLevel, truckPosition} from './data/truckRuns';
import {TRUCKS, truckById} from './data/trucks';
import type {RefuelTruck} from './data/trucks';
import {amount} from './format';

/**
 * The Trucks tab — the fuel that reaches a machine by road rather than by the
 * machine driving in.
 *
 * ## Laid out as the Gensets page is (Jeff, 2026-09-30)
 *
 * A toolbar (search, a depot filter, list / split / map), the
 * summary cards, then the register and the map side by side with the selected
 * truck's panel floating over the map's right edge. A reader who knows the fleet
 * page knows this one. The truck log sat below it until it became a tab of its
 * own, *Truck log* (Jeff, 2026-09-30).
 *
 * It replaced a stack of sections: a *Fuel missing* verdict with one row per loss,
 * a compact list, a map, then the log. The verdict is now the `Missing from trucks` card,
 * which filters the register to the trucks that lost fuel; each loss is in that
 * truck's panel and in the log's `Missing` column.
 *
 * Selecting a truck — its row or its pin — puts it in the URL as `?truck=` and
 * shows it in the panel. Below `md` there is no map: the trucks are cards and the
 * panel is a drawer, as on the fleet page.
 */

type View = 'list' | 'split' | 'map';

/** The Gensets page's panel, so the map sets aside the same ground for it. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

/**
 * Pin colours. Literal values off the light theme because MapLibre paints in a
 * shader — see `PlantTone`.
 *
 * One tone for every truck, fuel missing or not (Jeff, 2026-09-30): the map says
 * where the trucks are, and the register and the summary card say which lost fuel.
 * A missing-fuel truck was red until then.
 */
const TONES: ReadonlyArray<PlantTone> = [
  {key: 'truck', color: lightToken.fuel},
  {key: 'depot', color: lightToken.primary},
];

/**
 * What the map's marks mean, in its top-left corner: the truck dot and the depot
 * pin. Drawn from the same tokens the map's palette is read off, about an eighth
 * over the size it first had (Jeff, 2026-10-01: doubled, then cut back twice).
 */
const MapKey = () => (
  <ul
    aria-label="Map key"
    className="absolute top-2 left-2 z-[5] flex flex-col gap-1 rounded-lg border border-subtle bg-canvas/90 px-3 py-2.5 text-[13.5px] text-secondary"
  >
    <li className="flex items-center gap-2.5">
      {/* The truck dot and the depot badge one width, as on the map. */}
      <span className="size-[15px] rounded-full border-2 border-primary bg-fuel" aria-hidden="true" />
      Truck
    </li>
    <li className="flex items-center gap-2.5">
      <span className="flex size-[15px] items-center justify-center rounded-full bg-primary" aria-hidden="true">
        <WarehouseIcon className="size-[9px] text-canvas" />
      </span>
      Depot
    </li>
  </ul>
);

type Row = {
  truck: RefuelTruck;
  operator: string;
  depot: string;
  fraction: number;
  where: string;
  delivered: number;
  missing: number;
};

type Sort = 'plate' | 'operator' | 'depot' | 'tank' | 'delivered' | 'missing';

const NATURAL: Record<Sort, Direction> = {
  plate: 'asc',
  operator: 'asc',
  depot: 'asc',
  tank: 'asc',
  delivered: 'desc',
  missing: 'desc',
};

const COMPARE: Record<Sort, (a: Row, b: Row) => number> = {
  plate: (a, b) => a.truck.plate.localeCompare(b.truck.plate),
  operator: (a, b) => a.operator.localeCompare(b.operator),
  depot: (a, b) => a.depot.localeCompare(b.depot),
  tank: (a, b) => a.fraction - b.fraction,
  delivered: (a, b) => a.delivered - b.delivered,
  missing: (a, b) => a.missing - b.missing,
};

/**
 * Beside the map the register is narrow, so `Depot` and `Location` come out, as
 * `Location` and `Last updated` do on the fleet table. The panel says both.
 */
const columns = (wide: boolean): ReadonlyArray<Column<Sort>> => [
  {label: 'Number plate', sort: 'plate'},
  {label: 'Operator', sort: 'operator'},
  ...(wide ? [{label: 'Depot', sort: 'depot' as const}] : []),
  {label: 'Tank', sort: 'tank'},
  ...(wide ? [{label: 'Location', sort: undefined}] : []),
  {label: 'Delivered', sort: 'delivered', align: 'right'},
  {label: 'Missing', sort: 'missing', align: 'right'},
];

export const TrucksView = ({
  from,
  to,
  periodLabel,
  truckId,
  onTruckChange,
}: {
  from: number;
  to: number;
  /** `last 30 days` — the pill on the period's card. */
  periodLabel: string;
  truckId: string | undefined;
  onTruckChange: (next: string | undefined) => void;
}) => {
  const compact = useIsCompact();
  const navigate = useNavigate();
  const selected = truckId === undefined ? undefined : truckById(truckId);

  // Local rather than in the URL: `?truck=` is already the selection, and these are
  // the register's own controls.
  const [view, setView] = useState<View>('split');
  const [query, setQuery] = useState('');
  const [depotId, setDepotId] = useState<string | undefined>(undefined);
  const [missingOnly, setMissingOnly] = useState(false);
  const {sort, direction, change, order} = useSort<Sort>(NATURAL, 'missing');

  const all: Array<Row> = TRUCKS.map((truck) => {
    const depot = DEPOTS.find((d) => d.id === truck.homeDepotId);
    return {
      truck,
      operator: currentDriver(truck) ?? truck.drivers[0] ?? '',
      depot: depot?.name ?? truck.homeDepotId,
      fraction: truck.capacityLitres > 0 ? truckLevel(truck) / truck.capacityLitres : 0,
      where: whereNow(truck),
      delivered: reconcileTruck(truck.id, from, to).arrivedLitres,
      missing: missingIn(from, to, truck.id).reduce((sum, m) => sum + m.litres, 0),
    };
  });

  // Each filter counts what the others leave, as the fleet toolbar's do.
  const searched = all.filter((row) => matches(query, row.truck.plate, ...row.truck.drivers));
  const byDepot = (rows: Array<Row>) =>
    depotId === undefined ? rows : rows.filter((row) => row.truck.homeDepotId === depotId);
  const byMissing = (rows: Array<Row>) => (missingOnly ? rows.filter((row) => row.missing > 0) : rows);
  const rows = order(byMissing(byDepot(searched)), COMPARE);
  const filtered = rows.length !== all.length;

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showList = view !== 'map' || compact;
  const split = showMap && showList;

  const chips: Array<Chip> = [];
  if (query.trim() !== '') chips.push({key: 'q', label: `“${query.trim()}”`, clear: () => setQuery('')});
  if (depotId !== undefined) {
    const depot = DEPOTS.find((d) => d.id === depotId);
    chips.push({key: 'depot', label: `${depot?.name ?? depotId} depot`, clear: () => setDepotId(undefined)});
  }
  if (missingOnly) chips.push({key: 'missing', label: 'Missing from trucks', clear: () => setMissingOnly(false)});

  // Narrowed, the map keeps only the yards the trucks shown load from.
  const depots = filtered ? DEPOTS.filter((depot) => rows.some((row) => row.truck.homeDepotId === depot.id)) : DEPOTS;
  const points: Array<PlantPoint> = [
    ...depots.map((depot) => ({
      id: `depot:${depot.id}`,
      latitude: depot.latitude,
      longitude: depot.longitude,
      tone: 'depot',
      // A labelled warehouse pin, not another dot: a depot among trucks read as a
      // thirty-ninth truck in black (Jeff, 2026-09-30).
      landmark: {label: `${depot.name} depot`},
    })),
    ...rows.map((row) => {
      const position = truckPosition(row.truck);
      return {
        id: row.truck.id,
        latitude: position.latitude,
        longitude: position.longitude,
        tone: 'truck',
      };
    }),
  ];

  return (
    <>
      {/* ## Sized as the Gensets page is (Jeff, 2026-09-30)
          Toolbar, chips, summary cards, then the register and the map taking the
          rest of the screen, so the page does not scroll and the table scrolls
          inside its own box. It was a fixed 520px while the truck log sat below. */}
      <section id="fuel-trucks" className={cn('flex scroll-mt-3 flex-col gap-3', !compact && 'min-h-0 flex-1')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Number plate" label="Search trucks" />
          <FilterSelect
            label="Depot"
            allLabel="All depots"
            value={depotId}
            onChange={setDepotId}
            options={DEPOTS.filter((depot) => all.some((row) => row.truck.homeDepotId === depot.id)).map((depot) => ({
              key: depot.id,
              label: depot.name,
              count: byMissing(searched).filter((row) => row.truck.homeDepotId === depot.id).length,
            }))}
          />
          {!compact && (
            <div className="ml-auto flex items-center gap-5">
              <Tabs value={view} onValueChange={(next) => setView(next as View)}>
                {/* `tabIndex` by hand, for the reason `GensetsToolbar` gives. */}
                <TabsList className="w-[105px]">
                  <TabsTrigger
                    value="list"
                    className="flex-1"
                    aria-label="List"
                    tabIndex={view === 'list' ? 0 : -1}
                  >
                    <MenuIcon aria-hidden="true" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="split"
                    className="flex-1"
                    aria-label="List + map"
                    tabIndex={view === 'split' ? 0 : -1}
                  >
                    <ColumnsIcon aria-hidden="true" />
                  </TabsTrigger>
                  <TabsTrigger value="map" className="flex-1" aria-label="Map" tabIndex={view === 'map' ? 0 : -1}>
                    <GlobeIcon aria-hidden="true" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        <ActiveFilters chips={chips} />

        <TruckCards
          all={all}
          periodLabel={periodLabel}
          missingOnly={missingOnly}
          onMissingOnlyChange={setMissingOnly}
        />

        <div className={cn('relative flex gap-3', !compact && 'min-h-0 flex-1')}>
          {showList &&
            (rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
                <p className="text-sm text-secondary">No trucks match the current filters.</p>
              </div>
            ) : compact ? (
              <div className="min-w-0 flex-1">
                <TruckList trucks={rows.map((row) => row.truck)} from={from} to={to} onOpen={onTruckChange} />
              </div>
            ) : (
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border border-subtle">
                <TruckTable
                  rows={rows}
                  wide={!split}
                  sort={sort}
                  direction={direction}
                  onSort={change}
                  selectedId={selected?.id}
                  onSelect={onTruckChange}
                />
              </div>
            ))}

          {showMap && (
            <div
              className={
                split
                  ? 'relative min-h-0 min-w-[620px] flex-[1.2] overflow-hidden rounded-md border border-subtle bg-element'
                  : 'relative min-h-0 flex-1 overflow-hidden rounded-md border border-subtle bg-element'
              }
            >
              <PlantMap
                points={points}
                tones={TONES}
                selectedId={selected?.id}
                onSelect={(id) => {
                  if (!id.startsWith('depot:')) onTruckChange(id);
                }}
                onDeselect={() => onTruckChange(undefined)}
                panelInset={selected === undefined ? 0 : PANEL_WIDTH + PANEL_INSET}
                label="Fuel truck locations map"
                countNoun={{one: 'truck', many: 'trucks'}}
                // Every truck mark in fuel violet, clusters too (Jeff, 2026-09-30).
                clusterFill={{color: lightToken.fuel, text: lightToken.canvas}}
                // A depot's name opens its page; its pin only zooms.
                onLandmarkOpen={(id) =>
                  void navigate({to: '/fuel/depots/$depotId', params: {depotId: id.replace(/^depot:/, '')}})
                }
              />
              <MapKey />
            </div>
          )}

          {/* Only while a truck is selected (Jeff, 2026-09-30): it opens on a row or
              a pin and closes with its × or a basemap click. The
              toolbar's show / hide toggle and the empty `Select a truck` panel went
              with it. */}
          {!compact && selected !== undefined && (
            <TruckDetailPanel
              truck={selected}
              from={from}
              to={to}
              onClose={() => onTruckChange(undefined)}
              // Over the map it floats; with the list alone it takes its own column.
              className={showMap ? 'absolute inset-y-2 right-2 z-10 w-[393px] shadow-lg' : 'w-[393px] shrink-0'}
            />
          )}
        </div>
      </section>

      {compact && <TruckPanel truck={selected} from={from} to={to} onClose={() => onTruckChange(undefined)} />}
    </>
  );
};

/**
 * The fleet strip's cards, for trucks: two of them. They count every truck, as
 * the fleet's count every genset. `Missing from trucks` is a toggle, as the
 * fleet's `Due for service` is.
 */
const TruckCards = ({
  all,
  periodLabel,
  missingOnly,
  onMissingOnlyChange,
}: {
  all: ReadonlyArray<Row>;
  periodLabel: string;
  missingOnly: boolean;
  onMissingOnlyChange: (next: boolean) => void;
}) => {
  const losing = all.filter((row) => row.missing > 0);
  const lost = losing.reduce((sum, row) => sum + row.missing, 0);

  const onBoard = all.reduce((sum, row) => sum + truckLevel(row.truck), 0);
  const capacity = all.reduce((sum, row) => sum + row.truck.capacityLitres, 0);

  // Fuel missing first, then whether the trucks can cover the next round (Jeff,
  // 2026-10-01). A `Trucks` count was cut, since the register beside it counts
  // them, and `Delivered by truck`, a share nobody acted on.
  return (
    <SummaryCardRow cappedColumns={2}>
      <FilterCard
        label="Missing from trucks"
        count={losing.length}
        unit={losing.length === 1 ? 'truck' : 'trucks'}
        detail={lost > 0 ? `${amount(Math.round(lost), 'L')} missing` : 'none missing'}
        tone={losing.length > 0 ? 'critical' : 'neutral'}
        pill={periodLabel}
        active={missingOnly}
        onToggle={onMissingOnlyChange}
      />

      <SummaryCard label="Fuel on board">
        <Headline
          value={`${capacity === 0 ? 0 : Math.round((onBoard / capacity) * 100)}%`}
          detail={`${amount(Math.round(onBoard), '')} L of ${amount(capacity, 'L')}`}
        />
      </SummaryCard>
    </SummaryCardRow>
  );
};

/** The register, in `GensetsTable`'s shape: the equal-gap layout, a sortable head, a row that selects. */
const TruckTable = ({
  rows,
  wide,
  sort,
  direction,
  onSort,
  selectedId,
  onSelect,
}: {
  rows: ReadonlyArray<Row>;
  wide: boolean;
  sort: Sort;
  direction: Direction;
  onSort: (next: Sort) => void;
  selectedId: string | undefined;
  onSelect: (truckId: string) => void;
}) => (
  <table className="w-full border-separate border-spacing-0 text-sm">
    <caption className="sr-only">Fuel trucks, with operator, tank, deliveries and fuel missing this period</caption>
    <SortHeader columns={columns(wide)} sort={sort} direction={direction} onSort={onSort} />
    <tbody>
      {rows.map((row) => {
        const selected = row.truck.id === selectedId;
        return (
          <tr
            key={row.truck.id}
            tabIndex={0}
            aria-selected={selected}
            onClick={() => onSelect(row.truck.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(row.truck.id);
              }
            }}
            className={cn(
              'cursor-pointer transition-colors outline-none',
              'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-outline focus-visible:ring-inset',
              selected && 'bg-highlight hover:bg-highlight',
            )}
          >
            <td className={cn(TD, 'h-13 font-medium text-primary')}>{row.truck.plate}</td>
            <Gap />
            <td className={cn(TD, 'h-13 text-secondary')}>{row.operator}</td>
            {wide && (
              <>
                <Gap />
                <td className={cn(TD, 'h-13 text-secondary')}>{row.depot}</td>
              </>
            )}
            <Gap />
            <td className={cn(TD, 'h-13')}>
              <span className="flex items-center gap-2">
                <TankBar fraction={row.fraction} className="w-12" />
                <span className="text-secondary tabular-nums">{`${Math.round(row.fraction * 100)}%`}</span>
              </span>
            </td>
            {wide && (
              <>
                <Gap />
                <td className={cn(TD, 'h-13 text-secondary')}>{row.where}</td>
              </>
            )}
            <Gap />
            <td className={cn(TD, 'h-13 text-right text-primary tabular-nums')}>{amount(row.delivered, 'L')}</td>
            <Gap />
            <td className={cn(TD, 'h-13 text-right tabular-nums')}>
              {row.missing > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-severity-critical">
                  <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                  {amount(Math.round(row.missing), 'L')}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
