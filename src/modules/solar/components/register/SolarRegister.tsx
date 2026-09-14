import {Suspense, lazy, useMemo, useRef, useState} from 'react';
import {SearchXIcon} from 'lucide-react';

import {PlantToolbar} from '@/components/global/PlantToolbar';
import {useIsCompact} from '@/lib/useIsCompact';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {CUSTOMER_TERM} from '@/modules/site/data/customers';
import {
  filterSolarRows,
  searchSolarRows,
  solarRows,
  solarSummary,
  sortSolarRows,
} from '../../data/register';
import {useSolarSystems} from '../../data/systems';
import {SolarSummaryCards} from './SolarSummaryCards';
import {SolarTable} from './SolarTable';
import {SystemPreviewPanel} from './SystemPreviewPanel';
import type {SolarRegisterSearch} from '../../types/register.type';

/**
 * MapLibre is ~800 kB, so the map's chunk is fetched on its own — the split is the
 * default view here as it is on the fleet, which means the map is on this route's
 * first paint and there is no bytes-saved argument left.
 *
 * The split stays for a better reason than it was made for: the toolbar, the cards and
 * the table render while the map's chunk is still in flight, so the screen is
 * *readable* before it is complete. The `Suspense` fallback below is what the map's
 * half shows in the meantime.
 */
const SolarMap = lazy(() =>
  import('./SolarMap').then((module) => ({default: module.SolarMap})),
);

/** Design width of the preview panel, and its inset from the map's edge. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

/**
 * `/solar` — the array register, now built the way `/gensets` is.
 *
 * ## What this page used to be, and what it grew
 *
 * A table, a search box and a line counting the estate's plant. Its own note argued
 * against a view switch: *"The generation report has cards and a table because it
 * draws a chart per array. A register is a table of facts, and a second view of it
 * would be a control with no question behind it."*
 *
 * That reasoning was about a **card** view, and it still holds — there is no card list
 * here. What it did not consider is the map, and the map is not a second rendering of
 * the table: it is the one fact a table cannot state. `Kapit` in a Location cell does
 * not tell a reader that the site is four hours upriver, and *"which of the dark ones
 * are near each other"* is a question with no column. So the register keeps its table
 * and gains the fleet screen's other two views, its region filter, its card strip and
 * its preview panel — the same estate, the same controls, a different kind of plant.
 *
 * Everything structural is `GensetsPage`'s and deliberately so: same view union with
 * `split` as the default, same URL-carried state, same phone rules, same
 * scroll-syncs-the-map behaviour in the split. Two registers in one product that
 * filter differently or select differently read as two products.
 *
 * ## What is genuinely different
 *
 * **The cards are placeholders** — four readings rather than four filters. See
 * `SolarSummaryCards` for what that does and does not mean.
 *
 * **There is no card list at phone width.** The fleet has `GensetsCards` because a
 * genset row is six columns of short values; a system row carries two-line cells and
 * survives a horizontal scroll, which is what it did before this change. So the
 * compact width keeps the table and loses only the map and the panel, which have no
 * phone form.
 */
