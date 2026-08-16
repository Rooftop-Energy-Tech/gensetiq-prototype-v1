import {GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {SiteView} from '../types/view.type';

type SitesToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  view: SiteView;
  onViewChange: (view: SiteView) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /**
   * Show the view switcher and the panel toggle.
   *
   * `false` at phone width, where neither has anything to switch: the map and the
   * 393px preview panel are desktop-only. Search is the whole toolbar there.
   */
  showViewControls: boolean;
};

/**
 * The fleet toolbar's controls, over the estate.
 *
 * Copied in shape rather than generalised into one shared component: the two
 * differ in what their search box matches and in what the views *are*, and a
 * toolbar taking a search placeholder plus two view labels plus a panel toggle is
 * a worse thing to read than two thirty-line files that each say what they do.
 * When a third screen wants this, that is the moment to lift it.
 */
export const SitesToolbar = ({
  query,
  onQueryChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
}: SitesToolbarProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* 373px is the design's search width on the fleet screen; the same box for
          the same job. It matches the site's name, its placename, what kind of
          load it carries and the tags standing on it — the last because "which
          site is BRF9540 at" is the question this list gets asked most. */}
      <InputGroup className="w-full max-w-[373px]">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Site, place or genset tag"
          aria-label="Search sites"
        />
      </InputGroup>

      {showViewControls && (
      <div className="flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as SiteView)}>
          <TabsList className="w-[70px]">
            {/* `tabIndex` is set by hand for the reason the fleet toolbar gives:
                Radix's roving-focus group leaves every trigger at -1 until one has
                been clicked, which makes the switcher unreachable by keyboard on a
                fresh load. */}
            <TabsTrigger
              value="list"
              className="flex-1"
              aria-label="List view"
              tabIndex={view === 'list' ? 0 : -1}
            >
              <MenuIcon aria-hidden="true" />
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="flex-1"
              aria-label="Map view"
              tabIndex={view === 'map' ? 0 : -1}
            >
              <GlobeIcon aria-hidden="true" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-pressed={panelOpen}
              onClick={() => onPanelOpenChange(!panelOpen)}
            >
              <PanelRightIcon className={cn(!panelOpen && 'text-secondary')} aria-hidden="true" />
              <span className="sr-only">{panelOpen ? 'Hide details' : 'Show details'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{panelOpen ? 'Hide details' : 'Show details'}</TooltipContent>
        </Tooltip>
      </div>
      )}
    </div>
  );
};
