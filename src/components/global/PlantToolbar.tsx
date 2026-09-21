import {ColumnsIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {FilterOption} from '@/components/global/FilterSelect';

/**
 * Search, the region filter, and how the plant is shown — the toolbar over the
 * solar and battery registers.
 *
 * ## Why this one is shared and the other two are not
 *
 * `GensetsToolbar` and `SitesToolbar` are deliberate copies, and the note on the
 * second says why: *"the same shape over the yards, copied rather than generalised —
 * two files beat one component taking a placeholder and three labels."* That
 * argument turns on their **filters** differing: the fleet cuts by duty and region,
 * the estate by supply, region and programme, and a component covering both would be
 * a list of optional dropdowns with a flag per screen.
 *
 * Solar and battery do not differ. Both are one row per site, both cut by region and
 * nothing else, and both search a name. So the difference between them really is a
 * placeholder and a label — which is the case the note was ruling *in*, not out.
 *
 * The controls read left to right as one sentence — **which plant, and shown how** —
 * which is the order `FilterSelect` argues for and the order both other toolbars use.
 */

/**
 * The three views, structurally the same union `SOLAR_VIEWS` and `BATTERY_VIEWS`
 * both produce.
 *
 * Not imported from either: a shared control importing one module's vocabulary would
 * make the other module depend on it sideways. Each register keeps its own union
 * because each keeps its own URL schema, and this is the shape they agree on.
 */
export type PlantView = 'split' | 'list' | 'map';

type PlantToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /** What the box searches, in the words of the thing being searched — `System name`. */
  placeholder: string;
  /** The field's accessible name — `Search solar systems`. */
  searchLabel: string;
  /**
   * Regions with plant in them, counted over the **whole** register.
   *
   * Over the whole list deliberately, the rule `fleetSummary` sets out: a dropdown
   * whose counts shrink to match the filter it just applied says nothing, and the way
   * back to the full picture disappears with the numbers.
   */
  regions: Array<FilterOption<string>>;
  /** The region term this dataset uses — `Region`, `Zone`. See `CUSTOMER_TERM`. */
  regionLabel: string;
  region: string | undefined;
  onRegionChange: (next: string | undefined) => void;
  view: PlantView;
  onViewChange: (view: PlantView) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /**
   * Show the view switcher and the panel toggle.
   *
   * `false` at phone width, where neither has anything to switch: the map's own
   * controls and the 393px preview panel have no phone form. Search and the region
   * filter are the whole toolbar there — the same rule `GensetsToolbar` follows, that
   * the app offers no control it cannot honour.
   */
  showViewControls: boolean;
};

export const PlantToolbar = ({
  query,
  onQueryChange,
  placeholder,
  searchLabel,
  regions,
  regionLabel,
  region,
  onRegionChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
}: PlantToolbarProps) => {
  return (
    // `flex-wrap` and a shrinkable search box, as on the fleet and estate toolbars:
    // below `lg` with the preview panel open the row would otherwise push the
    // switcher off the right edge.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* 373px is the design's width, shrinking on narrow viewports rather than
          pushing the view switcher off the edge. */}
      <InputGroup className="w-full max-w-[373px] min-w-[200px] flex-1">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
        />
      </InputGroup>

      <FilterSelect
        label={regionLabel}
        allLabel={`All ${regionLabel.toLowerCase()}s`}
        options={regions}
        value={region}
        onChange={onRegionChange}
      />

      {showViewControls && (
        <div className="ml-auto flex items-center gap-5">
          <Tabs value={view} onValueChange={(next) => onViewChange(next as PlantView)}>
            {/* `split` sits in the middle because it is between the other two in what
                it shows, and because it is the default — a switcher should open on its
                own current state without the eye travelling to an end. */}
            <TabsList className="w-[105px]">
              {/* `tabIndex` is set by hand because Radix's roving-focus group leaves
                  *every* trigger at -1 until one has been clicked, which makes the
                  switcher unreachable by keyboard on a fresh load. Radix spreads
                  consumer props after its own tabIndex, so this wins. */}
              <TabsTrigger
                value="list"
                className="flex-1"
                aria-label="List view"
                tabIndex={view === 'list' ? 0 : -1}
              >
                <MenuIcon aria-hidden="true" />
              </TabsTrigger>
              <TabsTrigger
                value="split"
                className="flex-1"
                aria-label="List and map"
                tabIndex={view === 'split' ? 0 : -1}
              >
                <ColumnsIcon aria-hidden="true" />
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
                <PanelRightIcon
                  className={cn(!panelOpen && 'text-secondary')}
                  aria-hidden="true"
                />
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
