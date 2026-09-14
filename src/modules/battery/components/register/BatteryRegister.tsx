import {Suspense, lazy, useMemo, useRef, useState} from 'react';
import {SearchXIcon} from 'lucide-react';

import {PlantToolbar} from '@/components/global/PlantToolbar';
import {useIsCompact} from '@/lib/useIsCompact';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {CUSTOMER_TERM} from '@/modules/site/data/customers';
import {
  batterySummary,
  filterBanks,
  searchBanks,
  sortBanks,
  useBankAlarmCounts,
} from '../../data/register';
import {useBatteryBanks} from '../../data/banks';
import {BankPreviewPanel} from './BankPreviewPanel';
import {BatterySummaryCards} from './BatterySummaryCards';
import {BatteryTable} from './BatteryTable';
import type {BatteryRegisterSearch} from '../../types/register.type';

/**
 * MapLibre is ~800 kB, so the map's chunk is fetched on its own — the toolbar, the
 * cards and the table then render while it is still in flight, which is what makes
 * this screen readable before it is complete. The `Suspense` fallback below is what
 * the map's half shows in the meantime.
 */
const BatteryMap = lazy(() =>
  import('./BatteryMap').then((module) => ({default: module.BatteryMap})),
);

/** Design width of the preview panel, and its inset from the map's edge. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

/**
 * `/battery` — the bank register, now built the way `/gensets` is.
 *
 * ## What used to be here
 *
 * A `SectionTabs` scaffold, then a bare table. The scaffold's replacement note said
 * what the table would be — *"the bank register — a row per bank across both hybrid
 * configurations. Site, usable kWh, hours of autonomy, and the state of charge now"* —
 * and that is still `BatteryTable`, column for column.
 *
 * It had no toolbar, and its note argued it should not: *"a bank has a handful of
 * columns and the sort is already on the one that matters; a search field over nine
 * rows would be a control with no question behind it. If this estate grows past a
 * screenful the right move is the solar register's toolbar, lifted whole."*
 *
 * The toolbar is lifted whole, and the thing that moved it was the map rather than the
 * row count. A map makes a **selection** exist — a pin has nowhere to put a link — and
 * makes a **view** exist, and both belong in the URL so a bank on a map is a link
 * somebody can send. Once the register carries view state, the search box and the
 * region filter are two controls on a row that already exists, and they cost nothing
 * on nine rows and start earning at thirty. See `register.type.ts`.
 *
 * ## What the map is for
 *
 * Storage is the plant an operator drives to. A flat bank in Kapit and a flat bank in
 * Cheras are the same row in a table and two completely different mornings, and the
 * pins are coloured by hours left so the map answers that in one look — see
 * `runtimeMeta.ts`.
 *
 * ## What is genuinely different from the fleet screen
 *
 * **The cards are placeholders** — four readings rather than four filters. See
 * `BatterySummaryCards`.
 *
 * **There is no card list at phone width.** The fleet has `GensetsCards` because a
 * genset row is six columns of short values; a bank row carries two-line cells and
 * survives a horizontal scroll, which is what it did before this change. So the
 * compact width keeps the table and loses only the map and the panel, which have no
 * phone form.
 */
