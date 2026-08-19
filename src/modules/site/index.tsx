import {Suspense, lazy, useMemo, useRef} from 'react';
import {SearchXIcon} from 'lucide-react';

import {useIsCompact} from '@/lib/useIsCompact';
import {useVisibleRowIds} from '@/lib/useVisibleRows';
import {estateSummary, filterSites} from './data/estateSummary';
import {searchSites, sortSites, useSiteSummaries} from './data/sites';
import {useSitePowerRoles} from './data/siteConfig';
import {SiteDetailPanel} from './components/SiteDetailPanel';
import {SitesCards} from './components/SitesCards';
import {SitesSummaryCards} from './components/SitesSummaryCards';
import {SitesTable} from './components/SitesTable';
import {SitesToolbar} from './components/SitesToolbar';
import type {SiteSearch} from './types/view.type';

/**
 * MapLibre is ~800 kB, and it is on this route's first paint now that the split
 * view is the default — the same trade the fleet screen makes, and for the same
 * return: the toolbar, the cards and the table render while the map's chunk is
 * still arriving. The two maps share the library, so whichever screen loads it
 * first pays for both.
 */
const SitesMap = lazy(() =>
  import('./components/SitesMap').then((module) => ({default: module.SitesMap})),
);

/** Design width of the preview panel, and its inset from the map's edge. */
const PANEL_WIDTH = 393;
const PANEL_INSET = 8;

type SitesPageProps = {
  search: SiteSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

/**
 * `/sites` — seventeen sites, worst condition first, as a list beside a map.
 *
 * The map used to be argued against on the grounds that a site's position is its
 * gensets' position, which `/gensets?view=map` already draws. That is true of the
 * *coordinates* and wrong about the question. The fleet map answers "where are my
 * machines", so a yard with three sets is three pins and a customer site reads as
 * a cluster of hardware. This one answers "where are my customers, and which of
 * them is in trouble" — one pin per site, coloured by the site's own condition and
 * sized by how much plant is standing there. Those are different screens, and
 * neither is derivable by eye from the other.
 *
 * It carries the fleet screen's preview panel for the reason the fleet screen
 * needs one: a pin has nowhere to put a link, so a clicked site has to open
 * *something* that carries the way in. That panel is a preview of the site rather
 * than a copy of its page — the facts a pin cannot state, and an arrow out.
 */
export const SitesPage = ({search, onSearchChange}: SitesPageProps) => {
  const {view, q = '', id, panel, customer, role, status} = search;

  // Keyed on the summaries as well as the query: attaching or detaching a genset
  // changes a site's genset count, its fuel and its condition, and condition is what
  // this list is *ordered* by. Memoising on `q` alone would leave the list ranked by
  // a fleet that has since moved.
  const all = useSiteSummaries();
  const roles = useSitePowerRoles();

  // Over the whole estate, not the filtered view — see `estateSummary`.
  const summary = useMemo(() => estateSummary(all, roles), [all, roles]);

  const summaries = useMemo(
    () => sortSites(filterSites(searchSites(all, q), {customer, role, status}, roles)),
    [all, q, customer, role, status, roles],
  );

  // Resolved against the *filtered* list, not the whole estate: if a search hides
  // the selected site, the panel should say so rather than describing a row the
  // user can no longer see.
  const selected = useMemo(
    () => summaries.find((summary) => summary.site.id === id),
    [summaries, id],
  );

  /**
   * At phone width this screen is the cards and the card list — the same call the
   * fleet screen makes, for the same reason: neither the map's controls nor a
   * floating 393px panel has a phone form, and the app offers no control it cannot
   * honour. `view` in the URL is left untouched, so the same link opens both halves
   * on a desktop and the list on a phone.
   */
  const compact = useIsCompact();

  const showMap = (view === 'map' || view === 'split') && !compact;
  const showList = view !== 'map' || compact;
  const split = showMap && showList;

  // Undefaulted `panel` → the selection decides, as on the fleet screen: a first
  // load with nothing selected keeps the full width for the list.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  // The rows on screen, which the map frames while the two halves are side by side.
  const listRef = useRef<HTMLDivElement>(null);
  const rowIds = useMemo(() => summaries.map((summary) => summary.site.id), [summaries]);
  const {ids: visibleIds, suppress} = useVisibleRowIds(listRef, rowIds, split);

  // Selecting a site opens the panel whether or not the toggle was on — the fleet
  // screen's rule, for its reason: with the panel closed, clicking a pin tints it
  // and does nothing else, which reads as a broken control rather than a
  // deliberate one.
  const selectSite = (next: string) => onSearchChange({id: next, panel: true});

  // Clicking the basemap puts the selection down and the preview away — the fleet
  // screen's rule and its reasoning, including why `panel` returns to unset rather
  // than to `false`.
  const deselectSite = () => {
    if (id === undefined && panel === undefined) return;
    onSearchChange({id: undefined, panel: undefined});
  };

  const empty = summaries.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <SitesToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
        showViewControls={!compact}
      />

      <SitesSummaryCards
        summary={summary}
        showing={summaries.length}
        search={search}
        onSearchChange={onSearchChange}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showList &&
          (empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
              <p className="text-sm text-secondary">No sites match the current filters.</p>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1">
              {compact ? (
                <SitesCards summaries={summaries} />
              ) : (
                <SitesTable
                  summaries={summaries}
                  selectedId={id}
                  onSelect={selectSite}
                  scrollRef={listRef}
                  onBeforeAutoScroll={suppress}
                />
              )}
            </div>
          ))}

        {showMap && (
          <div
            className={
              // The fleet screen's proportions — see the note there, including why
              // the column is sized for the panel whether or not it is showing.
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
              <SitesMap
                summaries={summaries}
                selectedId={id}
                onSelect={selectSite}
                onDeselect={deselectSite}
                panelInset={mapPanelInset}
                focusIds={split ? visibleIds : undefined}
              />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <SiteDetailPanel
            summary={selected}
            className={
              // Over the map the panel floats, so the basemap keeps running
              // underneath it. In the list-only view it takes its own column
              // instead, so it can't sit on top of the table's last two columns.
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
