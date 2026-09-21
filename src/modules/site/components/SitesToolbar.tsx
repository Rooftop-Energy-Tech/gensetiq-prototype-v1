import {ColumnsIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import {SortSelect} from '@/components/global/SortSelect';
import type {SiteSort} from '../types/view.type';
import type {SortOption} from '@/components/global/SortSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {CUSTOMER_TERM} from '../data/customers';
import type {EstateSummary} from '../data/estateSummary';
import type {SiteSearch, SiteView} from '../types/view.type';

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
   * 393px preview panel are desktop-only.
   */
  showViewControls: boolean;
  /** Counted over the whole estate, so a dropdown's counts do not move as you filter. */
  summary: EstateSummary;
  search: SiteSearch;
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

/**
 * The fleet toolbar's controls, over the estate — and the estate's three attribute
 * filters, which the fleet screen still keeps in its card strip.
 *
 * Copied in shape rather than generalised into one shared component: the two
 * differ in what their search box matches and in what the views *are*, and a
 * toolbar taking a search placeholder plus two view labels plus a panel toggle is
 * a worse thing to read than two files that each say what they do. When a third
 * screen wants this, that is the moment to lift it.
 *
 * ## Why the filters are here and not in the cards
 *
 * Search, filters and view are one sentence — *which sites, and shown how* — and
 * they belong on one line in that order: narrow by text, narrow by attribute, then
 * choose the shape. Putting the attribute filters in cards separated them from the
 * search box doing the same job, and cost three cards' width to say what three
 * buttons say. See `FilterSelect` for which filters earn a card and which do not.
 */
/**
 * The three orderings, and which way each runs.
 *
 * Worded as the *answer* rather than the field — `Worst first`, not `Descending` —
 * because a reader choosing a sort is choosing what they want at the top of the
 * list, and "descending" leaves them working out what it descends by.
 */
const SITE_SORT_OPTIONS: ReadonlyArray<SortOption<SiteSort>> = [
  {key: 'alarms', label: 'Alarms', detail: 'Worst standing alarm first'},
  {key: 'fuel', label: 'Fuel level', detail: 'Emptiest tank first'},
  {key: 'name', label: 'Site name', detail: 'A to Z'},
];

export const SitesToolbar = ({
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
}: SitesToolbarProps) => {
  return (
    // `flex-wrap` and a shrinkable search box: three dropdowns plus the view
    // controls need more room than the fleet toolbar's two groups, and below `lg`
    // with the preview panel open the row would otherwise push the switcher off the
    // edge. Wrapped, the filters drop under the search rather than being clipped.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* 373px is the design's search width on the fleet screen; the same box for
          the same job. It matches the site's name, its placename, what kind of
          load it carries and the tags standing on it — the last because "which
          site is BRF9540 at" is the question this list gets asked most. */}
      <InputGroup className="w-full max-w-[373px] min-w-[200px] flex-1">
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

      {/* Between the search and the view switcher, in the order the sentence runs.
          `Supply` first because it is the one attribute that changes what the site
          *page* draws; then where it is, then which rollout filed it — the same
          order the cards had. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Supply"
          allLabel="All supplies"
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
        {/* Withheld entirely on an estate whose dataset declares no programmes —
            `byProgram` is empty there and `FilterSelect` draws nothing, the same
            condition the card used to carry. */}
        <FilterSelect
          label="Programme"
          allLabel="All programmes"
          options={summary.byProgram}
          value={search.program}
          onChange={(next) => onSearchChange({program: next})}
        />
        {/* Last in the row, and after a thin rule: the three before it narrow *what
            is in* the list and this one only says what order it comes in. Grouped
            with them rather than put by the view switcher because it is a property
            of the list, not of how the list is drawn — the map reads the same order.
            See `SITE_SORTS`. */}
        <span className="h-5 w-px shrink-0 bg-subtle" aria-hidden="true" />
        <SortSelect
          options={SITE_SORT_OPTIONS}
          value={search.sort}
          onChange={(next) => onSearchChange({sort: next})}
        />
      </div>

      {showViewControls && (
      <div className="ml-auto flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as SiteView)}>
          {/* Three views now, so the list is 105px rather than 70. `split` sits in
              the middle because it is between the other two in what it shows, and
              because it is the default — the switcher should open on its own
              current state without the eye travelling to an end. */}
          <TabsList className="w-[105px]">
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
