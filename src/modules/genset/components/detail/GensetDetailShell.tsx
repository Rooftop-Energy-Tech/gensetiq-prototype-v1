import {Link, Outlet} from '@tanstack/react-router';
import {InfoIcon, MapPinIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {fuelLevel, relativeTime, stampDate} from '@/lib/format';
import {currentInstallation} from '../../data/installations';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';

/**
 * The eight tabs across the top of a genset.
 *
 * Real routes rather than local state, for the same reason the fleet screen keeps
 * its view in the URL — a tab is a place, and `/gensets/brf9540/runs` should be
 * linkable and survive a reload.
 *
 * `Service` sits after `Runs` because it reads the run log: a genset falls due on
 * the hours it has turned, so the tab that says *how much it has run* comes
 * before the one that says *what that means for its next service*.
 *
 * It is deliberately not folded into `Equipment`, whose placeholder text
 * mentions a service schedule. Equipment is nameplate data — what is fitted, what
 * it is rated at — and it does not change. Servicing is a clock, a log and an
 * action, which is a different kind of page.
 */
const TABS = [
  {label: 'Home', to: '/gensets/$gensetId'},
  {label: 'Analysis', to: '/gensets/$gensetId/analysis'},
  {label: 'Runs', to: '/gensets/$gensetId/runs'},
  // The one log a set accumulates beyond its runs: the fuel bought for it. It
  // sits beside Runs because the two reconcile against each other — a delivery
  // lands on the fuel chart the moment it is logged.
  //
  // There is no Deployments tab on this estate. A set here is bolted to a
  // plinth beside the tower it feeds and its posting is its installation: one
  // record, opened at commissioning and still open. A tab whose whole content
  // is a single row that never changes is a tab that teaches a reader to stop
  // opening tabs, so the fact moved to the header tooltip instead.
  {label: 'Refuel', to: '/gensets/$gensetId/refuel'},
  {label: 'Service', to: '/gensets/$gensetId/service'},
  {label: 'Alarms', to: '/gensets/$gensetId/alarms'},
  {label: 'Equipment', to: '/gensets/$gensetId/equipment'},
  {label: 'Settings', to: '/gensets/$gensetId/settings'},
] as const;

/**
 * Everything one genset's pages share: the title row and the tab strip. Each tab
 * renders into the `<Outlet />` below it.
 *
 * There is no separate connectivity badge here. Whether the panel is talking to
 * us is not a second fact alongside run state — it *is* a run state, `OFFLINE`,
 * and the run-state hero in band 1 already says it. A header badge reading
 * `Online` beside a hero reading `Idle` invited the reader to look for a
 * distinction the machine does not report.
 */
export const GensetDetailShell = ({genset}: {genset: Genset}) => {
  const installation = currentInstallation(genset.id);

  return (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2">
      {/* Stacked below `md`. Side by side, the name gives up most of its width to the
          placename and truncates to `BRF9540 | C…` — on a phone the tag is the one
          thing on this page that must survive, and there is a whole line for it. */}
      <div className="flex min-w-0 flex-col items-start gap-1 md:flex-row md:items-center md:gap-6">
        <h1 className="max-w-full truncate text-base font-medium text-primary">
          {gensetName(genset)}
        </h1>

        <div className="flex shrink-0 items-center gap-5">
          <span className="flex items-center gap-2 text-sm text-secondary">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {genset.locationLabel}
          </span>

          {/* The design puts an info glyph here and says nothing about it. It
              carries the fields the header hasn't room for, rather than
              duplicating the ones it has. */}
          <Tooltip>
            <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
              <InfoIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">Asset details</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col gap-1">
              <span>Asset tag · {genset.tag}</span>
              <span>Model · {genset.model}</span>
              <span>Tank · {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}</span>
              {/* Where the Deployments tab used to be. On this estate a set has one
                  installation and it is years old, so the fact belongs in the line
                  of nameplate data it now sits in rather than behind a tab of its
                  own. It is here and not on the site page because it is a fact about
                  the *machine*: the plinth outlives whatever is bolted to it. */}
              {installation !== undefined && (
                <span>
                  Commissioned · {stampDate(installation.startedAt)} by{' '}
                  {installation.installer}
                </span>
              )}
              <span>Telemetry · {relativeTime(genset.lastUpdated)}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Hidden at phone width, where `Home` is the only tab with a mobile layout.
          The rest are desktop-only in this prototype, and the same rule the bottom
          nav follows applies inside a page: offer no door the app cannot open
          properly. The routes still resolve if one is typed. */}
      <div className="hidden items-center gap-5 md:flex">
        <nav
          aria-label="Genset sections"
          className="flex h-9 items-center gap-0 rounded-lg bg-element p-[3px]"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              params={{gensetId: genset.id}}
              // `exact` on Home only: without it the Home tab stays active on
              // every child route, since `/gensets/x` prefixes all of them.
              // `includeSearch: false` because the home page carries the alert
              // filter in its query string — with the default, selecting a chip
              // would un-highlight the tab you are standing on.
              activeOptions={{exact: tab.to === '/gensets/$gensetId', includeSearch: false}}
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
};
