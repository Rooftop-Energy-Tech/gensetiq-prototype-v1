import {GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {GensetView} from '../types/view.type';

type GensetsToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  view: GensetView;
  onViewChange: (view: GensetView) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /**
   * Show the view switcher and the panel toggle.
   *
   * `false` at phone width, where neither has anything to switch: the map and the
   * 393px preview panel are desktop-only. Search is the whole toolbar there, which
   * is why it is the one control not behind this flag.
   */
  showViewControls: boolean;
};

export const GensetsToolbar = ({
  query,
  onQueryChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
}: GensetsToolbarProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* 373px is the design's width. It shrinks on narrow viewports rather than
          pushing the view switcher off the right edge. */}
      <InputGroup className="w-full max-w-[373px]">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Genset name"
          aria-label="Search gensets"
        />
      </InputGroup>

      {showViewControls && (
      <div className="flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as GensetView)}>
          <TabsList className="w-[70px]">
            {/* `tabIndex` is set by hand because Radix's roving-focus group
                leaves *every* trigger at -1 until one has been clicked — which
                makes the whole switcher unreachable by keyboard on a fresh load.
                Radix spreads consumer props after its own tabIndex, so this
                wins, and it restores the intended behaviour: Tab lands on the
                active view, arrow keys move between them. */}
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
