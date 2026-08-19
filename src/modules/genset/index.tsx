import {Suspense, lazy, useMemo, useRef} from 'react';
import {SearchXIcon} from 'lucide-react';

import {useIsCompact} from '@/lib/useIsCompact';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {useFleet} from './data/deployment';
import {fleetSummary} from './data/fleetSummary';
import {GensetDetailPanel} from './components/GensetDetailPanel';
import {GensetsCards} from './components/GensetsCards';
import {GensetsSummaryCards} from './components/GensetsSummaryCards';
import {GensetsTable} from './components/GensetsTable';
import {GensetsToolbar} from './components/GensetsToolbar';
import {filterGensets, searchGensets, sortGensets} from './utils/searchGensets';
import type {GensetSearch} from './types/view.type';

/**
 * MapLibre is ~800 kB — three quarters of this route's bundle. It used to be
 * fetched only when somebody switched to the map, which was free while the list
 * was the default view; the split view is the default now, so the map is on the
 * first paint of this route and that saving is gone.
 *
 * The split stays anyway, and for a better reason than it was made for: the
 * toolbar, the cards and the table render while the map's chunk is still in
 * flight, so the screen is *readable* before it is complete. The `Suspense`
 * fallback below is what the map's half shows in the meantime.
 */
const GensetsMap = lazy(() =>
  import('./components/GensetsMap').then((module) => ({default: module.GensetsMap})),
);

/** Design width of the detail panel, and its inset from the map's edge. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

type GensetsPageProps = {
  search: GensetSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

export const GensetsPage = ({search, onSearchChange}: GensetsPageProps) => {
  const {view, q = '', id, panel, customer, role, status, service} = search;

  /**
   * At phone width this screen is the cards and the card list, and nothing else.
   *
   * Not a narrowed version of the desktop screen: the map's own controls and its
   * floating 393px panel have no phone form, and a map with a preview sheet over it
   * is a screen of its own rather than this one at a smaller size. So the view
   * switcher and the panel toggle are withheld here — the same rule the nav follows,
   * that the app offers no control it cannot honour.
   *
   * The summary cards *are* kept, because they have a phone form: they stack two-up
   * and their chips are the only filtering this width otherwise has.
   *
   * `view` in the URL is left exactly as it is. A phone reading a link to
   * `?view=split` shows the list and, followed on a desktop, that same link still
   * opens both halves — the reader's device decides the presentation, not the URL.
   */
  const compact = useIsCompact();

  // The deployed fleet, so a set that has been moved to another yard shows its new
  // placename in the Location column and its pin in the new spot on the map.
  const all = useFleet();

  // Duty is a property of the *site* a set stands at, and a reader can flip a site's
  // role at any moment — so the roles are read live here and passed down, which also
  // keeps the summary and the filter judging every set against one moment.
  const roles = useSitePowerRoles();

  // Counted over the whole fleet, deliberately — see `fleetSummary`. The cards are a
  // picture of the estate that holds still while the list below answers a narrower
  // question.
  const summary = useMemo(() => fleetSummary(all, roles), [all, roles]);

  const gensets = useMemo(
    () =>
      sortGensets(
        filterGensets(searchGensets(all, q), {customer, role, status, service}, roles),
      ),
    [all, q, customer, role, status, service, roles],
  );

  // Resolved against the *filtered* list, not the whole fleet: if a search hides
  // the selected unit, the panel should say so rather than describing a row the
  // user can no longer see.
  const selected = useMemo(
    () => gensets.find((genset) => genset.id === id),
    [gensets, id],
  );

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showList = view !== 'map' || compact;
  const split = showMap && showList;

  // No explicit toggle yet → the selection decides. An empty panel is 393px of
  // placeholder taken off the table, which is worth showing to somebody who asked
  // for a preview and not to somebody who has just arrived.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  // The panel floats over the map wherever there is a map under it, so the inset
  // applies to the split view as well as the full-width one.
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  /**
   * The rows on screen, and what the map frames in the split view.
   *
   * Scrolling the list therefore walks the map down the country. Only in `split`:
   * the other two views have nothing to sync, and observing rows for a map that
   * isn't there would fit the full-width map to whatever the list last showed.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const rowIds = useMemo(() => gensets.map((genset) => genset.id), [gensets]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  /**
   * Selecting a genset opens the panel, whether or not the toggle was on.
   *
   * Selection has no other visible effect: in the list it tints a row, and on the
   * map it recolours a pin — so with the panel closed, clicking is a dead end that
   * reads as a broken control rather than as a deliberate one. The toggle is best
   * understood as "hide the preview until I next ask for one", which is what this
   * makes it. Row-click previews, name-click navigates; the toggle no longer sits
   * between the two.
   */
  const selectGenset = (next: string) => onSearchChange({id: next, panel: true});

  /**
   * Clicking the basemap — not a pin, not a cluster — puts the selection down.
   *
   * The counterpart of the rule above: if selecting is what opens the panel, then
   * the panel is what a reader has to be able to close, and on a map the empty
   * space around the pins is the only surface there is to click. `panel` goes back
   * to *unset* rather than to `false`, because unset is what "let the selection
   * decide" is spelled as here — a screen with nothing selected and nobody having
   * touched the toggle is exactly the state a first arrival is in.
   *
   * Guarded, so clicking around a map that has nothing selected isn't a stream of
   * navigations to the search params it already has.
   */
  const deselectGenset = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  const empty = gensets.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <GensetsToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
        showViewControls={!compact}
      />

      <GensetsSummaryCards
        summary={summary}
        showing={gensets.length}
        search={search}
        onSearchChange={onSearchChange}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showList &&
          (empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
              <p className="text-sm text-secondary">No gensets match the current filters.</p>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1">
              {compact ? (
                <GensetsCards gensets={gensets} />
              ) : (
                <GensetsTable
                  gensets={gensets}
                  selectedId={id}
                  onSelect={selectGenset}
                  scrollRef={listRef}
                  onBeforeAutoScroll={suppress}
                />
              )}
            </div>
          ))}

        {showMap && (
          <div
            className={
              // Full width on its own; beside the list it takes a shade over half.
              //
              // Sized for the panel whether or not the panel is showing. The column
              // used to widen as the panel opened — 620px being the panel plus enough
              // basemap left of it to still read as a map — but the table and the map
              // then jumped sideways every time a row or a pin was picked, and a
              // selection should change what the screen says, not where it is. So the
              // space is set aside up front and the panel floats into ground the map
              // was already holding.
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
              <GensetsMap
                gensets={gensets}
                selectedId={id}
                onSelect={selectGenset}
                onDeselect={deselectGenset}
                panelInset={mapPanelInset}
                focusIds={split ? visibleIds : undefined}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <GensetDetailPanel
            genset={selected}
            className={
              // Over the map, the panel floats — the basemap should keep running
              // underneath it, the way the design shows. In the list-only view it
              // takes its own column instead, so it can't sit on top of the table's
              // last two columns.
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
