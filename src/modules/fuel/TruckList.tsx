import {ChevronRightIcon, TriangleAlertIcon} from 'lucide-react';

import {relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {missingIn, reconcileTruck, truckEvents, truckLevel, truckPosition} from './data/truckRuns';
import type {RefuelTruck} from './data/trucks';
import {amount} from './format';

/**
 * The trucks as a compact list, one line each, so four trucks read at a glance
 * (Jeff, 2026-09-29). Each row once drew the truck's fuel as a chain of four
 * readings, which made every row a small report nobody could read at a glance. A
 * row now keeps only what tells a reader which truck to open: its tank, where it
 * is, what it delivered, and how much fuel went missing.
 */

/**
 * Truck, tank, where, delivered, missing. Sized by the list's own width rather than
 * the window's, because on a wide screen it shares the row with the map: a
 * container query, so the columns drop when the list is narrow wherever it sits.
 */
const COLUMNS =
  'grid-cols-[minmax(0,1fr)_auto_16px] @xl:grid-cols-[minmax(0,1.2fr)_104px_minmax(0,1.4fr)_88px_72px_16px]';

export const TankBar = ({fraction, className}: {fraction: number; className?: string}) => (
  <div className={cn('h-1.5 overflow-hidden rounded-full bg-inset', className)} aria-hidden="true">
    <div className="h-full bg-fuel" style={{width: `${Math.min(1, Math.max(0, fraction)) * 100}%`}} />
  </div>
);

/** `On the road · Putrajaya · just now`, or `Parked at Butterworth depot`. */
export const whereNow = (truck: RefuelTruck): string => {
  const position = truckPosition(truck);
  if (position.parked) return `Parked at ${position.place}`;
  const place = `On the road · ${position.place}`;
  return position.at === undefined ? place : `${place} · ${relativeTime(new Date(position.at).toISOString())}`;
};

const TruckRow = ({truck, from, to, onOpen}: {truck: RefuelTruck; from: number; to: number; onOpen: () => void}) => {
  const fraction = truck.capacityLitres > 0 ? truckLevel(truck) / truck.capacityLitres : 0;
  const active = truckEvents(truck.id).some((event) => event.at >= from && event.at <= to);
  const delivered = reconcileTruck(truck.id, from, to).arrivedLitres;
  const missing = missingIn(from, to, truck.id).reduce((sum, m) => sum + m.litres, 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'grid w-full items-center gap-x-4 px-4 py-3 text-left text-[13px] transition-colors outline-none hover:bg-highlight focus-visible:bg-highlight',
        COLUMNS,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 font-semibold text-primary">
          {truck.plate}
          {missing > 0 && (
            <span className="inline-flex items-center gap-1 text-severity-critical tabular-nums @xl:hidden">
              <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
              {amount(Math.round(missing), 'L')}
            </span>
          )}
        </span>
        <span className="truncate text-secondary">{`${truck.drivers.join(', ')} · ${truck.areaLabel}`}</span>
        {/* When the list is narrow the where column is gone, so its line rides under
            the name. */}
        <span className="truncate text-tertiary @xl:hidden">{whereNow(truck)}</span>
      </span>
      <span className="flex items-center gap-2 justify-self-end @xl:justify-self-stretch">
        <TankBar fraction={fraction} className="hidden w-12 @xl:block" />
        <span className="text-secondary tabular-nums">{`${Math.round(fraction * 100)}%`}</span>
      </span>
      <span className="hidden truncate text-secondary @xl:block">{whereNow(truck)}</span>
      <span className="hidden text-right text-primary tabular-nums @xl:block">
        {active ? amount(delivered, 'L') : <span className="text-tertiary">—</span>}
      </span>
      <span className="hidden justify-self-end tabular-nums @xl:block">
        {missing > 0 && (
          <span className="font-semibold text-severity-critical">{amount(Math.round(missing), 'L')}</span>
        )}
      </span>
      <ChevronRightIcon className="size-4 text-tertiary" aria-hidden="true" />
    </button>
  );
};

export const TruckList = ({
  trucks,
  from,
  to,
  onOpen,
}: {
  trucks: ReadonlyArray<RefuelTruck>;
  from: number;
  to: number;
  onOpen: (truckId: string) => void;
}) => (
  <div className="@container overflow-hidden rounded-md border border-subtle bg-element">
    <div
      className={cn(
        'hidden gap-x-4 border-b border-subtle px-4 py-2 text-xs font-medium text-secondary @xl:grid',
        COLUMNS,
      )}
    >
      <span>Number plate</span>
      <span>Tank</span>
      <span>Location</span>
      <span className="text-right">Delivered</span>
      <span className="text-right">Missing</span>
      <span />
    </div>
    <div className="divide-y divide-subtle">
      {trucks.map((truck) => (
        <TruckRow key={truck.id} truck={truck} from={from} to={to} onOpen={() => onOpen(truck.id)} />
      ))}
    </div>
  </div>
);
