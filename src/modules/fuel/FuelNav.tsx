import {ChevronDownIcon, TruckIcon, WarehouseIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useState} from 'react';
import type {ReactNode} from 'react';

import {DetailSidebarLabel, LABEL, rowClassName} from '@/components/global/DetailSidebar';
import {cn} from '@/lib/utils';
import {DOT, depotStatus, truckStatus} from './ViewSwitch';
import type {Status} from './ViewSwitch';
import type {FuelView} from './index';
import {DEPOTS, reconcile, varianceSeverity} from './data/depotTank';
import {TRUCKS} from './data/trucks';

/** One link in a group: the tab it shows. */
type Item = {label: string; view: FuelView};

/** A heading and its links. The heading is a label, not a control. */
type Group = {label: string; icon: LucideIcon; status: Status; items: ReadonlyArray<Item>};

/**
 * Depots and Trucks head the rail as labels, each over the links that are its
 * substitute (Jeff, 2026-09-30): the depot tanks and the deliveries under Depots,
 * the register and the log under Trucks, each its own tab. Trucks only where the
 * estate runs any.
 */
const groups = (from: number, to: number): ReadonlyArray<Group> => [
  {
    label: 'Depots',
    icon: WarehouseIcon,
    status: depotStatus(from, to),
    items: [
      {label: 'Depot tanks', view: 'depots'},
      {label: 'Genset fills', view: 'deliveries'},
    ],
  },
  ...(TRUCKS.length > 0
    ? [
        {
          label: 'Trucks',
          icon: TruckIcon,
          status: truckStatus(from, to),
          items: [
            {label: 'Trucks and map', view: 'trucks' as const},
            {label: 'Truck log', view: 'truck-log' as const},
          ],
        },
      ]
    : []),
];

const Dot = ({tone}: {tone: Status['tone']}) =>
  tone === undefined ? null : <span className={cn('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />;

type RailProps = {
  value: FuelView;
  onChange: (next: FuelView) => void;
  from: number;
  to: number;
  /**
   * The depot whose own page the rail sits on, if any. That depot's link is the
   * one marked, and *Depot tanks* then leads back up instead of doing nothing.
   */
  depotId?: string;
};

/** A depot's dot: red for unlogged fuel, amber for a sensor fault. */
const depotTone = (depotId: string, from: number, to: number): Status['tone'] => {
  const movement = reconcile(depotId, from, to);
  const verdict = varianceSeverity(movement.outLitres, movement.varianceLitres);
  return verdict === undefined ? undefined : verdict.kind === 'shortfall' ? 'critical' : 'warning';
};

const Rail = ({children}: {children: ReactNode}) => (
  <aside className="hidden w-[240px] shrink-0 flex-col overflow-y-auto border-r border-subtle md:flex">
    {children}
  </aside>
);

const RailHeader = () => (
  <div className="shrink-0 p-2">
    <DetailSidebarLabel>Fuel</DetailSidebarLabel>
  </div>
);

/**
 * The Fuel tabs from `md` up: a second rail on the left, the 240px column a
 * genset's sections use. **Depots** and **Trucks** are headings that never switch
 * the page; the links under them do (Jeff, 2026-09-30). They do not fold either:
 * the links are always shown (Jeff, 2026-09-30, after a fold with a chevron).
 * A heading carries its group's dot when something is wrong in the period, with
 * the status line as its tooltip and screen-reader text.
 *
 * *Depot tanks* lists each yard under it, one link to each depot's own page, and
 * a chevron on its row folds the list away.
 *
 * The link for the tab showing is marked active. *Truck log* was a section of the
 * Trucks tab that its link scrolled to, until it became a tab of its own (Jeff,
 * 2026-09-30) as Genset fills is beside Depot tanks.
 *
 * Buttons rather than the rail's links: the tabs are one route told apart by
 * `?view=`, and a link's active match either ignores the query string or lets the
 * bare `/fuel` light on every tab. Phones get cards (`ViewSwitch`), since no page
 * has a second rail there.
 *
 * Before this the rail was option 5 of six tried side by side on 2026-09-29, where
 * each tab's row was itself the link and opened onto its sections. The other five
 * were a status line under each label, rows nested under Fuel in the main sidebar,
 * a count on each row, an icon-only strip, and the cards alone.
 */
export const FuelNav = ({value, onChange, from, to, depotId}: RailProps) => {
  const below = depotId !== undefined;
  // The depot list starts open; its chevron folds it away.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <Rail>
      <RailHeader />
      <nav aria-label="Fuel sections" className="flex flex-col gap-3 p-2">
        {groups(from, to).map(({label, icon: Icon, status, items}) => (
          <div key={label} role="group" aria-labelledby={`fuel-nav-${label}`} className="flex flex-col gap-0.5">
            {/* A label, not a control: it never switches the page, and it no
                longer folds its links either (Jeff, 2026-09-30) — the links are
                always there. */}
            <div
              id={`fuel-nav-${label}`}
              title={status.text}
              className="flex h-7 items-center gap-2 px-2 text-xs font-medium tracking-wide text-tertiary uppercase"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left">{label}</span>
              <span className="sr-only">{`, ${status.text}`}</span>
              <Dot tone={status.tone} />
            </div>
            {items.map((item) => {
              // On a depot's page the depot's own link is marked instead.
              const active = !below && item.view === value;
              const hasDepots = item.view === 'depots';
              const depotsKey = `${label}/${item.label}`;
              const depotsOpen = !closed.has(depotsKey);
              return (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (below || item.view !== value) onChange(item.view);
                      }}
                      aria-current={active ? 'page' : undefined}
                      data-status={active ? 'active' : undefined}
                      className={cn(rowClassName, 'h-8 cursor-pointer pl-7 text-left', hasDepots && 'pr-8')}
                    >
                      <span className={cn(LABEL, 'min-w-0 flex-1 truncate')}>{item.label}</span>
                    </button>
                    {/* The link opens the tab; its chevron, a separate button,
                        folds the depot list under it (Jeff, 2026-09-30). */}
                    {hasDepots && (
                      <button
                        type="button"
                        onClick={() => toggle(depotsKey)}
                        aria-expanded={depotsOpen}
                        aria-label={depotsOpen ? 'Hide depots' : 'Show depots'}
                        className="absolute inset-y-0 right-1 my-auto flex size-6 items-center justify-center rounded-md text-tertiary outline-none hover:bg-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        <ChevronDownIcon
                          className={cn('size-3.5 transition-transform', !depotsOpen && '-rotate-90')}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>
                  {/* Each yard under the tanks, straight to its own page (Jeff,
                      2026-09-30), with its card's verdict as a dot. Real links:
                      these are separate routes, so the active match is exact. */}
                  {hasDepots &&
                    depotsOpen &&
                    DEPOTS.map((depot) => {
                      const current = depot.id === depotId;
                      return (
                        <Link
                          key={depot.id}
                          to="/fuel/depots/$depotId"
                          params={{depotId: depot.id}}
                          aria-current={current ? 'page' : undefined}
                          data-status={current ? 'active' : undefined}
                          className={cn(rowClassName, 'h-7 pl-11 text-[13px]')}
                        >
                          <span className="min-w-0 flex-1 truncate">{depot.name}</span>
                          <Dot tone={depotTone(depot.id, from, to)} />
                        </Link>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </Rail>
  );
};
