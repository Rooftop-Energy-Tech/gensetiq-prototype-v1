import {ColumnsIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon, XIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import type {FilterOption} from '@/components/global/FilterSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {FleetSummary} from '../data/fleetSummary';
import {stateNameFromSlug} from '../data/gensetState';
import type {GensetAlarmFilter, GensetFuelFilter, GensetSearch, GensetView} from '../types/view.type';
import {GENSET_ALARM_FILTERS, GENSET_FUEL_FILTERS} from '../types/view.type';
import {RUN_STATES} from '../types/genset.type';
import type {RunState} from '../types/genset.type';
import {RESERVE_FRACTION} from '../types/fuelLevel.type';
import {RUN_STATE_META} from './runStateMeta';

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
  /** The whole fleet — which states exist, and the summary strip's buckets. */
  summary: FleetSummary;
  /**
   * The dropdowns' counts, each over the sets the *other* filters leave — see
   * `facets` in the page. Johor picked, and `Status` counts Johor's sets.
   */
  facets: Pick<FleetSummary, 'byState' | 'byRunState' | 'byAlarm' | 'byFuel'>;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

/**
 * Search, the fleet's filters, and how the fleet is shown.
 *
 * The filter sits here rather than in the card strip for the reason `FilterSelect`
 * sets out: search, filter and view are one sentence — *which gensets, and shown
 * how* — and they belong on one line in that order. The region grouping is an
 * attribute a reader either wants or does not, so it costs a button instead of a
 * card, and the strip above keeps its width for the readiness buckets.
 *
 * **There was a `Duty` filter beside it until 2026-09-28** — grid backup, diesel
 * prime, workshop — and it came out because on this fleet it does not describe the
 * machine. Duty is the *yard's* power role, read off whichever site a set happens to
 * be standing on this week; on a mobile fleet that is a fact about the posting, and
 * the same set changes duty every time a lorry moves it. A filter whose answer for a
 * machine is "wherever it is right now" is a filter on the sites, asked from the
 * wrong register.
 *
 * The estate screen did this first; `SitesToolbar` is the same shape over the yards,
 * copied rather than generalised — see the note there for why two files beat one
 * component taking a placeholder and three labels.
 */
const RESERVE = `${Math.round(RESERVE_FRACTION * 100)}%`;

/**
 * The words and dots the three column filters draw with.
 *
 * Status reads the run-state badge's own labels, so the option and the badge in the
 * column say the same word. Alarm takes the pill's three severity colours and the
 * all-clear green; fuel's low option takes the red the figure turns below the line.
 */
const ALARM_OPTION: Record<GensetAlarmFilter, Omit<FilterOption<GensetAlarmFilter>, 'key' | 'count'>> = {
  CRITICAL: {label: 'Critical', tone: 'critical'},
  WARNING: {label: 'Warning', tone: 'warning'},
  NEUTRAL: {label: 'Neutral', tone: 'neutral'},
  NONE: {label: 'No alarms', tone: 'ok'},
};

const FUEL_OPTION: Record<GensetFuelFilter, Omit<FilterOption<GensetFuelFilter>, 'key' | 'count'>> = {
  low: {label: `Below ${RESERVE}`, tone: 'critical'},
  ok: {label: `${RESERVE} and up`},
};

/**
 * The State options: the states a set stands in, plus the picked one if it has none.
 *
 * A click on an empty state on the map filters to it, and the dropdown has to say so —
 * otherwise the list is empty while the control still reads `State`, a filter on with
 * nothing showing it. The extra option stands at zero and goes when the filter does.
 */
const stateOptions = (
  summary: FleetSummary,
  facet: FleetSummary['byState'],
  picked: string | undefined,
): Array<FilterOption<string>> => {
  // The fleet's states, so the list holds still; counts from the facet, so they
  // follow the other filters — a state with no running set reads 0 under `Running`.
  const counts = new Map(facet.map((option) => [option.key, option.count]));
  const options = summary.byState.map((option) => ({...option, count: counts.get(option.key) ?? 0}));
  if (picked === undefined || options.some((option) => option.key === picked)) return options;
  const label = stateNameFromSlug(picked);
  if (label === undefined) return options;
  return [...options, {key: picked, label, count: 0}].sort((left, right) => left.label.localeCompare(right.label));
};

export const GensetsToolbar = ({
  query,
  onQueryChange,
  view,
  onViewChange,
  panelOpen,
  onPanelOpenChange,
  showViewControls,
  summary,
  facets,
  search,
  onSearchChange,
}: GensetsToolbarProps) => {
  return (
    // `flex-wrap` and a shrinkable search box, as on the estate toolbar: a
    // dropdown plus the view controls need more room than a search box and a
    // switcher, and below `lg` with the preview panel open the row would otherwise
    // push the switcher off the edge.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* Half the design's 373px: a plate is eight characters, and the width is
          better spent on the filters beside it. On a phone it takes the whole
          row, the filters wrapping under it. */}
      <InputGroup className="w-full flex-1 md:max-w-[187px] md:min-w-[140px]">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Number plate"
          aria-label="Search gensets"
        />
      </InputGroup>

      {/* Between the search and the view switcher, in the order the sentence runs:
          where the set is, then the three columns it can be narrowed by, in the
          order the columns stand — `Status`, `Alarm`, `Fuel level`. Each option's
          count is over the sets the other filters leave (`facets`), so with Johor
          picked the other three count Johor's sets. The options themselves stay
          put, zeros included. They combine with each other, with the chips and with
          the search. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="State"
          allLabel="All states"
          options={stateOptions(summary, facets.byState, search.location)}
          value={search.location}
          onChange={(next) => onSearchChange({location: next})}
        />
        <FilterSelect<RunState>
          label="Status"
          allLabel="All statuses"
          options={RUN_STATES.map((key) => ({key, label: RUN_STATE_META[key].label, count: facets.byRunState[key]}))}
          value={search.run}
          onChange={(next) => onSearchChange({run: next})}
        />
        <FilterSelect<GensetAlarmFilter>
          label="Alarm"
          allLabel="All alarms"
          options={GENSET_ALARM_FILTERS.map((key) => ({key, ...ALARM_OPTION[key], count: facets.byAlarm[key]}))}
          value={search.alarm}
          onChange={(next) => onSearchChange({alarm: next})}
        />
        <FilterSelect<GensetFuelFilter>
          label="Fuel level"
          allLabel="All fuel levels"
          options={GENSET_FUEL_FILTERS.map((key) => ({key, ...FUEL_OPTION[key], count: facets.byFuel[key]}))}
          value={search.fuel}
          onChange={(next) => onSearchChange({fuel: next})}
        />
      </div>

      {showViewControls && (
      <div className="ml-auto flex items-center gap-5">
        <Tabs value={view} onValueChange={(next) => onViewChange(next as GensetView)}>
          {/* Three views, the one showing named beside its icon and the others named
              on hover (2026-09-29) — an icon alone left a reader guessing which
              view they were in, and four names in full crowded the filters. `split` sits in
              the middle because it is between the other two in what it shows, and
              because it is the default — the switcher should open on its own
              current state without the eye travelling to an end. */}
          <TabsList>
            {/* `tabIndex` is set by hand because Radix's roving-focus group
                leaves *every* trigger at -1 until one has been clicked — which
                makes the whole switcher unreachable by keyboard on a fresh load.
                Radix spreads consumer props after its own tabIndex, so this
                wins, and it restores the intended behaviour: Tab lands on the
                active view, arrow keys move between them. */}
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

/**
 * What is narrowing the list, one removable chip per filter, with `Clear all` after
 * them — drawn under the toolbar, and only while something is on.
 *
 * Every way the list can be narrowed is here, not only the four dropdowns: the
 * readiness chip in the strip, a `Service due` link from elsewhere, and the search
 * box. A row that named three of five filters would leave a reader wondering why the
 * list is still short, and `Clear all` would clear some of it. Each chip's words are
 * the control's own — the dropdown's option label, the strip's bucket name — so a
 * chip and the control that set it say the same thing.
 */
export const GensetsActiveFilters = ({
  summary,
  search,
  onSearchChange,
}: {
  summary: FleetSummary;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
}) => {
  const chips: Array<{key: string; label: string; clear: Partial<GensetSearch>}> = [];
  if (search.q) chips.push({key: 'q', label: `“${search.q}”`, clear: {q: undefined}});
  if (search.location !== undefined) {
    chips.push({key: 'location', label: stateNameFromSlug(search.location) ?? search.location, clear: {location: undefined}});
  }
  if (search.run !== undefined) chips.push({key: 'run', label: RUN_STATE_META[search.run].label, clear: {run: undefined}});
  if (search.alarm !== undefined) {
    // `Critical` alone does not say which dimension it is; `No alarms` already does.
    const label = search.alarm === 'NONE' ? ALARM_OPTION.NONE.label : `${ALARM_OPTION[search.alarm].label} alarm`;
    chips.push({key: 'alarm', label, clear: {alarm: undefined}});
  }
  if (search.fuel !== undefined) chips.push({key: 'fuel', label: `Fuel ${FUEL_OPTION[search.fuel].label.toLowerCase()}`, clear: {fuel: undefined}});
  if (search.status !== undefined) {
    const label = summary.byStatus.find((tally) => tally.key === search.status)?.label ?? search.status;
    chips.push({key: 'status', label, clear: {status: undefined}});
  }
  if (search.service !== undefined) chips.push({key: 'service', label: 'Service due', clear: {service: undefined}});

  if (chips.length === 0) return null;

  const clearAll = Object.assign({}, ...chips.map((chip) => chip.clear)) as Partial<GensetSearch>;

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
