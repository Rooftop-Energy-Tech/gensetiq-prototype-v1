import {Outlet} from '@tanstack/react-router';
import {BellIcon, BoomBoxIcon, ChartLineIcon, CircuitBoardIcon, InfoIcon, PlayIcon, SettingsIcon, TruckIcon, WrenchIcon} from 'lucide-react';

import {
  DetailSidebar,
  DetailSidebarBackLink,
  DetailSidebarLabel,
} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {fuelLevel, relativeTime, stampDate} from '@/lib/format';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {openDeployment} from '../../data/deployments';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';

/**
 * The seven sections of a genset, as rows in a rail rather than tabs in a strip.
 *
 * The order is unchanged, and so is the reasoning behind it: `Service` reads the
 * run log, so the section that says *how much it has run* comes before the one
 * that says *what that means for its next service*. There is no Deployments section —
 * a set on this estate is bolted to a plinth beside the tower it feeds and its
 * posting is one record, opened at commissioning and still open, so the fact lives
 * in the header's tooltip instead.
 *
 * Two labels differ from the routes behind them. `Genset` is the home route, named
 * for its subject the way the site rail's first row is named `Site` — "Home" says
 * nothing in a column that is already headed by the machine's tag. `Devices` is
 * the design's word for `/equipment`, and nothing else in the app calls that page
 * anything, so there is no second name to keep in step.
 */
const NAV_ENTRIES = (gensetId: string): Array<DetailNavEntry> => {
  const params = {gensetId};

  return [
    // `end` on the landing row alone: `/gensets/x` prefixes all six below it.
    {label: 'Genset', icon: BoomBoxIcon, to: '/gensets/$gensetId', params, end: true},
    {label: 'Analysis', icon: ChartLineIcon, to: '/gensets/$gensetId/analysis', params},
    {label: 'Runs', icon: PlayIcon, to: '/gensets/$gensetId/runs', params},
    // After Runs, because a posting is the window the runs inside it are read over —
    // see `deployment.type.ts` on why both exist.
    {label: 'Deployments', icon: TruckIcon, to: '/gensets/$gensetId/deployments', params},
    {label: 'Service', icon: WrenchIcon, to: '/gensets/$gensetId/service', params},
    {label: 'Alarms', icon: BellIcon, to: '/gensets/$gensetId/alarms', params},
    {label: 'Devices', icon: CircuitBoardIcon, to: '/gensets/$gensetId/equipment', params},
    {label: 'Settings', icon: SettingsIcon, to: '/gensets/$gensetId/settings', params},
  ];
};

/**
 * Everything one genset's pages share: the rail on the left, an `<Outlet />`
 * beside it.
 *
 * ## The way back
 *
 * `DetailSidebarBackLink` directly above the sections, which is the design's and is
 * the piece that makes the whole arrangement work — see that component for why it
 * sits there and not over the header. It returns to `/sites/<id>`, which restores
 * the site's rail; that is the whole of the "back to the site" gesture, since the
 * two rails are just what the two routes render.
 *
 * ## When there is no site
 *
 * A set can sit at the depot (`siteId: null`), and then there is no site to go back
 * to. The row is dropped rather than drawn dead, and the rail opens straight onto
 * the machine's sections. This is also what a reader arriving from
 * `/gensets` at an undeployed set sees, which is correct: they did not come from a
 * site, so there is nothing to return to.
 */
export const GensetDetailShell = ({genset}: {genset: Genset}) => {
  const deployment = openDeployment(genset.id);
  const site = genset.siteId === null ? undefined : siteSeed(genset.siteId);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DetailSidebar
        ariaLabel="Genset sections"
        backLink={
          site === undefined ? undefined : (
            <DetailSidebarBackLink siteId={site.id} name={site.name} />
          )
        }
        header={
          /* What the rows below are about. The info glyph carries the nameplate
             data the old header tooltip held — the fields that have no room in a
             240px column and no band of their own on any of the eight pages. */
          <DetailSidebarLabel
            aside={
              <Tooltip>
                <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
                  <InfoIcon className="size-4" aria-hidden="true" />
                  <span className="sr-only">Asset details</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <span>Asset tag · {genset.tag}</span>
                  <span>Model · {genset.model}</span>
                  <span>Location · {genset.locationLabel}</span>
                  <span>
                    Tank · {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
                  </span>
                  {deployment !== undefined && (
                    <span>
                      Posted · {stampDate(deployment.startedAt)} ·{' '}
                      {deployment.lorryPlate}
                    </span>
                  )}
                  <span>Telemetry · {relativeTime(genset.lastUpdated)}</span>
                </TooltipContent>
              </Tooltip>
            }
          >
            {gensetName(genset)}
          </DetailSidebarLabel>
        }
        entries={NAV_ENTRIES(genset.id)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* The machine's tag, over the page. It is in the rail as well, and the
            design draws both — the rail's copy is a caption on eight rows, and
            this one titles what you are actually reading. Without it every one of
            the eight pages would open on a figure with nothing naming it. */}
        <h1 className="shrink-0 truncate px-4 pt-4 pb-2 text-base font-medium text-primary">
          {gensetName(genset)}
        </h1>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
