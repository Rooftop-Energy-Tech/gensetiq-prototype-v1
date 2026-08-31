import {Link, Outlet} from '@tanstack/react-router';
import {InfoIcon, MapPinIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {relativeTime, stampDate} from '@/lib/format';
import {systemName} from '../../types/system.type';
import type {SolarSystem} from '../../types/system.type';

/**
 * The six tabs across the top of a solar system.
 *
 * They are the six the section scaffold stood up at `/solar` before there was a
 * system to hang them on, moved down one level to the place `SectionTabs` said
 * they would eventually live: *"`/gensets` is a register: a list of machines, and
 * the tabs live one level down on each machine."*
 *
 * The set is a genset's eight minus `Runs` and `Refuel`, which are facts about an
 * engine — a PV system does not start, stop, or take delivery of anything.
 * Nothing has been added in their place. `Inverters` was drafted as a seventh and
 * cut: the boxes are band 2 of the home page, and a tab whose contents are the
 * thing you already saw on arriving is a tab that teaches a reader to stop
 * opening tabs. Each box has a page; it is reached from the row, the way a
 * genset's is reached from a site page.
 */
const TABS = [
  {label: 'Home', to: '/solar/$systemId'},
  {label: 'Analysis', to: '/solar/$systemId/analysis'},
  {label: 'Service', to: '/solar/$systemId/service'},
  {label: 'Alarms', to: '/solar/$systemId/alarms'},
  {label: 'Equipment', to: '/solar/$systemId/equipment'},
  {label: 'Settings', to: '/solar/$systemId/settings'},
] as const;

/**
 * Everything one system's pages share: the title row and the tab strip.
 *
 * Deliberately the same header as a genset's, down to the info glyph, because
 * these are two registers of plant standing at the same sites and a reader moves
 * between them all day. What differs is what the tooltip carries — a system's
 * unhoused facts are how it is built and how big it is, where a genset's are its
 * tag, its model and its tank.
 *
 * There is no condition badge here for the reason the genset shell gives for
 * having no connectivity one: the state hero in band 1 already says whether we
 * can hear this thing, and a second badge in the header inviting a comparison
 * with it is how two parts of one page start disagreeing.
 */
export const SystemDetailShell = ({system}: {system: SolarSystem}) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2">
      {/* Stacked below `md`, the genset shell's rule and for its reason: side by
          side the name gives up its width to the placename and truncates to
          `WPKL-0207 | 4…`, and on a phone the site's own name is the one thing on
          this page that has to survive. */}
      <div className="flex min-w-0 flex-col items-start gap-1 md:flex-row md:items-center md:gap-6">
        <h1 className="max-w-full truncate text-base font-medium text-primary">
          {systemName(system)}
        </h1>

        <div className="flex shrink-0 items-center gap-5">
          <span className="flex items-center gap-2 text-sm text-secondary">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {system.locationLabel}
          </span>

          <Tooltip>
            <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
              <InfoIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">System details</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col gap-1">
              <span>Site · {system.siteName}</span>
              <span>
                Inverters · {system.inverters.length} × {system.inverters[0]?.model} (
                {system.acKw} kW AC)
              </span>
              <span>Strings · {system.strings}</span>
              <span>Commissioned · {stampDate(system.commissionedAt)}</span>
              <span>Telemetry · {relativeTime(system.lastUpdated)}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Hidden at phone width, the rule the genset shell and the bottom nav both
          follow: `Home` is the only tab with a mobile layout, and offering a door
          the app cannot open properly is worse than not offering it. The routes
          still resolve if one is typed. */}
      <div className="hidden items-center gap-5 md:flex">
        <nav
          aria-label="System sections"
          className="flex h-9 items-center gap-0 rounded-lg bg-element p-[3px]"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              params={{systemId: system.id}}
              // `exact` on Home only, or it stays lit on every child route —
              // `/solar/x` prefixes all of them, the inverter pages included.
              activeOptions={{exact: tab.to === '/solar/$systemId', includeSearch: false}}
              className="flex h-full items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:text-primary data-[status=active]:border-subtle data-[status=active]:bg-highlight data-[status=active]:text-primary"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto">
      <Outlet />
    </div>
  </div>
);