export const SolarRegister = ({
  search,
  onSearchChange,
}: {
  search: SolarRegisterSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<SolarRegisterSearch>) => void;
}) => {
  const {view, q = '', id, panel, customer} = search;

  /**
   * At phone width this screen is the toolbar, the cards and the table.
   *
   * Not a narrowed version of the desktop screen: the map's own controls and its
   * floating 393px panel have no phone form, and a map with a preview sheet over it is
   * a screen of its own rather than this one at a smaller size. `view` in the URL is
   * left exactly as it is — a phone reading a link to `?view=map` shows the table and,
   * followed on a desktop, that same link still opens the map. The reader's device
   * decides the presentation, not the URL.
   */
  const compact = useIsCompact();

  // One clock for the page. Every row's output, silence and step are then read at the
  // same instant — see `useSolarSystems` for why a defaulted `Date.now()` would let
  // one screen read two different moments.
  const [now] = useState(() => Date.now());
  const systems = useSolarSystems(now);

  /**
   * One subscription for the register, handed to every row.
   *
   * The `Alarm` column counts what each system's Alarms tab lists, so clearing a row
   * on a tab drops the count on the way back here — which needs this list reading the
   * handling store rather than a snapshot of it.
   */
  const handling = useAlarmHandling();
  const all = useMemo(() => solarRows(systems, now, handling), [systems, now, handling]);

  // Counted over the whole register, deliberately — see `solarSummary`. The strip and
  // the region dropdown are a picture of the estate that holds still while the table
  // below answers a narrower question.
  const summary = useMemo(() => solarSummary(all), [all]);

  const rows = useMemo(
    () => sortSolarRows(filterSolarRows(searchSolarRows(all, q), {customer})),
    [all, q, customer],
  );

  // Resolved against the *filtered* rows, not the whole estate: if a search hides the
  // selected system, the panel should say so rather than describing a row the reader
  // can no longer see.
  const selected = useMemo(() => rows.find((row) => row.system.id === id), [rows, id]);

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showList = view !== 'map' || compact;
  const split = showMap && showList;

  // No explicit toggle yet → the selection decides. An empty panel is 393px of
  // placeholder taken off the table, which is worth showing to somebody who asked for
  // a preview and not to somebody who has just arrived.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  // The panel floats over the map wherever there is a map under it, so the inset
  // applies to the split view as well as the full-width one.
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  /**
   * The rows on screen, and what the map frames in the split view — so scrolling the
   * list walks the map down the country.
   *
   * Only in `split`: the other two views have nothing to sync, and observing rows for
   * a map that is not there would fit the full-width map to whatever the list last
   * showed.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const rowIds = useMemo(() => rows.map((row) => row.system.id), [rows]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  /**
   * Selecting a system opens the panel, whether or not the toggle was on.
   *
   * `GensetsPage`'s rule, for its reason: selection has no other visible effect — a
   * tinted row, a recoloured pin — so with the panel closed, clicking is a dead end
   * that reads as a broken control. The toggle is best understood as "hide the preview
   * until I next ask for one".
   */
  const selectSystem = (next: string) => onSearchChange({id: next, panel: true});

  /**
   * Clicking the basemap — not a pin, not a cluster — puts the selection down.
   *
   * `panel` goes back to *unset* rather than to `false`, because unset is how "let the
   * selection decide" is spelled here. Guarded, so clicking around a map with nothing
   * selected is not a stream of navigations to the search params it already has.
   */
  const deselectSystem = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  const empty = rows.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-24 md:pb-4">
      <PlantToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
        placeholder="System name"
        searchLabel="Search solar systems"
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

      <SolarSummaryCards summary={summary} showing={rows.length} />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showList &&
          (empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
              <p className="text-sm text-secondary">
                {summary.total === 0
                  ? 'No site on this estate is configured as a solar hybrid.'
                  : 'No system matches the current filters.'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1">
              <SolarTable
                rows={rows}
                // Full width means every column; beside the map the nameplate one is
                // dropped rather than squeezed. See `SolarTable`'s `COLUMNS`.
                wide={!split}
                selectedId={id}
                onSelect={selectSystem}
                scrollRef={listRef}
                onBeforeAutoScroll={suppress}
              />
            </div>
          ))}

        {showMap && (
          <div
            className={
              // Full width on its own; beside the list it takes a shade over half.
              //
              // Sized for the panel whether or not the panel is showing, which is the
              // fleet screen's rule: a selection should change what the screen says,
              // not where it is.
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
              <SolarMap
                rows={rows}
                selectedId={id}
                onSelect={selectSystem}
                onDeselect={deselectSystem}
                panelInset={mapPanelInset}
                focusIds={split ? visibleIds : undefined}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <SystemPreviewPanel
            row={selected}
            className={
              // Over the map, the panel floats — the basemap should keep running
              // underneath it. In the list-only view it takes its own column instead,
              // so it cannot sit on top of the table's last two columns.
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
