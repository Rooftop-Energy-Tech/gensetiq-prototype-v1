import {ColumnsIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {CUSTOMER_TERM} from '@/modules/site/data/customers';
import type {FleetSummary} from '../data/fleetSummary';
import type {GensetSearch, GensetView} from '../types/view.type';

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
   * 393px preview panel are desktop-only. Search and the two filters are the whole
   * toolbar there, which is why they are the controls not behind this flag — they
   * are also the only filtering that width has once the strip is folded.
   */
  showViewControls: boolean;
  /** Counted over the whole fleet, so a dropdown's counts do not move as you filter. */
  summary: FleetSummary;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

/**
 * Search, the fleet's two attribute filters, and how the fleet is shown.
 *
 * The filters sit here rather than in the card strip for the reason `FilterSelect`
 * sets out: search, filters and view are one sentence — *which gensets, and shown
 * how* — and they belong on one line in that order. Duty and the region grouping are
 * attributes a reader either wants or does not, so they cost a button each instead of
 * a card each, and the strip above keeps its width for the readiness buckets.
 *
 * The estate screen did this first; `SitesToolbar` is the same shape over the yards,
 * copied rather than generalised — see the note there for why two files beat one
 * component taking a placeholder and three labels.
 */
export const GensetsToolbar = ({
  query,
  onQueryChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
  summary,
  search,
  onSearchChange,
}: GensetsToolbarProps) => {
  return (
    // `flex-wrap` and a shrinkable search box, as on the estate toolbar: two
    // dropdowns plus the view controls need more room than a search box and a
    // switcher, and below `lg` with the preview panel open the row would otherwise
    // push the switcher off the edge.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* 373px is the design's width. It shrinks on narrow viewports rather than
          pushing the view switcher off the right edge. */}
      <InputGroup className="w-full max-w-[373px] min-w-[200px] flex-1">
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

      {/* Between the search and the view switcher, in the order the sentence runs.
          `Duty` first because it is the coarser cut — what the machine is *for* — and
          then where it stands. The same two, in the same order, the cards had. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Duty"
          allLabel="All duties"
          options={summary.byRole}
          value={search.role}
          onChange={(next) => onSearchChange({role: next})}
        />
        <FilterSelect
          label={CUSTOMER_TERM}
          allLabel={`All ${CUSTOMER_TERM.toLowerCase()}s`}
          options={summary.byCustomer}
          value={search.customer}
          onChange={(next) => onSearchChange({customer: next})}
        />
      </div>

      {showViewControls && (
      <div className="ml-auto flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as GensetView)}>
          {/* Three views now, so the list is 105px rather than 70. `split` sits in
              the middle because it is between the other two in what it shows, and
              because it is the default — the switcher should open on its own
              current state without the eye travelling to an end. */}
          <TabsList className="w-[105px]">
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
