import {Outlet} from '@tanstack/react-router';
import {BellIcon, BoomBoxIcon, ChartLineIcon, CircuitBoardIcon, InfoIcon, MapPinIcon, SettingsIcon, TruckIcon, WrenchIcon} from 'lucide-react';

import {
  DetailSidebar,
  DetailSidebarLabel,
} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {fuelLevel, relativeTime, stampDate} from '@/lib/format';
import {activePosting} from '@/modules/deployment/data/store';
import {gensetName} from '../../types/genset.type';
import {gensetDetail} from '../../data/detail';
import {ALERT_SEVERITIES} from '../../types/alert.type';
import type {AlertSeverity} from '../../types/alert.type';
import {RunStateSummary} from './RunStateSummary';
import type {Genset} from '../../types/genset.type';

/**
 * The seven sections of a genset, as rows in a rail rather than tabs in a strip.
 *
 * The order is unchanged, and so is the reasoning behind it: `Service` reads the
 * run log, so the section that says *how much it has run* comes before the one
 * that says *what that means for its next service*. `Deployments` (at `/runs`) is
 * the jobs the set has stood on and the runs inside them; there was no such section
 * while a set was bolted to one plinth for life.
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
    // `Deployments`, at `/runs`. The two tabs merged on 2026-09-22 and the survivor
    // took the other's name: a reader thinks in jobs, and a run is what the engine
    // did inside one. The URL keeps `/runs` because every link into it carries a
    // range or a posting in its query string, and renaming the path would break
    // those for the sake of a word nobody types.
    {label: 'Deployments', icon: TruckIcon, to: '/gensets/$gensetId/runs', params},
    // After Runs, because a posting is the window the runs inside it are read over —
    // see `deployment.type.ts` on why both exist.
    {label: 'Service', icon: WrenchIcon, to: '/gensets/$gensetId/service', params},
    {label: 'Alarms', icon: BellIcon, to: '/gensets/$gensetId/alarms', params},
    // `Equipment`, the page's own title; the design's rail says `Devices` (2026-10-05).
    {label: 'Equipment', icon: CircuitBoardIcon, to: '/gensets/$gensetId/equipment', params},
    {label: 'Settings', icon: SettingsIcon, to: '/gensets/$gensetId/settings', params},
  ];
};

/**
 * Everything one genset's pages share: the rail on the left, an `<Outlet />`
 * beside it.
 *
 * ## No way back in the rail
 *
 * The rail had a back row to `/sites/<id>` while there were site pages. They went
 * on 2026-09-22, and the rail now opens straight onto the machine's sections; the
 * breadcrumb is the way back to the register.
 */
export const GensetDetailShell = ({genset}: {genset: Genset}) => {
  // The job this machine is standing on, if it is standing on one. A planned
  // commitment is not it: the machine has not gone anywhere yet.
  const posting = activePosting(genset.id, Date.now());
  // For the load beside the title. `undefined` is possible in principle — a genset
  // with no detail row — and reads as a machine with no load rather than as zero.
  const detail = gensetDetail(genset.id);
  // The worst alarm standing on this machine, for the run pill. Read off the detail
  // row rather than `standingAlarms` because this shell wraps all seven tabs and has
  // no handling state of its own; the difference is an alarm a reader has already
  // cleared, which this still counts.
  const worstAlert = detail?.alerts.reduce<AlertSeverity | undefined>(
    (worst, alert) =>
      worst === undefined ||
      ALERT_SEVERITIES.indexOf(alert.severity) < ALERT_SEVERITIES.indexOf(worst)
        ? alert.severity
        : worst,
    undefined,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DetailSidebar
        ariaLabel="Genset sections"
        header={
          /* What the rows below are about. The info glyph carries the nameplate
             data the old header tooltip held — the fields that have no room in a
             240px column and no band of their own on any of the seven pages. */
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
                  <span>Address · {genset.address}</span>
                  <span>
                    Tank · {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
                  </span>
                  {posting !== undefined && (
                    <span>
                      On {posting.deployment.reference} ·{' '}
                      {stampDate(posting.deployment.startsAt)}
                    </span>
                  )}
                  <span>Last updated · {relativeTime(genset.lastUpdated)}</span>
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
        {/* The machine's plate, over the page, with what it is doing beside it. It
            is in the rail as well, and the design draws both — the rail's copy is a
            caption on seven rows, and this one titles what you are actually reading.

            The run state moved up here from the home page's run band on 2026-09-22.
            Whether the engine is turning is a fact about the machine and not about
            the page, so it belongs on all seven tabs rather than on the one; a
            reader on Runs or Alarms could not see it at all before. */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 pb-2">
          <h1 className="min-w-0 truncate text-xl font-semibold text-primary">
            {gensetName(genset)}
          </h1>
          <RunStateSummary
            runState={genset.runState}
            loadKw={detail?.loadKw ?? null}
            severity={worstAlert}
          />
          {/* Where it stands, on every tab: the town, then the street address. On
              its own line so a long address wraps instead of crowding the title. */}
          <p className="flex w-full min-w-0 items-start gap-1.5 text-sm">
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            <span className="flex min-w-0 flex-col">
              <span className="text-primary">{genset.locationLabel}</span>
              <span className="text-xs text-secondary">{genset.address}</span>
            </span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
