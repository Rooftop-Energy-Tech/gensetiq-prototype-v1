import {Suspense, lazy, useMemo} from 'react';
import {SearchXIcon} from 'lucide-react';

import {useIsCompact} from '@/lib/useIsCompact';
import {searchSites, sortSites, useSiteSummaries} from './data/sites';
import {SiteDetailPanel} from './components/SiteDetailPanel';
import {SitesCards} from './components/SitesCards';
import {SitesTable} from './components/SitesTable';
import {SitesToolbar} from './components/SitesToolbar';
import type {SiteSearch} from './types/view.type';

/**
 * MapLibre is ~800 kB, and the list is the default view — so the map is fetched
 * only once somebody switches to it, the same split the fleet screen makes. The
 * two maps share the library, so whichever screen loads it first pays for both.
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
 * `/sites` — seventeen sites, worst condition first, as a list or on a map.
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
  const {view, q = '', id, panel} = search;

  // Keyed on the summaries as well as the query: attaching or detaching a genset
  // changes a site's genset count, its fuel and its condition, and condition is what
  // this list is *ordered* by. Memoising on `q` alone would leave the list ranked by
  // a fleet that has since moved.
  const all = useSiteSummaries();
  const summaries = useMemo(() => sortSites(searchSites(all, q)), [all, q]);

  // Resolved against the *filtered* list, not the whole estate: if a search hides
  // the selected site, the panel should say so rather than describing a row the
  // user can no longer see.
  const selected = useMemo(
    () => summaries.find((summary) => summary.site.id === id),
    [summaries, id],
  );

  /**
   * At phone width this screen is the card list and nothing else — the same call
   * the fleet screen makes, for the same reason: neither the map's controls nor a
   * floating 393px panel has a phone form, and the app offers no control it cannot
   * honour. `view` in the URL is left untouched, so the same link opens the map on
   * a desktop and the list on a phone.
   */
  const compact = useIsCompact();

  const showMap = view === 'map' && !compact;
  // Undefaulted `panel` → the selection decides, as on the fleet screen: a first
  // load with nothing selected keeps the full width for the list.
  const panelOpen = (panel ?? id !== undefined) && !compact;
  const mapPanelInset = showMap && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

  // Selecting a site opens the panel whether or not the toggle was on — the fleet
  // screen's rule, for its reason: with the panel closed, clicking a pin tints it
  // and does nothing else, which reads as a broken control rather than a
  // deliberate one.
  const selectSite = (next: string) => onSearchChange({id: next, panel: true});

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

      <div className="relative flex min-h-0 flex-1 gap-3">
        {showMap ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-subtle bg-element">
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
                panelInset={mapPanelInset}
              />
            </Suspense>
          </div>
        ) : summaries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">No sites match “{q}”.</p>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1">
            {compact ? (
              <SitesCards summaries={summaries} />
            ) : (
              <SitesTable summaries={summaries} selectedId={id} onSelect={selectSite} />
            )}
          </div>
        )}

        {panelOpen && (
          <SiteDetailPanel
            summary={selected}
            className={
              // Over the map the panel floats, so the basemap keeps running
              // underneath it. In the list it takes its own column instead, so it
              // can't sit on top of the table's last two columns.
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
