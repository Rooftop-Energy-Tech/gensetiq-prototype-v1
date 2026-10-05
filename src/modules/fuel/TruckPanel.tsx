import {Link} from '@tanstack/react-router';
import {ChevronRightIcon, TriangleAlertIcon, XIcon} from 'lucide-react';
import {Dialog as DialogPrimitive} from 'radix-ui';

import {cn} from '@/lib/utils';
import {seededGenset} from '@/modules/genset/data/fleet';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {TankBar, whereNow} from './TruckList';
import {DEPOTS} from './data/depots';
import {currentDriver, missingIn, reconcileTruck, truckEvents, truckLevel} from './data/truckRuns';
import type {TruckEvent} from './data/truckRuns';
import type {RefuelTruck} from './data/trucks';
import {amount, figure} from './format';

/**
 * One truck, opened from its row or its pin — a panel over the map from `md` up
 * (`TruckDetailPanel`), a drawer over the page on a phone (`TruckPanel`). Top to
 * bottom: how full and where, what it lost, what it did this period, and a link to
 * its log. The page's map stays whole behind it.
 */

const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
  <section className="flex flex-col gap-2 border-t border-subtle px-4 py-4">
    <h3 className="text-xs font-medium text-secondary">{title}</h3>
    {children}
  </section>
);

const Facts = ({rows}: {rows: ReadonlyArray<[string, string]>}) => (
  <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
    {rows.map(([label, value]) => (
      <div key={label} className="contents">
        <dt className="text-tertiary">{label}</dt>
        <dd className="text-primary tabular-nums">{value}</dd>
      </div>
    ))}
  </dl>
);

/** What one log entry says happened, in words. Shared with the page's log. */
export const describeEvent = (event: TruckEvent): React.ReactNode => {
  switch (event.kind) {
    case 'depot-load':
      return `Loaded at ${event.place}`;
    case 'siphon':
      return `Level fell with the meter idle, near ${event.place}`;
    case 'fill': {
      const genset = event.stop === undefined ? undefined : seededGenset(event.stop.gensetId);
      return (
        <>
          {'Filled '}
          {event.stop !== undefined && (
            <Link
              to="/gensets/$gensetId"
              params={{gensetId: event.stop.gensetId}}
              className="text-primary underline-offset-2 outline-none hover:underline focus-visible:underline"
            >
              {genset === undefined ? event.stop.gensetId : gensetLabel(genset)}
            </Link>
          )}
          <span className="text-secondary">{` at ${event.place}`}</span>
        </>
      );
    }
  }
};

/**
 * Kept to what a reader opening one truck wants at a glance (Jeff, 2026-09-30): its
 * tank and where it is, what went missing if anything did, and what it did this
 * period. The full log is a link to the Truck log tab, filtered to this truck,
 * rather than a copy of it; the truck's standing facts (drivers, the states it
 * covers, its instruments) went, since the header and the tank line already carry
 * the ones that change.
 */
