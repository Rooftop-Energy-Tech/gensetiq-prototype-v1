import {Suspense, lazy, useEffect, useMemo, useRef, useState} from 'react';
import {SearchXIcon} from 'lucide-react';

import {useIsCompact} from '@/lib/useIsCompact';
import {TablePager} from '@/components/global/TablePager';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {malaysiaStateName} from '@/lib/geo/malaysiaStates';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {useFleet} from './data/deployment';
import {fleetSummary} from './data/fleetSummary';
import {stateSlug} from './data/gensetState';
import {GensetDetailPanel} from './components/GensetDetailPanel';
import {GensetsCards} from './components/GensetsCards';
import {GensetsSummaryCards} from './components/GensetsSummaryCards';
import {GensetsTable} from './components/GensetsTable';
import {GensetsActiveFilters, GensetsToolbar} from './components/GensetsToolbar';
import {useFleetAlarmCounts} from './data/alarmViews';
import {filterGensets, searchGensets, sortGensets} from './utils/searchGensets';
import {GENSET_PAGE_SIZE, GENSET_SORT_DEFAULT_DIRECTION} from './types/view.type';
import type {GensetSearch, GensetSort} from './types/view.type';

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
  const {view, q = '', id, panel, location, status, service, run, alarm, fuel, capacity, sort, dir, page} = search;

  // The key's own natural direction until a reader flips it — see
  // `GENSET_SORT_DEFAULT_DIRECTION`, and `changeSort` below for what a click means.
  const direction = dir ?? GENSET_SORT_DEFAULT_DIRECTION[sort];

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
   * and each status and alarm chip is still a filter at this width. The other
   * filters are in the toolbar, which every width gets.
   *
   * `view` in the URL is left exactly as it is. A phone reading a link to
   * `?view=split` shows the list and, followed on a desktop, that same link still
   * opens both halves — the reader's device decides the presentation, not the URL.
   */
  const compact = useIsCompact();

  // The deployed fleet, so a set that has been moved to another yard shows its new
  // placename in the Location column and its pin in the new spot on the map.
  const all = useFleet();

  // A site's power role, read live because a reader can flip one at any moment. The
  // summary still needs it to count the sets standing at no site — the workshop.
  const roles = useSitePowerRoles();

  // Over the **whole** fleet rather than the filtered list, so a set's rank is a
  // fact about the set and not about what else is on screen — and so the table
  // below, the map's pins, this ordering and the alarm filter all read one pass. See
  // `useFleetAlarmCounts`.
  const alarmCounts = useFleetAlarmCounts(all);

  // Counted over the whole fleet, deliberately — see `fleetSummary`. The cards and
  // the toolbar's option counts are a picture of the estate that holds still while
  // the list below answers a narrower question.
  const summary = useMemo(() => fleetSummary(all, roles, alarmCounts), [all, roles, alarmCounts]);

  /**
   * A column header was clicked.
   *
   * A new column picks up its own natural direction, because that is the answer
   * somebody clicking `Fuel level` came for and making them click twice to get it
   * would be the control asking a question it already knows the answer to. The
   * column that is already the order flips instead, which is the only way to reach
   * the other end of it — and a header that did nothing on a second click reads as
   * dead.
   *
   * `dir: undefined` rather than the key's default written out: the default belongs
   * to the key, so storing it would put a redundant `dir` in every shared URL.
   *
   * The Deployments register's own sort handler follows the same rule, deliberately:
   * a reader who learns the headers on one list has learnt them on the other.
   */
  const changeSort = (next: GensetSort) => {
    if (next === sort) {
      onSearchChange({dir: direction === 'asc' ? 'desc' : 'asc', page: undefined});
      return;
    }
    onSearchChange({sort: next, dir: undefined, page: undefined});
  };

  /**
   * The dropdowns' counts, each over the gensets every *other* filter leaves.
   *
   * Pick Johor and `Status`, `Alarm` and `Fuel level` count Johor's sets; pick
   * `Running` and `State` counts the running ones in each state. A dropdown leaves
   * itself out, or picking one option would zero every other option in the same
   * menu and the reader could not see what switching to it would give.
   */
  const facets = useMemo(() => {
    const searched = searchGensets(all, q);
    const filters = {location, status, service, run, alarm, fuel, capacity};
    const without = (dimension: keyof typeof filters) =>
      fleetSummary(filterGensets(searched, {...filters, [dimension]: undefined}, alarmCounts), roles, alarmCounts);
    return {
      byState: without('location').byState,
      byRunState: without('run').byRunState,
      byAlarm: without('alarm').byAlarm,
      byFuel: without('fuel').byFuel,
      byCapacity: without('capacity').byCapacity,
    };
  }, [all, q, location, status, service, run, alarm, fuel, capacity, alarmCounts, roles]);

  const gensets = useMemo(
    () =>
      sortGensets(
        filterGensets(searchGensets(all, q), {location, status, service, run, alarm, fuel, capacity}, alarmCounts),
        sort,
        direction,
        alarmCounts,
      ),
    [all, q, location, status, service, run, alarm, fuel, capacity, sort, direction, alarmCounts],
  );

  /**
   * The table shows `GENSET_PAGE_SIZE` rows at a time. The map, the cards at phone
   * width and the selection still read the whole filtered list, so a pin is never
   * missing because its row is on another page.
   */
  const pageCount = Math.max(1, Math.ceil(gensets.length / GENSET_PAGE_SIZE));
  const currentPage = Math.min(page ?? 1, pageCount);
  const pageRows = useMemo(
    () => gensets.slice((currentPage - 1) * GENSET_PAGE_SIZE, currentPage * GENSET_PAGE_SIZE),
    [gensets, currentPage],
  );
  const pageOf = (gensetId: string) => {
    const index = gensets.findIndex((genset) => genset.id === gensetId);
    return index < 0 ? undefined : Math.floor(index / GENSET_PAGE_SIZE) + 1;
  };

  /** A filter or search changed: the old page number means nothing in the new list. */
  const refilter = (next: Partial<GensetSearch>) => onSearchChange({...next, page: undefined});

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
  const rowIds = useMemo(() => pageRows.map((genset) => genset.id), [pageRows]);
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
  // A pin picked on the map turns the table to the page its row is on.
  const selectGenset = (next: string) => {
    const onPage = pageOf(next);
    onSearchChange({id: next, panel: true, page: onPage === 1 ? undefined : onPage});
  };

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

  /**
   * Clicking a state on the map filters the list to it — the toolbar's `State`
   * dropdown, set from the map. The map frames the state as well; `All states` in
   * the dropdown is the way back out.
   *
   * A state with no set in it filters too, to an empty list: the click asked what is
   * there, and "nothing" is an answer. The dropdown names it for as long as it is
   * picked — see `GensetsToolbar`.
   *
   * The map's frame is then held. The filter changes the list, and the list would
   * otherwise re-fit the map to the state's pins — zoomed past the state onto a
   * corner of it. `framedBy` is the filters the click left behind, and the hold lasts
   * while they are what the screen shows and nobody has scrolled the list: change
   * any filter, or scroll, and the map follows the list again.
   */
  const filterKey = JSON.stringify([q, location, status, service, run, alarm, fuel, capacity]);
  // Held on arrival too, when nothing narrows the fleet: the map opens on the
  // whole peninsula (`PENINSULA`) rather than on the first screenful
  // of rows, and the same release — a filter or a scroll — hands it to the list.
  const [framedBy, setFramedBy] = useState<string | undefined>(() =>
    [location, status, service, run, alarm, fuel, capacity].every((value) => value === undefined) &&
    q === ''
      ? filterKey
      : undefined,
  );
  const selectState = (stateId: string) => {
    const name = malaysiaStateName(stateId);
    if (name === undefined) return;
    const slug = stateSlug(name);
    setFramedBy(JSON.stringify([q, slug, status, service, run, alarm, fuel, capacity]));
    refilter({location: slug});
  };
  const holdFrame = framedBy !== undefined && framedBy === filterKey;

  // A scroll somebody performed hands the map back to the list. Wheel, touch and
  // keys rather than `scroll`, which the list's own scroll-to-selection fires too.
  useEffect(() => {
    const list = listRef.current;
    if (list === null || !holdFrame) return;
    const release = () => setFramedBy(undefined);
    list.addEventListener('wheel', release, {passive: true});
    list.addEventListener('touchmove', release, {passive: true});
    list.addEventListener('keydown', release);
    return () => {
      list.removeEventListener('wheel', release);
      list.removeEventListener('touchmove', release);
      list.removeEventListener('keydown', release);
    };
  }, [holdFrame]);

  const empty = gensets.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <GensetsToolbar
        query={q}
        onQueryChange={(next) => refilter({q: next || undefined})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
        showViewControls={!compact}
        summary={summary}
        facets={facets}
        search={search}
        onSearchChange={refilter}
      />

      <GensetsActiveFilters summary={summary} search={search} onSearchChange={refilter} />

      <GensetsSummaryCards
        summary={summary}
        showing={gensets.length}
        search={search}
        onSearchChange={refilter}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showList &&
          (empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
              <p className="text-sm text-secondary">No gensets match the current filters.</p>
            </div>
          ) : (
            // Half and half with the map beside it (2026-09-30, on request). It was
            // 60/40 from 2026-09-29, when the table still had a Capacity column.
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {compact ? (
                <GensetsCards gensets={gensets} />
              ) : (
                <>
                  <div className="min-h-0 flex-1">
                    <GensetsTable
                      gensets={pageRows}
                      // Full width means every column; beside the map `Location` and
                      // `Last updated` come out. See `GensetsTable`'s `COLUMNS`.
                      wide={!split}
                      sort={sort}
                      direction={direction}
                      onSortChange={changeSort}
                      selectedId={id}
                      onSelect={selectGenset}
                      scrollRef={listRef}
                      onBeforeAutoScroll={suppress}
                    />
                  </div>
                  <TablePager
                    label="Gensets table pages"
                    page={currentPage}
                    pageCount={pageCount}
                    pageSize={GENSET_PAGE_SIZE}
                    total={gensets.length}
                    onPageChange={(next) => {
                      listRef.current?.scrollTo({top: 0});
                      onSearchChange({page: next === 1 ? undefined : next});
                    }}
                  />
                </>
              )}
            </div>
          ))}

        {showMap && (
          <div
            className={
              // Full width on its own; beside the list it takes half, floored at 440px
              // so the 393px preview panel still floats over a strip of basemap.
              //
              // Sized for the panel whether or not the panel is showing. The column
              // used to widen as the panel opened — 620px being the panel plus enough
              // basemap left of it to still read as a map — but the table and the map
              // then jumped sideways every time a row or a pin was picked, and a
              // selection should change what the screen says, not where it is. So the
              // space is set aside up front and the panel floats into ground the map
              // was already holding.
              split
                ? 'min-h-0 min-w-[440px] flex-1 overflow-hidden rounded-md border border-subtle bg-element'
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
                onStateSelect={selectState}
                holdFrame={holdFrame}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <GensetDetailPanel
            genset={selected}
            onClose={deselectGenset}
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
