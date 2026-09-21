import {ColumnsIcon, GanttChartIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {SortSelect} from '@/components/global/SortSelect';
import type {SortOption} from '@/components/global/SortSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {CUSTOMER_TERM} from '@/modules/site/data/customers';
import type {DeploymentSummary} from '../data/feed';
import type {DeploymentSearch, DeploymentSort, DeploymentView} from '../types/view.type';

/**
 * The registers' toolbar, over postings — copied in shape rather than generalised,
 * for the reason `SitesToolbar` gives: the three differ in what their search box
 * matches and in what the views *are*, and a toolbar taking a placeholder plus four
 * view labels is a worse thing to read than three files that each say what they do.
 *
 * One control here has no equivalent above it: a fourth view. See the switcher.
 */

/**
 * The four orderings, worded as the *answer* rather than the field — the registers'
 * rule, because a reader choosing a sort is choosing what they want at the top.
 */
const DEPLOYMENT_SORT_OPTIONS: ReadonlyArray<SortOption<DeploymentSort>> = [
  {key: 'started', label: 'Sent out', detail: 'Most recently dispatched first'},
  {key: 'duration', label: 'Time standing', detail: 'Longest posting first'},
  {key: 'fuel', label: 'Fuel burned', detail: 'Thirstiest posting first'},
  {key: 'genset', label: 'Genset', detail: 'By tag, A to Z'},
];

type DeploymentsToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  view: DeploymentView;
  onViewChange: (view: DeploymentView) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /** Show the view switcher and the panel toggle — `false` at phone width. */
  showViewControls: boolean;
  /**
   * Show the ordering dropdown.
   *
   * `false` wherever the table is drawn: its column headers are the sort control
   * there, and two controls for one piece of state is one of them lying about who
   * owns it. See `DeploymentsTable`.
   */
  showSort: boolean;
  /** Counted over the whole feed, so a dropdown's counts do not move as you filter. */
  summary: DeploymentSummary;
  search: DeploymentSearch;
  onSearchChange: (next: Partial<DeploymentSearch>) => void;
};

export const DeploymentsToolbar = ({
  query,
  onQueryChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
  showSort,
  summary,
  search,
  onSearchChange,
}: DeploymentsToolbarProps) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    {/* 373px is the design's search width across this app; the same box for the same
        job. It matches the tag, the model, the yard, the placename and the lorry
        plate — the last because "where is SAB 4417 T" is a question this feed gets
        asked, and it is the one field here belonging to neither machine nor site. */}
    <InputGroup className="w-full max-w-[373px] min-w-[200px] flex-1">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Genset, site or lorry plate"
        aria-label="Search deployments"
      />
    </InputGroup>

    <div className="flex flex-wrap items-center gap-2">
      {/* One attribute filter, where the estate has three. A posting's other
          attributes — its state, its machine, its yard — are each already a control
          on this screen: the state is the strip's chips, the machine and the yard are
          what the search box matches. Whose division it stood in is the one dimension
          nothing else here offers. */}
      <FilterSelect
        label={CUSTOMER_TERM}
        allLabel={`All ${CUSTOMER_TERM.toLowerCase()}s`}
        options={summary.byCustomer}
        value={search.customer}
        onChange={(next) => onSearchChange({customer: next})}
      />

      {/* The *fallback* ordering control — see `showSort`. Picking a key here drops
          `dir`, so the dropdown always means that key's natural direction, which is
          what its second line says it means. */}
      {showSort && (
        <>
          <span className="h-5 w-px shrink-0 bg-subtle" aria-hidden="true" />
          <SortSelect
            options={DEPLOYMENT_SORT_OPTIONS}
            value={search.sort}
            onChange={(next) => onSearchChange({sort: next, dir: undefined})}
          />
        </>
      )}
    </div>

    {showViewControls && (
      <div className="ml-auto flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as DeploymentView)}>
          {/* Four views, so the list is 140px rather than the registers' 105. The
              first three are the registers' own and sit in their order, `split` in
              the middle because it is between the other two in what it shows.

              **The Gantt is last and outside that run**, which is deliberate: the
              other three are the same rows drawn in different amounts of space, and
              this one changes the *question* — from "what is out" to "what was out
              when". An axis is a different instrument, and putting it at the end
              keeps the three that vary by degree together. */}
          <TabsList className="w-[140px]">
            {/* `tabIndex` by hand, for the reason the registers' toolbars give:
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
            <TabsTrigger
              value="gantt"
              className="flex-1"
              aria-label="Timeline view"
              tabIndex={view === 'gantt' ? 0 : -1}
            >
              <GanttChartIcon aria-hidden="true" />
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