export const BatteryRegister = ({
  search,
  onSearchChange,
}: {
  search: BatteryRegisterSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<BatteryRegisterSearch>) => void;
}) => {
  const {view, q = '', id, panel, customer} = search;

  /**
   * At phone width this screen is the toolbar, the cards and the table. The map's own
   * controls and its floating 393px panel have no phone form, and `view` in the URL is
   * left exactly as it is — the reader's device decides the presentation, not the URL.
   */
  const compact = useIsCompact();

  // One clock for the page, so every row's charge is read at the same instant — the
  // rule `useSolarSystems` and the site page both follow.
  const [now] = useState(() => Date.now());
  const all = useBatteryBanks(now);

  // Counted over the whole register, deliberately — see `batterySummary`. The strip and
  // the region dropdown hold still while the table below answers a narrower question.
  const summary = useMemo(() => batterySummary(all), [all]);

  const banks = useMemo(
    () => sortBanks(filterBanks(searchBanks(all, q), {customer})),
    [all, q, customer],
  );

  // Resolved against the *filtered* list: if a search hides the selected bank, the
  // panel should say so rather than describing a row the reader can no longer see.
  const selected = useMemo(() => banks.find((bank) => bank.id === id), [banks, id]);

  /**
   * What is standing on every bank, over the **whole** register rather than the
   * filtered view — one pass, so the table's nineteen pills read one moment. Live: a
   * row cleared on a bank's own Alarms tab drops its count here on the way back. See
   * `useBankAlarmCounts`.
   */
  const alarmCounts = useBankAlarmCounts(now);

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showList = view !== 'map' || compact;
  const split = showMap && showList;

  // No explicit toggle yet → the selection decides. An empty panel is 393px of
  // placeholder taken off the table, which is worth showing to somebody who asked for
  // a preview and not to somebody who has just arrived.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  /**
   * The rows on screen, and what the map frames in the split view — so scrolling the
   * list walks the map down the country. Only in `split`: the other two views have
   * nothing to sync.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const rowIds = useMemo(() => banks.map((bank) => bank.id), [banks]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  /**
   * Selecting a bank opens the panel, whether or not the toggle was on — `GensetsPage`'s
   * rule, for its reason: selection has no other visible effect, so with the panel
   * closed a click is a dead end that reads as a broken control.
   */
  const selectBank = (next: string) => onSearchChange({id: next, panel: true});

  /**
   * Clicking the basemap puts the selection down. `panel` goes back to *unset* rather
   * than to `false`, because unset is how "let the selection decide" is spelled here.
   */
  const deselectBank = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  const empty = banks.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-24 md:pb-4">
      <PlantToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
        placeholder="Bank name"
        searchLabel="Search battery banks"
        regions={summary.byCustomer}
        regionLabel={CUSTOMER_TERM}
        region={customer}
        onRegionChange={(next) => onSearchChange({customer: next})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
        showViewControls={!compact}
      />

      <BatterySummaryCards summary={summary} showing={banks.length} />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showList &&
          (empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
              <p className="text-sm text-secondary">
                {summary.total === 0
                  ? 'No site on this estate is currently configured with storage.'
                  : 'No bank matches the current filters.'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1">
              <BatteryTable
                banks={banks}
                counts={alarmCounts}
                // Full width means every column; beside the map the two nameplate ones
                // are dropped rather than squeezed. See `BatteryTable`'s `COLUMNS`.
                wide={!split}
                selectedId={id}
                onSelect={selectBank}
                scrollRef={listRef}
                onBeforeAutoScroll={suppress}
              />
            </div>
          ))}

        {showMap && (
          <div
            className={
              // Full width on its own; beside the list it takes a shade over half, and
              // it is sized for the panel whether or not the panel is showing — a
              // selection should change what the screen says, not where it is.
              split
                ? 'min-h-0 min-w-[620px] flex-[1.2] overflow-hidden rounded-md border border-subtle bg-element'
                : 'min-h-0 flex-1 overflow-hidden rounded-md border border-subtle bg-element'
            }
          >
            <Suspense
              fallback={
                <div className="flex size-full items-center justify-center text-sm text-secondary">
                  Loading map…
                </div>
              }
            >
              <BatteryMap
                banks={banks}
                selectedId={id}
                onSelect={selectBank}
                onDeselect={deselectBank}
                panelInset={mapPanelInset}
                focusIds={split ? visibleIds : undefined}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <BankPreviewPanel
            bank={selected}
            className={
              // Over the map, the panel floats. In the list-only view it takes its own
              // column instead, so it cannot sit on top of the table's last columns.
              showMap
                ? 'absolute inset-y-2 right-2 z-10 w-[393px] shadow-lg'
                : 'w-[393px] shrink-0'
            }
          />
        )}
      </div>
    </div>
  );
};
