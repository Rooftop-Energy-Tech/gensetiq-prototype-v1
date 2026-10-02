import {Link, useNavigate} from '@tanstack/react-router';
import {useMemo} from 'react';

import {Headline, SummaryCard, SummaryCardRow} from '@/components/global/SummaryCards';
import {cn} from '@/lib/utils';
import {seededGenset} from '@/modules/genset/data/fleet';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {DeliveriesTable} from './DeliveriesTable';
import type {PageWindow} from './TablePeriod';
import type {DeliveryRow} from './DeliveriesTable';
import {DepotTank, verdictLabel} from './DepotTank';
import {DEPOTS, depotCapacityLitres, reconcile, varianceSeverity} from './data/depotTank';
import {allFills} from './data/fills';
import {TRUCKS, truckById} from './data/trucks';
import {useFuelWindow} from './PeriodControl';
import {TruckLog} from './TruckLog';
import {TrucksView} from './TrucksView';
import {ViewSwitch} from './ViewSwitch';
import {FuelNav} from './FuelNav';
import {historyStart} from '@/modules/genset/data/history';
import {FuelBalanceCard} from './FuelBalanceCard';

/**
 * `/fuel` — diesel, in the two halves an operations room asks about.
 *
 * **Tanks first, deliveries after them.** The tanks are who will need a tanker; the
 * delivery list is where one has already been. That order is deliberate and is the
 * argument in `FleetTanks` — a machine at 8% with nothing booked against it is
 * invisible on a page made only of what has been booked. Each yard's card opens that
 * yard's own page, `/fuel/depots/$depotId` (`DepotPage`).
 *
 * ## Where a delivery happened
 *
 * At the depot on its row, and nowhere else: this list is gensets that drove in to
 * a yard, so the depot *is* the place. A separate `Where` column once gave the
 * machine's posting, which beside the depot said the same thing twice (Jeff,
 * 2026-09-29).
 *
 * ## Two halves, where the estate runs trucks
 *
 * Chosen from a second rail on the left (`FuelNav`), whose rows also jump to each
 * half's sections, or two cards at the top on a phone (`ViewSwitch`).
 * A combined page of both was tried and dropped (Jeff, 2026-09-29): depots and
 * trucks are different jobs, and one page of both read as neither.
 *
 * **Depots** is the yards' tanks. **Deliveries** is every genset filled at a yard, a
 * tab of its own (Jeff, 2026-09-30) rather than a table under the tanks. **Trucks**
 * is the other way fuel reaches a machine — a truck driving it out to a genset in a
 * state with no depot — with each truck's tank, where it is, and whether what it
 * pumped arrived. One window under all three — the last month — for the reason it is one: a
 * reconciliation measured over two periods does not reconcile.
 *
 * An estate with no trucks gets Depots and Deliveries only, not a Trucks row with
 * nothing behind it. See `data/trucks.ts`.
 *
 * ## What is not here yet
 *
 * The **work-order half** — what has been booked and what the tanker is still owed.
 * There is a `/refuel` page in the tree that does exactly that, written against the
 * per-genset `DeploymentSession` model this app replaced on 21 September; folding it
 * in means migrating it to the job-at-a-yard model, which is its author's call. This
 * page deliberately reads only what a delivery *was*, which the history layer can
 * answer today.
 */

/** Which tab `/fuel` is showing — the `view` search parameter. */
export type FuelView = 'depots' | 'deliveries' | 'trucks' | 'truck-log';

/**
 * The tab's name for the breadcrumb, from the raw `view` param. Resolved as the page
 * does — anything unknown, or a truck tab on an estate with none, is Depots — so
 * the crumb never names a tab the page is not showing.
 */
export const fuelTabLabel = (view: unknown): string =>
  view === 'deliveries'
    ? 'Deliveries'
    : TRUCKS.length > 0 && view === 'trucks'
      ? 'Trucks'
      : TRUCKS.length > 0 && view === 'truck-log'
        ? 'Truck log'
        : 'Depots';

