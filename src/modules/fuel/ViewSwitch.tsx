import {HistoryIcon, WarehouseIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {DEPOTS, reconcile, varianceSeverity} from './data/depotTank';
import type {FuelView} from './index';
import {figure} from './format';

/**
 * The switch between the Fuel tabs, as cards rather than a small pill
 * (Jeff, 2026-09-29). The pill was easy to miss, and read as a filter on one page
 * rather than a choice between two. A card also says, before it is clicked, whether
 * that half has anything wrong in the period, so the reader knows which to open.
 *
 * They are the switch on a phone only. From `md` up it is the rail in `FuelNav`,
 * which names the tabs and nothing more: it read these status lines, as a dot and a
 * tooltip, until it took the Service rail's look (Jeff, 2026-10-05).
 *
 * The status line follows the page's rule: it names a problem when there is one and
 * otherwise only counts what is there, with no all-clear.
 */

type Status = {
  text: string;
  tone: 'critical' | 'warning' | undefined;
};

const depotStatus = (from: number, to: number): Status => {
  const verdicts = DEPOTS.map((depot) => {
    const movement = reconcile(depot.id, from, to);
    return varianceSeverity(movement.varianceLitres);
  });
  const short = verdicts.filter((v) => v !== undefined).length;
  const parts = [
    `${figure(DEPOTS.length)} ${DEPOTS.length === 1 ? 'depot' : 'depots'}`,
    ...(short > 0 ? [`${figure(short)} with fuel missing in transit`] : []),
  ];
  return {
    text: parts.join(' · '),
    tone: short > 0 ? 'critical' : undefined,
  };
};

/**
 * No verdict of its own: a fill is a fact, and the depot's gap is the depot
 * card's to say. So this only names the tab.
 */
const deliveriesStatus = (): Status => ({text: 'Every fill, with its supplying depot', tone: undefined});

const DOT: Record<'critical' | 'warning', string> = {
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
      icon={HistoryIcon}
      title="History"
      status={deliveriesStatus()}
      selected={value === 'history'}
      onSelect={() => onChange('history')}
    />
  </div>
);
