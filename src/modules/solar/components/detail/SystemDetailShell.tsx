import {Outlet} from '@tanstack/react-router';
import {
  BellIcon,
  ChartLineIcon,
  CircuitBoardIcon,
  InfoIcon,
  PanelsTopLeftIcon,
  SettingsIcon,
  WrenchIcon,
} from 'lucide-react';

import {
  DetailSidebar,
  DetailSidebarBackCard,
  DetailSidebarLabel,
} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {relativeTime, stampDate} from '@/lib/format';
import {systemName} from '../../types/system.type';
import type {SolarSystem} from '../../types/system.type';

/**
 * The six sections of a solar system, as rows in a rail rather than tabs in a
 * strip — the same move the site and the genset made, and made here for the same
 * reason: these three are plant standing at one place, and a reader moving between
 * them all day should find the navigation in the same column saying the same kinds
 * of thing.
 *
 * The set is unchanged. It is a genset's seven minus `Runs`, which is a fact about
 * an engine — a PV system does not start or stop.
 *
 * Two labels differ from the routes behind them, exactly as the genset rail's do.
 * `Solar` is the home route, named for its subject: "Home" says nothing in a
 * column already headed by the system's own name. `Devices` is what `/equipment`
 * is called in the design's rail, and it is the genset rail's word for the same
 * page, so the two registers agree.
 *
 * ## Why this rail does not nest
 *
 * A rail can, and the site's does — `Asset ▸ Genset / Solar / Battery` is the
 * whole reason the strip was replaced. This one had a candidate for it:
 * `Inverters ▸ 1 … 10`, one row per box, each with a page of readings behind it.
 *
 * That argument was answered twice. First on its own terms — a 1,333 kWp
 * mini-grid was ten boxes in parallel, so a nested list would have been an
 * inventory at exactly the systems where it was meant to help and a list of one
 * everywhere else. Then by the model: there are no boxes. A telco site runs a
 * −48 V DC bus and its loads are DC, so the array feeds the bus and there is no
 * AC stage to invert to.
 *
 * `Devices` stayed and changed subject. It is the array now — the glass, the
 * strings, and how many of them are dark — which is one page and not a level.
 */
const NAV_ENTRIES = (systemId: string): Array<DetailNavEntry> => {
  const params = {systemId};

  return [
    // `end` on the landing row alone: `/solar/x` prefixes every route below it.
    {label: 'Solar', icon: PanelsTopLeftIcon, to: '/solar/$systemId', params, end: true},
    {label: 'Analysis', icon: ChartLineIcon, to: '/solar/$systemId/analysis', params},
    {label: 'Service', icon: WrenchIcon, to: '/solar/$systemId/service', params},
    {label: 'Alarms', icon: BellIcon, to: '/solar/$systemId/alarms', params},
    {label: 'Devices', icon: CircuitBoardIcon, to: '/solar/$systemId/equipment', params},
    {label: 'Settings', icon: SettingsIcon, to: '/solar/$systemId/settings', params},
  ];
};

/**
 * Everything one system's pages share: the rail on the left, an `<Outlet />`
 * beside it.
 *
 * ## The way back
 *
 * The same `DetailSidebarBackCard` the genset rail carries, and here for the same
 * reason: a reader arrives from `Asset ▸ Solar` in the site's own rail, and this
 * is what puts that rail back.
 *
 * `system.siteId` rather than `system.id`: the two are equal today, one system per
 * site, and `system.type.ts` keeps them separate precisely so that a site which
 * grows a second array does not silently link somewhere wrong.
 *
 * Unlike a genset, a system cannot be at the depot — it *is* the PV at a site, so
 * there is always a site to go back to, and no branch for the case where there is
 * not.
 *
 * The info glyph carries what the header's tooltip did, less the site: the card
 * above names that now, and restating it two rows apart is the kind of duplication
 * the site header's tooltip was retired for.
 */
export const SystemDetailShell = ({system}: {system: SolarSystem}) => (
  <div className="flex min-h-0 flex-1 overflow-hidden">
    <DetailSidebar
      ariaLabel="System sections"
      header={
        <div className="flex flex-col gap-2">
          <DetailSidebarBackCard
            siteId={system.siteId}
            name={system.siteName}
            locationLabel={system.locationLabel}
          />

          <DetailSidebarLabel
            aside={
              <Tooltip>
                <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
                  <InfoIcon className="size-4" aria-hidden="true" />
                  <span className="sr-only">System details</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <span>
                    Modules · {system.modules.toLocaleString('en-MY')} × {system.moduleWatts} W
                  </span>
                  <span>Strings · {system.strings}</span>
                  <span>Commissioned · {stampDate(system.commissionedAt)}</span>
                  <span>Telemetry · {relativeTime(system.lastUpdated)}</span>
                </TooltipContent>
              </Tooltip>
            }
          >
            {systemName(system)}
          </DetailSidebarLabel>
        </div>
      }
      entries={NAV_ENTRIES(system.id)}
    />

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* The system's name over the page, drawn at every width — which is also what
          covers the phone, where the rail is gone and this is the only thing left
          saying what you are looking at. */}
      <h1 className="shrink-0 truncate px-4 pt-4 pb-2 text-base font-medium text-primary">
        {systemName(system)}
      </h1>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  </div>
);