/**
 * Every genset filled at a yard, off the one fill record the depot cards and the
 * trucks also read, so they cannot disagree about where a fill happened.
 *
 * Yard fills only. A truck's fill is the Trucks tab's, in its log: listed here under
 * the truck's home depot, it read as the depot filling a genset in a state it has
 * no yard in (Jeff, 2026-09-29).
 */
const buildDeliveries = (): Array<DeliveryRow> =>
  allFills()
    .flatMap((fill) => (fill.route.kind === 'yard' ? [{fill, depotId: fill.route.depotId}] : []))
    .map(({fill, depotId}) => {
      const genset = seededGenset(fill.gensetId);
      const depot = DEPOTS.find((d) => d.id === depotId);

      return {
        id: fill.id,
        gensetId: fill.gensetId,
        name: genset === undefined ? fill.gensetId : gensetLabel(genset),
        at: fill.at,
        litres: Math.round(fill.litres),
        depotId,
        depotName: depot?.name ?? 'Unassigned',
        depotLocation: depot === undefined ? 'Unassigned' : `${depot.name} depot, ${depot.locationLabel.split(', ').at(-1)}`,
      };
    })
    .sort((a, b) => b.at - a.at);

export const FuelPage = ({
  view,
  onViewChange,
  truckId,
  onTruckChange,
}: {
  view: FuelView;
  onViewChange: (next: FuelView) => void;
  /** The truck whose panel is open — the `truck` search parameter. */
  truckId: string | undefined;
  onTruckChange: (next: string | undefined) => void;
}) => {
  // ## One fixed window, and no control over it
  //
  // The page reports on the last month, and says so in each row's label (`Fuel
  // Out, 1 month`). It had a 1 day / 7 days / 1 month / custom control above every
  // tab until 2026-09-30, when Jeff asked for the page to show the current state
  // only. The tables keep their own control for looking further back. See
  // `useFuelWindow`.
  const {now, period, from, to, periodLabel} = useFuelWindow();
  // What the two tables follow until their own period control is touched.
  const pageWindow: PageWindow = {period, from, to, now, earliest: historyStart()};

  // A truck tab in the URL of an estate without any is the depot tab, not an empty one.
  const hasTrucks = TRUCKS.length > 0;
  const active: FuelView = (view === 'trucks' || view === 'truck-log') && !hasTrucks ? 'depots' : view;

  return (
    // The page scrolls, not the table inside it. The shell is `h-screen
    // overflow-hidden` so every page owns its own scrolling, and this one had given
    // it to the delivery table: the depot cards stayed pinned while a reader dragged
    // a scrollbar inside a box to read a list of hundreds. The tanks are worth
    // scrolling past.
    // `pb-24` below `md`: `MobileNav` is a floating pill rather than a docked bar,
    // so nothing reserves space for it and the last card's final rows sat under it.
    //
    // Depots, Deliveries and Trucks are a second rail on the left from `md` (Jeff,
    // 2026-09-29), and cards above the page on a phone. See `FuelNav`.
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FuelNav value={active} onChange={onViewChange} from={from} to={to} />

      {/* The Trucks tab, from `md`, fills the screen rather than scrolling it, as
          the Gensets page does, with that page's `gap-3`. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-24 md:pb-4',
          active === 'trucks' ? 'gap-3' : 'gap-4',
        )}
      >
        <ViewSwitch value={active} onChange={onViewChange} from={from} to={to} />

        {active === 'trucks' ? (
          <TrucksView from={from} to={to} truckId={truckId} onTruckChange={onTruckChange} />
        ) : active === 'truck-log' ? (
          // Every truck's log, a tab of its own (Jeff, 2026-09-30) rather than a
          // table under the register — as Deliveries is beside Depot tanks.
          // Keyed by truck, so the panel's `View in Truck log` link for another
          // truck starts the search afresh.
          <TruckLog key={truckId ?? ''} page={pageWindow} initialQuery={truckById(truckId ?? '')?.plate} />
        ) : active === 'deliveries' ? (
          <DeliveriesView page={pageWindow} />
        ) : (
          <DepotsView from={from} to={to} periodLabel={periodLabel} />
        )}
      </div>
    </div>
  );
};

/** The depot tab: an overview row, then each yard's tank. A card opens that yard's own page. */
const DepotsView = ({from, to, periodLabel}: {from: number; to: number; periodLabel: string}) => {
  const navigate = useNavigate();

  // Each yard's reconciliation once, for the overview and its tank both.
  const yards = DEPOTS.map((depot) => {
    const movement = reconcile(depot.id, from, to);
    return {
      depot,
      movement,
      verdict: varianceSeverity(movement.outLitres, movement.varianceLitres),
    };
  });
  // Worst first: fuel missing before a sensor to check, and the bigger loss first.
  const flagged = yards
    .filter((yard) => yard.verdict !== undefined)
    .sort(
      (a, b) =>
        Number(b.verdict?.severity === 'CRITICAL') - Number(a.verdict?.severity === 'CRITICAL') ||
        b.movement.varianceLitres - a.movement.varianceLitres,
    );
  const fuelIn = yards.reduce((sum, yard) => sum + yard.movement.receivedLitres, 0);
  const fuelOut = yards.reduce((sum, yard) => sum + yard.movement.outLitres, 0);
  const balance = yards.reduce((sum, yard) => sum + yard.movement.levelLitres, 0);
  const capacity = DEPOTS.reduce((sum, depot) => sum + depotCapacityLitres(depot.id), 0);

  return (
    <>
      {/* ## Two cards: which yards need someone, and the month's fuel in and out
          (Jeff, 2026-10-01)

          `Needs attention` names each yard with a verdict and says what, in the
          tile's own words — `1,249 L unlogged`, `Sensor fault` — each a
          link to that yard's page. It replaced two cards, `Fuel unaccounted for`
          and `Sensor faults`, that counted yards without naming them: with four
          tiles a count sent the reader scanning for which, and their filters hid
          one or two tiles that were already on screen. `Fuel in stock`, `Low stock`
          and `Days of stock` were tried and cut the same day. */}
      <SummaryCardRow cappedColumns={2}>
        <SummaryCard label="Needs attention" pill={periodLabel}>
          {flagged.length === 0 ? (
            <Headline value="None" detail="every depot balances and its sensors agree" />
          ) : (
            <ul className="flex flex-col gap-1">
              {flagged.map(({depot, verdict, movement}) => (
                <li key={depot.id}>
                  <Link
                    to="/fuel/depots/$depotId"
                    params={{depotId: depot.id}}
                    className="group flex items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        verdict?.severity === 'CRITICAL' ? 'bg-severity-critical' : 'bg-severity-warning',
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-primary underline-offset-2 group-hover:underline">
                      {depot.name}
                    </span>
                    <span className="truncate text-secondary">
                      {verdict === undefined ? '' : verdictLabel(verdict, movement.varianceLitres)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SummaryCard>
        {/* All four tanks together — see `FuelBalanceCard`. */}
        <FuelBalanceCard
          fuelIn={fuelIn}
          fuelOut={fuelOut}
          balance={balance}
          balanceNote={`left in all depots, ${capacity > 0 ? Math.round((balance / capacity) * 100) : 0}% full`}
          periodLabel={periodLabel}
        />
      </SummaryCardRow>

      {/* One card per yard. A grid rather than a row: four of these on a wide band
          would each be 320px and the tank inside would shrink to a smudge, and at
          phone width a row would scroll sideways. */}
      <div id="fuel-tanks" className="grid scroll-mt-3 gap-4 md:grid-cols-2">
        {yards.map(({depot}) => (
          <DepotTank
            key={depot.id}
            depot={depot}
            from={from}
            to={to}
            periodLabel={periodLabel}
            onOpen={() => void navigate({to: '/fuel/depots/$depotId', params: {depotId: depot.id}})}
          />
        ))}
      </div>
    </>
  );
};

/** The deliveries tab: every genset filled at a yard. */
const DeliveriesView = ({page}: {page: PageWindow}) => {
  // Every delivery the record holds. Built once because the full list is the
  // expensive part; the table cuts it to the page's period, or its own.
  const all = useMemo(() => buildDeliveries(), []);
  return <DeliveriesTable rows={all} page={page} />;
};
