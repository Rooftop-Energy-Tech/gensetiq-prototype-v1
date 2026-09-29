import {
  ColumnsIcon,
  GanttChartIcon,
  GlobeIcon,
  MenuIcon,
  PanelRightIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import type {FilterOption} from '@/components/global/FilterSelect';
import {SortSelect} from '@/components/global/SortSelect';
import type {SortOption} from '@/components/global/SortSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {stateNameFromSlug} from '@/modules/genset/data/gensetState';
import {deploymentStateLabel} from '../data/feed';
import type {DeploymentSummary} from '../data/feed';
import type {DeploymentState} from '../types/deployment.type';
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
  {key: 'genset', label: 'Genset', detail: 'By number plate, A to Z'},
  {key: 'location', label: 'State', detail: 'By state, A to Z'},
];

export type DeploymentFacets = {
  byState: Array<FilterOption<DeploymentState>>;
  byLocation: Array<FilterOption<string>>;
};

/**
 * The State dropdown's options: every state the record has a job in, with counts
 * from the facet, plus a picked state at zero where it has none — a click on an
 * empty state on the map filters to it, and the dropdown has to say so. The Gensets
 * toolbar's `stateOptions`, over jobs.
 */
const stateOptions = (
  summary: DeploymentSummary,
  facet: DeploymentFacets['byLocation'],
  picked: string | undefined,
): Array<FilterOption<string>> => {
  const counts = new Map(facet.map((option) => [option.key, option.count]));
  const options = summary.byLocation.map((option) => ({
    ...option,
    count: counts.get(option.key) ?? 0,
  }));
  if (picked === undefined || options.some((option) => option.key === picked)) return options;
  const label = stateNameFromSlug(picked);
  if (label === undefined) return options;
  return [...options, {key: picked, label, count: 0}].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
};

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
  /** Counted over the whole feed — the dropdowns' option lists, which hold still. */
  summary: DeploymentSummary;
  /**
   * Each dropdown's counts over the jobs the *other* filters leave — the Gensets
   * page's faceting — so with Johor picked, `Status` counts Johor's jobs.
   */
  facets: DeploymentFacets;
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
  facets,
  search,
  onSearchChange,
}: DeploymentsToolbarProps) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    {/* The Gensets page's box and rules: half the design's 373px, number plate
        with the spaces ignored — plus the job's reference; the whole row on a phone.
        See `searchDeployments`. */}
    <InputGroup className="w-full flex-1 md:max-w-[187px] md:min-w-[140px]">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Plate or reference"
        aria-label="Search deployments"
      />
    </InputGroup>

    <div className="flex flex-wrap items-center gap-2">
      {/* The Gensets page's first two dropdowns: where the yard is — by position,
          the map's own polygons — and what the job is doing. Counts are faceted. */}
      <FilterSelect
        label="State"
        allLabel="All states"
        options={stateOptions(summary, facets.byLocation, search.location)}
        value={search.location}
        onChange={(next) => onSearchChange({location: next})}
      />
      <FilterSelect<DeploymentState>
        label="Status"
        allLabel="All statuses"
        options={facets.byState}
        value={search.state}
        onChange={(next) => onSearchChange({state: next})}
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
          {/* Four views; the one showing is named and the rest on hover, as on
              the registers. The
              first three are the registers' own and sit in their order, `split` in
              the middle because it is between the other two in what it shows.

              **The Gantt is last and outside that run**, which is deliberate: the
              other three are the same rows drawn in different amounts of space, and
              this one changes the *question* — from "what is out" to "what was out
              when". An axis is a different instrument, and putting it at the end
              keeps the three that vary by degree together. */}
          <TabsList>
            {/* `tabIndex` by hand, for the reason the registers' toolbars give:
                Radix's roving-focus group leaves every trigger at -1 until one has
                been clicked, which makes the switcher unreachable by keyboard on a
                fresh load. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="list"
                  className="group flex-1"
                  aria-label="List"
                  tabIndex={view === 'list' ? 0 : -1}
                >
                  <MenuIcon aria-hidden="true" />
                  <span className="hidden group-aria-selected:inline">List</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">List</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="split"
                  className="group flex-1"
                  aria-label="List + map"
                  tabIndex={view === 'split' ? 0 : -1}
                >
                  <ColumnsIcon aria-hidden="true" />
                  <span className="hidden group-aria-selected:inline">List + map</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">List + map</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="map"
                  className="group flex-1"
                  aria-label="Map"
                  tabIndex={view === 'map' ? 0 : -1}
                >
                  <GlobeIcon aria-hidden="true" />
                  <span className="hidden group-aria-selected:inline">Map</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Map</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="gantt"
                  className="group flex-1"
                  aria-label="Timeline"
                  tabIndex={view === 'gantt' ? 0 : -1}
                >
                  <GanttChartIcon aria-hidden="true" />
                  <span className="hidden group-aria-selected:inline">Timeline</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Timeline</TooltipContent>
            </Tooltip>
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

/**
 * What is narrowing the list, one removable chip per filter, with `Clear all` after
 * them — drawn under the toolbar, and only while something is on. The Gensets page's
 * `GensetsActiveFilters`, over jobs: the search, the state, the status.
 */
export const DeploymentsActiveFilters = ({
  search,
  onSearchChange,
}: {
  search: DeploymentSearch;
  onSearchChange: (next: Partial<DeploymentSearch>) => void;
}) => {
  const chips: Array<{key: string; label: string; clear: Partial<DeploymentSearch>}> = [];
  if (search.q) chips.push({key: 'q', label: `“${search.q}”`, clear: {q: undefined}});
  if (search.location !== undefined) {
    chips.push({
      key: 'location',
      label: stateNameFromSlug(search.location) ?? search.location,
      clear: {location: undefined},
    });
  }
  if (search.state !== undefined) {
    chips.push({key: 'state', label: deploymentStateLabel(search.state), clear: {state: undefined}});
  }

  if (chips.length === 0) return null;

  const clearAll = Object.assign({}, ...chips.map((chip) => chip.clear)) as Partial<DeploymentSearch>;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters" role="group">
      <span className="text-secondary">Filtered by:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onSearchChange(chip.clear)}
          aria-label={`Remove filter ${chip.label}`}
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1 rounded-full border border-subtle bg-highlight pr-1.5 pl-2.5',
            'font-medium whitespace-nowrap text-primary transition-colors outline-none',
            'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
          )}
        >
          {chip.label}
          <XIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSearchChange(clearAll)}
        className="cursor-pointer px-1 font-medium text-secondary underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-outline"
      >
        Clear all
      </button>
    </div>
  );
};
