import {Suspense, lazy, useEffect, useMemo, useRef, useState} from 'react';
import {SearchXIcon} from 'lucide-react';

import {malaysiaStateName} from '@/lib/geo/malaysiaStates';
import {TablePager} from '@/components/global/TablePager';
import {useIsCompact} from '@/lib/useIsCompact';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {
  deploymentRows,
  deploymentSummary,
  filterDeployments,
  searchDeployments,
  sortDeployments,
} from './data/feed';
import {DeploymentDetailPanel} from './components/DeploymentDetailPanel';
import {DeploymentsCards} from './components/DeploymentsCards';
import {DeploymentsGantt} from './components/DeploymentsGantt';
import {DeploymentsSummaryCards} from './components/DeploymentsSummaryCards';
import {DeploymentsTable} from './components/DeploymentsTable';
import {DeploymentsActiveFilters, DeploymentsToolbar} from './components/DeploymentsToolbar';
import {WORK} from './components/detail/DeploymentWork';
import {NewDeploymentButton} from './components/NewDeploymentDialog';
import {stateSlug} from '@/modules/genset/data/gensetState';
import {DEPLOYMENT_PAGE_SIZE, DEPLOYMENT_SORT_DEFAULT_DIRECTION} from './types/view.type';
import type {DeploymentSearch, DeploymentSort} from './types/view.type';

/**
 * MapLibre is ~800 kB and it is on this route's first paint now that split is the
 * default — the registers' trade, for their return: the toolbar, the strip and the
 * table render while the map's chunk is still arriving. All three maps share the
 * library, so whichever screen loads it first pays for all of them.
 */
const DeploymentsMap = lazy(() =>
  import('./components/DeploymentsMap').then((module) => ({default: module.DeploymentsMap})),
);

/** Design width of the preview panel, and its inset from the map's edge. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

type DeploymentPageProps = {
  search: DeploymentSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<DeploymentSearch>) => void;
};

/**
 * `/deployments` — the deployments register.
 *
 * It answers an operations-room question: **what is out, where, since when, and what
 * is booked next?** The physical move is still a truck and a driver, and nothing here
 * commands one: a job opens when the machines are dropped at a yard and closes when
 * they are collected, and this screen is the paper trail those events leave.
 *
 * ## A row is a job, and a job has machines on it
 *
 * It was a flat feed of postings, one row per machine, which is the shape Helios
 * `DeploymentSession` has. A yard that needs three sets for five weeks is **one job**,
 * and three rows with identical dates is that job with its identity taken away. So a
 * row here is a job at a site over a window, with one machine on it (two about one
 * job in seven), and the machine's own view of the same fact lives on its pages.
 *
 * ## Three states, and the third one is new
 *
 * `planned`, `active`, `completed`, derived from the window against the clock. A
 * planned job is a commitment that has not started, which the earlier model could not
 * hold at all — and holding it is what lets this screen answer *what is booked*
 * rather than only *what happened*.
 *
 * Four views. The registers' list, map and split do here what they do there, and the
 * fourth is this screen's own:
 *
 *  - **list** — the table, seven columns, its headers the ordering control.
 *  - **split** — table and map, the default, the map framing the rows on screen.
 *  - **map** — where the fleet has been sent, one pin per job, sized by how much
 *    plant is on it.
 *  - **gantt** — one lane per machine, one bar per job it is on, on a time axis that
 *    runs past today. The only view that can show a *gap*, which on a hire fleet is
 *    the fact worth money. See `DeploymentsGantt`.
 *
 * ## Filters, cards and search follow the Gensets page
 *
 * The same controls in the same places: a plate search (plus the job reference),
 * State, Status and Job type dropdowns with faceted counts, a `Filtered by:` chip
 * row with `Clear all`, three summary cards, and a map whose state click filters the list.
 * The state is read off the yard's position (`stateNameAt`) and travels as
 * `?location=`, the Gensets page's param, so one state reads the same on both. See
 * `DeploymentsSummaryCards` for what the cards count.
 */
