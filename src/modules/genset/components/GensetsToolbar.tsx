import {ColumnsIcon, GlobeIcon, MenuIcon, PanelRightIcon, SearchIcon} from 'lucide-react';

import {FilterSelect} from '@/components/global/FilterSelect';
import type {FilterOption} from '@/components/global/FilterSelect';
import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {FleetSummary} from '../data/fleetSummary';
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
  /** Counted over the whole fleet, so a dropdown's counts do not move as you filter. */
  summary: FleetSummary;
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
    // `flex-wrap` and a shrinkable search box, as on the estate toolbar: a
    // dropdown plus the view controls need more room than a search box and a
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
          placeholder="Number plate"
          aria-label="Search gensets"
        />
      </InputGroup>

      {/* Between the search and the view switcher, in the order the sentence runs:
          where the set is, then the three columns it can be narrowed by, in the
          order the columns stand — `Status`, `Alarm`, `Fuel level`. Each option's
          count is over the whole fleet, like the chips below, so the list holds
          still while the table answers the narrower question. They combine with
          each other, with the chips and with the search. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="State"
          allLabel="All states"
          options={summary.byState}
          value={search.location}
          onChange={(next) => onSearchChange({location: next})}
        />
        <FilterSelect<RunState>
          label="Status"
          allLabel="All statuses"
          options={RUN_STATES.map((key) => ({key, label: RUN_STATE_META[key].label, count: summary.byRunState[key]}))}
          value={search.run}
          onChange={(next) => onSearchChange({run: next})}
        />
        <FilterSelect<GensetAlarmFilter>
          label="Alarm"
          allLabel="All alarms"
          options={GENSET_ALARM_FILTERS.map((key) => ({key, ...ALARM_OPTION[key], count: summary.byAlarm[key]}))}
          value={search.alarm}
          onChange={(next) => onSearchChange({alarm: next})}
        />
        <FilterSelect<GensetFuelFilter>
          label="Fuel level"
          allLabel="All fuel levels"
          options={GENSET_FUEL_FILTERS.map((key) => ({key, ...FUEL_OPTION[key], count: summary.byFuel[key]}))}
          value={search.fuel}
          onChange={(next) => onSearchChange({fuel: next})}
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
