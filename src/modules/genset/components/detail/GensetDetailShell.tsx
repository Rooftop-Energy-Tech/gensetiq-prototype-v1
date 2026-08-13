import {Link, Outlet} from '@tanstack/react-router';
import {CircleIcon, InfoIcon, MapPinIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {age, fuelLevel, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';

/**
 * The six tabs across the top of a genset.
 *
 * Real routes rather than local state, for the same reason the fleet screen keeps
 * its view in the URL — a tab is a place, and `/gensets/brf9540/runs` should be
 * linkable and survive a reload. Only `Home` is designed; the other five are
 * labelled placeholders so the tab strip isn't five dead buttons.
 */
const TABS = [
  {label: 'Home', to: '/gensets/$gensetId'},
  {label: 'Analysis', to: '/gensets/$gensetId/analysis'},
  {label: 'Runs', to: '/gensets/$gensetId/runs'},
  {label: 'Alarms', to: '/gensets/$gensetId/alarms'},
  {label: 'Equipment', to: '/gensets/$gensetId/equipment'},
  {label: 'Settings', to: '/gensets/$gensetId/settings'},
] as const;

/**
 * Everything one genset's pages share: the title row, the connectivity badge and
 * the tab strip. Each tab renders into the `<Outlet />` below it.
 *
 * The connectivity badge is separate from the run-state hero on purpose, and the
 * two answer different questions. Run state is what the machine is *doing*;
 * online is whether we are hearing from it. A running genset whose modem has
 * dropped is the most dangerous combination on this page, and one badge cannot
 * say it.
 */
export const GensetDetailShell = ({genset, online}: {genset: Genset; online: boolean}) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2">
      <div className="flex min-w-0 items-center gap-6">
        <h1 className="truncate text-base font-medium text-primary">{gensetName(genset)}</h1>

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
              <span>Telemetry · {relativeTime(genset.lastUpdated)}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <Badge variant="secondary" className="whitespace-pre">
          <CircleIcon
            className={cn(online ? 'text-severity-ok' : 'text-status-offline')}
            aria-hidden="true"
          />
          {online ? 'Online' : 'Offline'}
          {'  |  '}
          {age(genset.lastUpdated)}
        </Badge>

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
