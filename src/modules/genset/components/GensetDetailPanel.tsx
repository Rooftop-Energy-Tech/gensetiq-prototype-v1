import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, BellIcon, XIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {fuelLevelTextClass} from './fuelLevelTone';
import {SEVERITY_META} from './detail/severityMeta';
import {useGensetStandingAlarms} from '../data/alarmViews';
import {countBySeverity} from '../types/alert.type';
import type {AlarmView} from '../types/alarmView.type';
import {gensetKva, gensetLabel} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

const DetailRow = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-center gap-px">
    {/* 122px matches the design's label column, which is what keeps the
        values flush with each other. */}
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">{label}</dt>
    <dd className="flex min-w-0 flex-1 items-center truncate text-primary">{children}</dd>
  </div>
);

/**
 * How many standing rows the panel names before it hands over to the Alarms tab.
 *
 * Enough for any ordinary machine — most carry none, a sick one two or three — and
 * few enough that a set with nine monitoring-unit rows does not turn a preview into
 * the tab it is previewing. The rest are counted, and the count links to the tab.
 */
const LISTED = 4;

/**
 * The set's alarms, beside the map: the pill the register row draws, and under it
 * what is standing, by name, in the Alarms tab's own order.
 *
 * The pill is the count and the list is the answer to the question the count raises —
 * *which* warning — without leaving the map. Both read `useGensetStandingAlarms`, the
 * definition the tab reads, so the three cannot disagree about a machine. Each name
 * carries its provenance line, because `Low fuel` and a controller's `AL Fuel Level`
 * are different claims and the line is how a reader tells them apart.
 */
const AlarmRows = ({genset, standing}: {genset: Genset; standing: Array<AlarmView>}) => {
  const listed = standing.slice(0, LISTED);
  const more = standing.length - listed.length;

  return (
    <div className="flex gap-px">
      <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">Alarm</dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-2 py-1.5">
        <span className="inline-flex">
          <AlarmBadge
            counts={countBySeverity(standing)}
            to="/gensets/$gensetId/alarms"
            params={{gensetId: genset.id}}
          />
        </span>
        {listed.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {listed.map((alarm) => (
              <li key={alarm.id} className="flex min-w-0 gap-1.5">
                <BellIcon
                  className={cn(
                    'mt-0.5 size-3.5 shrink-0',
                    SEVERITY_META[alarm.severity].textClassName,
                  )}
                  aria-label={SEVERITY_META[alarm.severity].label}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-primary">{alarm.name}</span>
                  <span className="truncate text-xs text-secondary">{alarm.provenance}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {more > 0 && (
          <Link
            to="/gensets/$gensetId/alarms"
            params={{gensetId: genset.id}}
            className="text-xs text-secondary underline-offset-4 hover:text-primary hover:underline"
          >
            and {more} more on the Alarms tab
          </Link>
        )}
      </dd>
    </div>
  );
};

export const GensetDetailPanel = ({
  genset,
  className,
  onClose,
}: {
  genset: Genset | undefined;
  className?: string;
  /** Put the panel away — it clears the selection, as a click on the basemap does. */
  onClose: () => void;
}) => {
  const standing = useGensetStandingAlarms(genset);

  return (
    <aside
      aria-label="Genset details"
      className={cn(
        'flex flex-col gap-3 overflow-y-auto rounded-md border border-default bg-overlay px-4 py-3 text-sm',
        className,
      )}
    >
      {genset === undefined ? (
        <p className="my-auto px-2 text-center text-secondary">
          Select a genset to see its details.
        </p>
      ) : (
        <>
          {/* The panel is a preview, so it needs a way out of itself. Over the
              map this arrow is the *only* way into the genset's own pages — a
              map pin has nowhere to put a link, and clicking one has to keep you
              on the map or the selection is useless. */}
          <div className="flex items-center justify-between gap-2">
            {/* Bare: this panel is the register's own preview, opened from a row that
                is already under a `Number plate` column. See `gensetLabel`. */}
            <h2 className="truncate font-medium text-primary">{gensetLabel(genset)}</h2>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
                    <Link
                      to="/gensets/$gensetId"
                      params={{gensetId: genset.id}}
                      aria-label={`Open ${gensetLabel(genset)}`}
                    >
                      <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Open genset</TooltipContent>
              </Tooltip>
              {/* The deployments panel's close, beside the open arrow. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    onClick={onClose}
                    aria-label="Close panel"
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Close</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <dl className="flex flex-col">
            <DetailRow label="Status">
              <RunStateBadge runState={genset.runState} />
            </DetailRow>
            {/* Beside Status, as the register's `Alarm` column sits beside its
                `Status`: what the machine is doing, then what stands against it. */}
            <AlarmRows genset={genset} standing={standing} />
            <DetailRow label="Fuel level">
              <span className={fuelLevelTextClass(genset.fuelLitres, genset.fuelCapacityLitres)}>
                {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
              </span>
            </DetailRow>
            {/* After fuel, as the register's `Capacity` column follows `Fuel level`. */}
            <DetailRow label="Capacity">
              <span className="text-primary tabular-nums">
                {gensetKva(genset).toLocaleString('en-MY')} kVA
              </span>
            </DetailRow>
            {/* The town, then the street address under it — the short answer
                first, the one a driver needs second. */}
            <div className="flex gap-px">
              <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">
                Location
              </dt>
              <dd className="flex min-w-0 flex-1 flex-col py-1.5">
                <span className="truncate text-primary">{genset.locationLabel}</span>
                <span className="text-xs text-secondary">{genset.address}</span>
              </dd>
            </div>
            <DetailRow label="Last updated">{relativeTime(genset.lastUpdated)}</DetailRow>
          </dl>
        </>
      )}
    </aside>
  );
};