export const DeploymentPage = ({search, onSearchChange}: DeploymentPageProps) => {
  const {view, q = '', id, panel, state, location, job, sort, dir, page} = search;

  // Absent `dir` means the key's own grain — see `DEPLOYMENT_SORT_DEFAULT_DIRECTION`.
  const direction = dir ?? DEPLOYMENT_SORT_DEFAULT_DIRECTION[sort];

  /**
   * One clock reading for the whole screen.
   *
   * Every open posting's elapsed time, the Gantt's right-hand edge and the strip's
   * mean are all measured from it, so the bar, the row and the summary cannot
   * straddle a minute boundary and disagree about how long a machine has been out.
   */
  const [now] = useState(() => Date.now());

  const all = useMemo(() => deploymentRows(now), [now]);

  // Over the whole feed, not the filtered view — see `deploymentSummary`.
  const summary = useMemo(() => deploymentSummary(all), [all]);

  /**
   * Each dropdown's counts over what the *other* filters leave — the Gensets page's
   * faceting. With Johor picked, `Status` counts Johor's jobs; the State dropdown's
   * own counts ignore the state, or every other state would read zero.
   */
  const facets = useMemo(() => {
    const searched = searchDeployments(all, q);
    const jobRows = filterDeployments(searched, {state, location, job: undefined});
    return {
      byState: deploymentSummary(filterDeployments(searched, {state: undefined, location, job}))
        .byState,
      byLocation: deploymentSummary(
        filterDeployments(searched, {state, location: undefined, job}),
      ).byLocation,
      byJobType: (WORK?.jobTypes ?? []).map((type) => ({
        key: type.id,
        label: type.label,
        count: jobRows.filter((row) => row.deployment.jobType === type.id).length,
      })),
    };
  }, [all, q, state, location, job]);

  const rows = useMemo(
    () =>
      sortDeployments(
        filterDeployments(searchDeployments(all, q), {state, location, job}),
        sort,
        direction,
      ),
    [all, q, state, location, job, sort, direction],
  );

  // Resolved against the *filtered* feed, not the whole record: if a search hides the
  // selected posting, the panel should say so rather than describing a row the reader
  // can no longer see.
  const selected = useMemo(
    () => rows.find((row) => row.deployment.id === id),
    [rows, id],
  );

  /**
   * At phone width this screen is the strip and the card list — the registers' call,
   * for their reason: neither the map's controls, nor a 393px floating panel, nor a
   * time axis with a 168px label column has a phone form. `view` in the URL is left
   * untouched, so the same link opens the map on a desktop and the list on a phone.
   */
  const compact = useIsCompact();

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showGantt = view === 'gantt' && !compact;
  const showList = (view !== 'map' && view !== 'gantt') || compact;
  const split = showMap && showList;

  // Undefaulted `panel` → the selection decides, as on the registers: a first load
  // with nothing selected keeps the full width for the list.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  // The rows on screen, which the map frames while the two halves are side by side.
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * The table shows `DEPLOYMENT_PAGE_SIZE` rows at a time — `GensetsPage`'s paging.
   * The map, the timeline and the phone cards still read the whole filtered list.
   */
  const pageCount = Math.max(1, Math.ceil(rows.length / DEPLOYMENT_PAGE_SIZE));
  const currentPage = Math.min(page ?? 1, pageCount);
  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * DEPLOYMENT_PAGE_SIZE, currentPage * DEPLOYMENT_PAGE_SIZE),
    [rows, currentPage],
  );
  /** A filter or search changed: the old page number means nothing in the new list. */
  const refilter = (next: Partial<DeploymentSearch>) => onSearchChange({...next, page: undefined});

  const rowIds = useMemo(() => pageRows.map((row) => row.deployment.id), [pageRows]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  // Selecting a posting opens the panel whether or not the toggle was on — the
  // registers' rule, for its reason: with the panel closed, clicking a pin tints it
  // and does nothing else, which reads as a broken control.
  // A pin picked on the map turns the table to the page its row is on.
  const selectDeployment = (next: string) => {
    const index = rows.findIndex((row) => row.deployment.id === next);
    const onPage = index < 0 ? undefined : Math.floor(index / DEPLOYMENT_PAGE_SIZE) + 1;
    onSearchChange({id: next, panel: true, page: onPage === 1 ? undefined : onPage});
  };

  /**
   * A column header was clicked — the registers' handler, and see `SitesPage` for
   * why a new key picks up its own natural direction and only the key already
   * showing flips.
   */
  const changeSort = (next: DeploymentSort) => {
    if (next === sort) {
      onSearchChange({dir: direction === 'asc' ? 'desc' : 'asc', page: undefined});
      return;
    }
    onSearchChange({sort: next, dir: undefined, page: undefined});
  };

  const deselectDeployment = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  /**
   * A state clicked on the map filters the list to it, and the map keeps the state's
   * own frame — `GensetsPage`'s wiring, for its reason. The hold lasts while the
   * filters are the ones the click set, and ends the moment the reader scrolls the
   * list, so the map goes back to framing the rows on screen.
   */
  const filterKey = JSON.stringify([q, location, state, job]);
  // Held on an unfiltered arrival too, so the map opens on the whole peninsula
  // (`PENINSULA`) rather than the first screenful of rows — `GensetsPage`'s rule.
  const [framedBy, setFramedBy] = useState<string | undefined>(() =>
    q === '' && location === undefined && state === undefined && job === undefined
      ? filterKey
      : undefined,
  );
  const selectState = (stateId: string) => {
    const name = malaysiaStateName(stateId);
    if (name === undefined) return;
    const slug = stateSlug(name);
    setFramedBy(JSON.stringify([q, slug, state, job]));
    refilter({location: slug});
  };
  const holdFrame = framedBy !== undefined && framedBy === filterKey;

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

  const empty = rows.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      {/* The page's one creating action, on its own row above the search (2026-09-30). */}
      <div className="flex">
        <NewDeploymentButton />
      </div>
      <DeploymentsToolbar
        query={q}
        onQueryChange={(next) => refilter({q: next || undefined})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
        showViewControls={!compact}
        // The table's headers are the sort control wherever the table is drawn, so
        // the dropdown only appears where it is not — the phone's card list and the
        // map-only view.
        //
        // **Not on the timeline**, which is the one view that ignores the ordering
        // entirely: its lanes are machines and its axis is time, so a key like "fuel
        // burned" has nowhere to apply. A dropdown there would be a control that
        // changes nothing. See `DeploymentsGantt`.
        showSort={compact || view === 'map'}
        summary={summary}
        facets={facets}
        search={search}
        onSearchChange={refilter}
      />

      <DeploymentsActiveFilters search={search} onSearchChange={refilter} />

      <DeploymentsSummaryCards
        summary={summary}
        showing={rows.length}
        search={search}
        onSearchChange={refilter}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {(showList || showGantt) && empty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">No deployments match the current filters.</p>
          </div>
        )}

        {showList && !empty && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {compact ? (
              <DeploymentsCards rows={rows} now={now} />
            ) : (
              <>
                <div className="min-h-0 flex-1">
                  <DeploymentsTable
                    rows={pageRows}
                    wide={!split}
                    now={now}
                    selectedId={id}
                    onSelect={selectDeployment}
                    sort={sort}
                    direction={direction}
                    onSortChange={changeSort}
                    scrollRef={listRef}
                    onBeforeAutoScroll={suppress}
                  />
                </div>
                <TablePager
                  label="Deployments table pages"
                  page={currentPage}
                  pageCount={pageCount}
                  pageSize={DEPLOYMENT_PAGE_SIZE}
                  total={rows.length}
                  onPageChange={(next) => {
                    listRef.current?.scrollTo({top: 0});
                    onSearchChange({page: next === 1 ? undefined : next});
                  }}
                />
              </>
            )}
          </div>
        )}

        {showGantt && !empty && (
          <div className="min-h-0 min-w-0 flex-1">
            <DeploymentsGantt rows={rows} selectedId={id} onSelect={selectDeployment} now={now} />
          </div>
        )}

        {/* Drawn with an empty list too, as on Gensets: a click on a state with no
            jobs filters to nothing, and the map has to stay to click back out. */}
        {showMap && (
          <div
            className={
              // Half and half with the list, as on Gensets (2026-09-30; 60/40 before).
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
              <DeploymentsMap
                rows={rows}
                selectedId={id}
                onSelect={selectDeployment}
                onDeselect={deselectDeployment}
                panelInset={mapPanelInset}
                focusIds={split ? visibleIds : undefined}
                onStateSelect={selectState}
                holdFrame={holdFrame}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <DeploymentDetailPanel
            row={selected}
            now={now}
            onClose={deselectDeployment}
            className={
              // Over the map the panel floats, so the basemap keeps running
              // underneath it. Over the timeline too (2026-09-30): the track scrolls
              // sideways, so nothing under the panel is out of reach, and the chart
              // keeps its full width. Only the list-only table takes it as a column,
              // so it can't sit on its last two columns.
              showMap || showGantt
                ? 'absolute inset-y-2 right-2 z-40 w-[393px] shadow-lg'
                : 'w-[393px] shrink-0'
            }
          />
        )}
      </div>
    </div>
  );
};
