import {DropletIcon, ScrollTextIcon, TruckIcon, WarehouseIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {DEPOTS, reconcile, varianceSeverity} from './data/depotTank';
import {missingIn} from './data/truckRuns';
import {TRUCKS} from './data/trucks';
import type {FuelView} from './index';
import {amount, figure} from './format';

/**
 * The switch between the Fuel tabs, as cards rather than a small pill
 * (Jeff, 2026-09-29). The pill was easy to miss, and read as a filter on one page
 * rather than a choice between two. A card also says, before it is clicked, whether
 * that half has anything wrong in the period, so the reader knows which to open.
 *
 * They are the switch on a phone only. From `md` up it is the rail in `FuelNav`,
 * which reads the same status lines.
 *
 * The status line follows the page's rule: it names a problem when there is one and
 * otherwise only counts what is there, with no all-clear.
 */

export type Status = {
  text: string;
  tone: 'critical' | 'warning' | undefined;
};

export const depotStatus = (from: number, to: number): Status => {
  const verdicts = DEPOTS.map((depot) => {
    const movement = reconcile(depot.id, from, to);
    return varianceSeverity(movement.outLitres, movement.varianceLitres);
  });
  const short = verdicts.filter((v) => v?.kind === 'shortfall').length;
  const check = verdicts.filter((v) => v?.kind === 'calibration').length;
  const parts = [
    `${figure(DEPOTS.length)} ${DEPOTS.length === 1 ? 'depot' : 'depots'}`,
    ...(short > 0 ? [`${figure(short)} with unlogged fuel`] : []),
    ...(check > 0 ? [`${figure(check)} sensor ${check === 1 ? 'fault' : 'faults'}`] : []),
  ];
  return {
    text: parts.join(' · '),
    tone: short > 0 ? 'critical' : check > 0 ? 'warning' : undefined,
  };
};

export const truckStatus = (from: number, to: number): Status => {
  const lost = missingIn(from, to).reduce((sum, missing) => sum + missing.litres, 0);
  const count = `${figure(TRUCKS.length)} ${TRUCKS.length === 1 ? 'truck' : 'trucks'}`;
  return lost > 0
    ? {text: `${count} · ${amount(Math.round(lost), 'L')} missing`, tone: 'critical'}
    : {text: count, tone: undefined};
};

/**
 * No verdict of its own: a fill is a fact, and the depot's gap is the depot
 * card's to say. So this only names the tab.
 */
export const deliveriesStatus = (): Status => ({text: 'Gensets filled at a depot', tone: undefined});

export const DOT: Record<'critical' | 'warning', string> = {
  critical: 'bg-severity-critical',
  warning: 'bg-severity-warning',
};

const Card = ({
  icon: Icon,
  title,
  status,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  status: Status;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={selected}
    onClick={onSelect}
    className={cn(
      'flex min-w-0 flex-1 items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-outline',
      selected ? 'border-strong bg-highlight' : 'border-subtle bg-element hover:bg-highlight',
    )}
  >
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md',
        selected ? 'bg-element text-primary' : 'bg-inset text-secondary',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-secondary')}>{title}</span>
      <span
        className={cn(
          'truncate text-xs',
          status.tone === 'critical'
            ? 'text-severity-critical'
            : status.tone === 'warning'
              ? 'text-severity-warning'
              : 'text-secondary',
        )}
      >
        {status.text}
      </span>
    </span>
    {status.tone !== undefined && (
      <span className={cn('size-2 shrink-0 rounded-full', DOT[status.tone])} aria-hidden="true" />
    )}
  </button>
);

export const ViewSwitch = ({
  value,
  onChange,
  from,
  to,
}: {
  value: FuelView;
  onChange: (next: FuelView) => void;
  from: number;
  to: number;
}) => (
  <div role="tablist" aria-label="Fuel tabs" className="flex flex-col gap-3 sm:flex-row md:hidden">
    <Card
      icon={WarehouseIcon}
      title="Depots"
      status={depotStatus(from, to)}
      selected={value === 'depots'}
      onSelect={() => onChange('depots')}
    />
    <Card
      icon={DropletIcon}
      title="Genset fills"
      status={deliveriesStatus()}
      selected={value === 'deliveries'}
      onSelect={() => onChange('deliveries')}
    />
    {TRUCKS.length > 0 && (
      <Card
        icon={TruckIcon}
        title="Trucks"
        status={truckStatus(from, to)}
        selected={value === 'trucks'}
        onSelect={() => onChange('trucks')}
      />
    )}
    {TRUCKS.length > 0 && (
      <Card
        icon={ScrollTextIcon}
        title="Truck log"
        status={{text: 'Every load, stop and short load', tone: undefined}}
        selected={value === 'truck-log'}
        onSelect={() => onChange('truck-log')}
      />
    )}
  </div>
);
