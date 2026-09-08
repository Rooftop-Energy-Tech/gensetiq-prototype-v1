import {Outlet} from '@tanstack/react-router';
import {BellIcon, CircuitBoardIcon, InfoIcon, ServerIcon, SettingsIcon} from 'lucide-react';

import {
  DetailSidebar,
  DetailSidebarBackLink,
  DetailSidebarLabel,
} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount} from '@/lib/format';
import {cabinetName} from '../../types/cabinet.type';
import type {SubrackCabinet} from '../../types/cabinet.type';

/**
 * The cabinet's four sections, against the other three assets' six or seven.
 *
 * The two that are missing are missing because the **model** is, which is the rule
 * `BankHome` states for its own bands: a section exists here when there is something
 * true to put in it, not because the asset beside it has one.
 *
 * **No `Analysis`.** That tab is a reading picker over a time series, and there is no
 * series anywhere in this app for a rectifier shelf's output or an enclosure's
 * temperature — `siteTrend` models generation, charge and load for a site. Offering
 * the tab and drawing the site's load in it would be the site's chart with a
 * cabinet's title on.
 *
 * **No `Service`.** A rectifier is swapped, not serviced. The bank and the array have
 * a service interval because a wash and a capacity test are scheduled work; a shelf
 * module either converts or is replaced, and nothing in the model records a swap.
 *
 * `Devices` is the one section here with more content than its counterparts on the
 * other two rails — both of those are placeholders, and this one is the shelf.
 */
const NAV_ENTRIES = (cabinetId: string): Array<DetailNavEntry> => {
  const params = {cabinetId};

  return [
    // `end` on the landing row alone: `/cabinet/x` prefixes every route below it.
    {label: 'Cabinet', icon: ServerIcon, to: '/cabinet/$cabinetId', params, end: true},
    {label: 'Alarms', icon: BellIcon, to: '/cabinet/$cabinetId/alarms', params},
    {label: 'Devices', icon: CircuitBoardIcon, to: '/cabinet/$cabinetId/equipment', params},
    {label: 'Settings', icon: SettingsIcon, to: '/cabinet/$cabinetId/settings', params},
  ];
};

/**
 * Everything one cabinet's pages share: the rail on the left, an `<Outlet />` beside
 * it — the fourth of four, and identical in construction to the other three.
 *
 * The way back is `DetailSidebarBackLink`, the same row a genset, a system and a
 * bank carry, above the sections rather than over the header. A cabinet cannot be
 * anywhere but at a site — it *is* the DC plant there — so there is always somewhere
 * to go back to and, unlike a genset, no depot branch.
 *
 * The info glyph carries what has no room in a 240px column and no band of its own:
 * the shelf's make-up, and the monitoring unit that reports every figure on these
 * pages. That last one belongs in the tooltip rather than on the page because it is
 * the fact a reader wants *before* trusting anything else here and never again.
 */
export const CabinetDetailShell = ({cabinet}: {cabinet: SubrackCabinet}) => (
  <div className="flex min-h-0 flex-1 overflow-hidden">
    <DetailSidebar
      ariaLabel="Cabinet sections"
      backLink={<DetailSidebarBackLink siteId={cabinet.siteId} name={cabinet.siteName} />}
      header={
        <DetailSidebarLabel
          aside={
            <Tooltip>
              <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
                <InfoIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">Cabinet details</span>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col gap-1">
                <span>
                  Rectifiers · {cabinet.rectifiers} × {amount(cabinet.rectifierKw, 'kW')}
                </span>
                <span>Solar units · {cabinet.ssus}</span>
                <span>Capacity · {amount(cabinet.capacityKw, 'kW')} AC→DC</span>
                {/* Who is reporting, or — where nobody is — what the figures above
                    are instead. The tooltip is the rail's whole account of the
                    cabinet, so it must not leave a sized shelf looking read. */}
                <span>
                  {cabinet.deviceName === null
                    ? 'Sized from the plant · no monitoring unit fitted'
                    : `Reported by · ${cabinet.deviceName}, slave ${cabinet.slaveId}`}
                </span>
              </TooltipContent>
            </Tooltip>
          }
        >
          {cabinetName(cabinet)}
        </DetailSidebarLabel>
      }
      entries={NAV_ENTRIES(cabinet.id)}
    />

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Drawn at every width, which is also what covers the phone: the rail is
          gone there and this is the only thing left saying what you are reading. */}
      <h1 className="shrink-0 truncate px-4 pt-4 pb-2 text-base font-medium text-primary">
        {cabinetName(cabinet)}
      </h1>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  </div>
);
