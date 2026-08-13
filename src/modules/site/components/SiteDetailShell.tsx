import {Link, Outlet} from '@tanstack/react-router';
import {InfoIcon, MapPinIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {SITE_KIND_LABEL} from '../data/sites';
import type {SiteSummary} from '../data/sites';

/**
 * The five tabs the design's frame draws across the top of a site.
 *
 * Real routes rather than local state, for the same reason the genset section's
 * are: a tab is a place, and `/sites/telco-001/alarms` should be linkable and
 * survive a reload. Only `Home` is designed; the other four are labelled
 * placeholders so the strip isn't four dead buttons.
 *
 * `Contract` is the one tab here with no counterpart on a genset, and that is the
 * clearest signal in the design that a site is a commercial object as well as an
 * electrical one — a genset has runs and alarms, but only a *site* has an SLA.
 */
const TABS = [
  {label: 'Home', to: '/sites/$siteId'},
  {label: 'Runs', to: '/sites/$siteId/runs'},
  {label: 'Alarms', to: '/sites/$siteId/alarms'},
  {label: 'Contract', to: '/sites/$siteId/contract'},
  {label: 'Settings', to: '/sites/$siteId/settings'},
] as const;

/**
 * Everything one site's pages share: the name, its placename, the details tooltip
 * and the tab strip. Each tab renders into the `<Outlet />` below it.
 *
 * Structurally a twin of `GensetDetailShell`, deliberately — a reader moving
 * between a site and one of its gensets should find the header in the same place
 * saying the same kinds of thing. The two are not factored into one component
 * because the halves that differ are the halves that matter: different tab sets,
 * and different facts behind the info glyph.
 */
export const SiteDetailShell = ({summary}: {summary: SiteSummary}) => {
  const {site, gensets} = summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2">
        <div className="flex min-w-0 items-center gap-6">
          <h1 className="truncate text-base font-medium text-primary">{site.name}</h1>

          <div className="flex shrink-0 items-center gap-5">
            <span className="flex items-center gap-2 text-sm text-secondary">
              <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
              {site.locationLabel}
            </span>

            {/* The design puts an info glyph here and says nothing about it. It
                carries what the header has no room for — and what a site is *for*
                is the first of those, since the load's tolerance for an outage is
                the thing that makes the rest of the page urgent or routine. */}
            <Tooltip>
              <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
                <InfoIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">Site details</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-1">
                <span>Load · {SITE_KIND_LABEL[site.kind]}</span>
                <span>
                  Gensets · {gensets.length} installed, {summary.onlineCount} reporting
                </span>
                <span>Installed capacity · {amount(summary.ratedKw, 'kW')}</span>
                <span>
                  Fuel on site ·{' '}
                  {fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <nav
          aria-label="Site sections"
          className="flex h-9 items-center gap-0 rounded-lg bg-element p-[3px]"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              params={{siteId: site.id}}
              // `exact` on Home only: without it Home stays active on every child
              // route, since `/sites/x` prefixes all of them.
              activeOptions={{exact: tab.to === '/sites/$siteId', includeSearch: false}}
              className="flex h-full items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:text-primary data-[status=active]:border-subtle data-[status=active]:bg-highlight data-[status=active]:text-primary"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};
