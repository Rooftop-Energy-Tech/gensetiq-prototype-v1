import {Suspense, lazy, useMemo} from 'react';
import {SearchXIcon} from 'lucide-react';

import {GENSETS} from './data/fleet';
import {GensetDetailPanel} from './components/GensetDetailPanel';
import {GensetsTable} from './components/GensetsTable';
import {GensetsToolbar} from './components/GensetsToolbar';
import {searchGensets, sortGensets} from './utils/searchGensets';
import type {GensetSearch} from './types/view.type';

/**
 * MapLibre is ~800 kB — three quarters of this route's bundle — and the list is
 * the default view, so the map is fetched only once someone actually switches to
 * it. Splitting here rather than at the route keeps the toolbar and table
 * instant on first paint.
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
  const {view, q = '', id, panel} = search;

  const gensets = useMemo(() => sortGensets(searchGensets(GENSETS, q)), [q]);

  // Resolved against the *filtered* list, not the whole fleet: if a search hides
  // the selected unit, the panel should say so rather than describing a row the
  // user can no longer see.
  const selected = useMemo(
    () => gensets.find((genset) => genset.id === id),
    [gensets, id],
  );

  const panelOpen = panel;
  const mapPanelInset = view === 'map' && panelOpen ? PANEL_WIDTH + PANEL_INSET : 0;

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <GensetsToolbar
        query={q}
        onQueryChange={(next) => onSearchChange({q: next || undefined})}
        view={view}
        onViewChange={(next) => onSearchChange({view: next})}
        panelOpen={panelOpen}
        onPanelOpenChange={(next) => onSearchChange({panel: next})}
      />

      <div className="relative flex min-h-0 flex-1 gap-3">
        {view === 'map' ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-subtle bg-element">
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
                panelInset={mapPanelInset}
              />
            </Suspense>
          </div>
        ) : gensets.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <SearchXIcon className="size-6 text-tertiary" aria-hidden="true" />
            <p className="text-sm text-secondary">No gensets match “{q}”.</p>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1">
            <GensetsTable
              gensets={gensets}
              selectedId={id}
              onSelect={selectGenset}
            />
          </div>
        )}

        {panelOpen && (
          <GensetDetailPanel
            genset={selected}
            className={
              // Over the map, the panel floats — the basemap should keep running
              // underneath it, the way the design shows. In the list it takes its
              // own column instead, so it can't sit on top of the table's last
              // two columns.
              view === 'map'
                ? 'absolute inset-y-2 right-2 z-10 w-[393px] shadow-lg'
                : 'w-[393px] shrink-0'
            }
          />
        )}
      </div>
    </div>
  );
};