const PanelBody = ({truck, from, to}: {truck: RefuelTruck; from: number; to: number}) => {
  const level = truckLevel(truck);
  const fraction = truck.capacityLitres > 0 ? level / truck.capacityLitres : 0;
  const movement = reconcileTruck(truck.id, from, to);
  const losses = missingIn(from, to, truck.id);
  const lost = losses.reduce((sum, missing) => sum + missing.litres, 0);
  const events = truckEvents(truck.id).filter((event) => event.at >= from && event.at <= to);
  const depotLoads = events.filter((event) => event.kind === 'depot-load').length;
  const stops = events.filter((event) => event.kind === 'fill');
  const gensets = new Set(stops.map((event) => event.stop?.gensetId)).size;
  const driver = currentDriver(truck);

  return (
    <>
      <section className="flex flex-col gap-2 px-4 pb-4">
        <div className="flex items-center gap-3">
          <TankBar fraction={fraction} className="h-2 flex-1" />
          <span className="text-xs text-primary tabular-nums">
            {`${amount(Math.round(level), '')} of ${amount(truck.capacityLitres, 'L')} · ${Math.round(fraction * 100)}%`}
          </span>
        </div>
        <p className="text-xs text-secondary">{whereNow(truck)}</p>
        {driver !== undefined && <p className="text-xs text-secondary">{`With ${driver}`}</p>}
      </section>

      {/* One line, not a card per short load: the short loads one by one are the
          log's. `Short load` and `missing`, not `loss` (2026-10-05): `Missing` is
          the trucks' word for fuel that did not arrive, as `Unlogged` is the depots'. */}
      {losses.length > 0 && (
        <p className="flex items-center gap-1.5 border-t border-subtle px-4 py-3 text-xs font-semibold text-severity-critical">
          <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {`${figure(losses.length)} short ${losses.length === 1 ? 'load' : 'loads'} · ${amount(Math.round(lost), 'L')} missing`}
        </p>
      )}

      <Section title="This period">
        <Facts
          rows={[
            // The truck tank's rise at the depot, not the pump's figure the depot page
            // lists as `pumped` — the two differ by whatever went astray (2026-10-05).
            ['Received from depot', `${figure(depotLoads)} · ${amount(movement.loadedDepotLitres, 'L')}`],
            ['Stops', `${figure(stops.length)} · ${figure(gensets)} ${gensets === 1 ? 'genset' : 'gensets'}`],
            ['Delivered', amount(movement.arrivedLitres, 'L')],
          ]}
        />
      </Section>

      <div className="border-t border-subtle px-4 py-4">
        <Link
          to="/fuel"
          search={{view: 'truck-log', truck: truck.id}}
          className="inline-flex items-center gap-0.5 rounded-sm text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          View in Truck log
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
};

/**
 * The same truck as a panel beside the map, as the Gensets page previews a set
 * (Jeff, 2026-09-30): the register's row selects it, the map's pin selects it, and
 * the panel floats over the map's right edge. Below `md` there is no map to float
 * over, so the drawer (`TruckPanel`) opens instead. Drawn only while a truck is
 * selected (Jeff, 2026-09-30), so it has no empty state.
 */
export const TruckDetailPanel = ({
  truck,
  from,
  to,
  onClose,
  className,
}: {
  truck: RefuelTruck;
  from: number;
  to: number;
  onClose: () => void;
  className?: string;
}) => {
  const depot = DEPOTS.find((d) => d.id === truck.homeDepotId);

  return (
    <aside
      aria-label="Truck details"
      className={cn(
        'flex flex-col overflow-y-auto rounded-md border border-default bg-overlay text-primary',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-sm font-medium text-primary">{truck.plate}</h2>
          <p className="text-xs text-secondary">{`${depot?.name ?? truck.homeDepotId} depot · ${truck.areaLabel}`}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
          aria-label="Clear selection"
        >
          <XIcon className="size-4" />
        </button>
      </header>
      <PanelBody truck={truck} from={from} to={to} />
    </aside>
  );
};

export const TruckPanel = ({
  truck,
  from,
  to,
  onClose,
}: {
  truck: RefuelTruck | undefined;
  from: number;
  to: number;
  onClose: () => void;
}) => {
  const depot = DEPOTS.find((d) => d.id === truck?.homeDepotId);

  return (
    <DialogPrimitive.Root open={truck !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l border-default bg-overlay text-primary shadow-lg outline-none sm:max-w-md">
          {truck !== undefined && (
            <>
              <header className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <DialogPrimitive.Title className="truncate text-sm font-medium text-primary">
                    {truck.plate}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-secondary">
                    {`${depot?.name ?? truck.homeDepotId} depot · ${truck.areaLabel}`}
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close
                  className="rounded-md p-1 text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
                  aria-label="Close"
                >
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
              </header>
              <PanelBody truck={truck} from={from} to={to} />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
