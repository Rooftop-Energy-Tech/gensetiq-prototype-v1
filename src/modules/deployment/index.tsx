import {Suspense, lazy, useMemo, useRef, useState} from 'react';
import {SearchXIcon} from 'lucide-react';

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
import {DeploymentsToolbar} from './components/DeploymentsToolbar';
import {DEPLOYMENT_SORT_DEFAULT_DIRECTION} from './types/view.type';
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
 * row here is a job at a site over a window, with one to three machines on it, and
 * the machine's own view of the same fact lives on its pages.
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
 *  - **list** — the table, six columns, its headers the ordering control.
 *  - **split** — table and map, the default, the map framing the rows on screen.
 *  - **map** — where the fleet has been sent, one pin per job, sized by how much
 *    plant is on it.
 *  - **gantt** — one lane per machine, one bar per job it is on, on a time axis that
 *    runs past today. The only view that can show a *gap*, which on a hire fleet is
 *    the fact worth money. See `DeploymentsGantt`.
 *
 * ## What the strip counts, and why it is not the registers' strip
 *
 * The registers count things; this counts jobs. So the headline is machines out over
 * yards occupied, with what is committed beside it, and the two figures nobody can
 * read off the list — the typical job length and the diesel the record burned — sit
 * beside the chips. See `DeploymentsSummaryCards`.
 */
export const DeploymentPage = ({search, onSearchChange}: DeploymentPageProps) => {
  const {view, q = '', id, panel, state, customer, sort, dir} = search;

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

  const rows = useMemo(
    () =>
      sortDeployments(
        filterDeployments(searchDeployments(all, q), {state, customer}),
        sort,
        direction,
      ),
    [all, q, state, customer, sort, direction],
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
  const rowIds = useMemo(() => rows.map((row) => row.deployment.id), [rows]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  // Selecting a posting opens the panel whether or not the toggle was on — the
  // registers' rule, for its reason: with the panel closed, clicking a pin tints it
  // and does nothing else, which reads as a broken control.
  const selectDeployment = (next: string) => onSearchChange({id: next, panel: true});

  /**
   * A column header was clicked — the registers' handler, and see `SitesPage` for
   * why a new key picks up its own natural direction and only the key already
   * showing flips.
   */
  const changeSort = (next: DeploymentSort) => {
    if (next === sort) {
      onSearchChange({dir: direction === 'asc' ? 'desc' : 'asc'});
      return;
    }
    onSearchChange({sort: next, dir: undefined});
  };

  const deselectDeployment = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  const empty = rows.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <DeploymentsToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
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
        search={search}
        onSearchChange={onSearchChange}
      />

      <DeploymentsSummaryCards
        summary={summary}
        showing={rows.length}
        search={search}
        onSearchChange={onSearchChange}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">
              No deployments match the current filters.
            </p>
          </div>
        ) : (
          <>
            {showList && (
              <div className="min-h-0 min-w-0 flex-1">
                {compact ? (
                  <DeploymentsCards rows={rows} now={now} />
                ) : (
                  <DeploymentsTable
                    rows={rows}
                    now={now}
                    selectedId={id}
                    onSelect={selectDeployment}
                    sort={sort}
                    direction={direction}
                    onSortChange={changeSort}
                    scrollRef={listRef}
                    onBeforeAutoScroll={suppress}
                  />
                )}
              </div>
            )}

            {showGantt && (
              <div className="min-h-0 min-w-0 flex-1">
                <DeploymentsGantt
                  rows={rows}
                  selectedId={id}
                  onSelect={selectDeployment}
                  now={now}
                />
              </div>
            )}

            {showMap && (
              <div
                className={
                  // The registers' proportions — see `SitesPage`, including why the
                  // column is sized for the panel whether or not it is showing.
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
                  <DeploymentsMap
                    rows={rows}
                    selectedId={id}
                    onSelect={selectDeployment}
                    onDeselect={deselectDeployment}
                    panelInset={mapPanelInset}
                    focusIds={split ? visibleIds : undefined}
                  />
                </Suspense>
              </div>
            )}
          </>
        )}

        {panelOpen && (
          <DeploymentDetailPanel
            row={selected}
            now={now}
            className={
              // Over the map the panel floats, so the basemap keeps running
              // underneath it. Everywhere else it takes its own column instead, so it
              // can't sit on top of the table's last two columns or the timeline's
              // most recent week.
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
