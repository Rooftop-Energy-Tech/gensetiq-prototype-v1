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
import {useFuelWindow} from './PeriodControl';
import {ViewSwitch} from './ViewSwitch';
import {FuelNav} from './FuelNav';
import {historyStart} from '@/modules/genset/data/history';
import {FuelBalanceCard} from './FuelBalanceCard';

/**
 * `/fuel` — diesel, from the depot out to the gensets.
 *
 * **Depot tanks first, then the fills.** The tanks are where a loss shows; the fills
 * are where the fuel arrived. Each yard's card opens that yard's own page,
 * `/fuel/depots/$depotId` (`DepotPage`).
 *
 * ## Two tabs
 *
 * Chosen from a second rail on the left (`FuelNav`), drawn like the Service page's,
 * whose links switch the tab, or cards at the top on a phone (`ViewSwitch`).
 *
 * **Depots** is the yards' tanks, each reconciled against the gensets it supplied
 * (`data/depotTank.ts`). **History** (`?view=history`; `Deliveries`, then `Genset
 * fills`, until 2026-10-05) is every fill, with the depot it was charged to, a tab
 * of its own (Jeff, 2026-09-30) rather than a table under the tanks. The depot cards
 * share one window, the last 30 days, because a reconciliation measured over two
 * periods does not reconcile; the History table has its own period picker.
 *
 * Trucks were removed (Jeff, 2026-10-05), with their `Truck fleet` and `Truck log`
 * tabs: the depot is now reconciled against the gensets it supplied, and whatever
 * carries the fuel between them is not tracked.
 *
 * ## What is not here yet
 *
 * The **work-order half** — what has been booked and what the tanker is still owed.
 * A `/refuel` page that did this was written against the per-genset
 * `DeploymentSession` model this app replaced on 21 September, and is not in this
 * tree. This page reads only what a fill *was*, which the history layer can answer
 * today.
 */

/** Which tab `/fuel` is showing — the `view` search parameter. */
export type FuelView = 'depots' | 'history';

/**
 * The tab's name for the breadcrumb, from the raw `view` param. Resolved as the page
 * does — anything unknown is Depots — so the crumb never names a tab the page is not
 * showing.
 */
export const fuelTabLabel = (view: unknown): string => (view === 'history' ? 'History' : 'Depots');

/**
 * Every genset fill, off the one fill record the depot cards also read, so they
 * cannot disagree about which depot supplied a fill. Every fill is charged to one
 * depot, the nearest to where the genset stood (`data/fills.ts`), so every fill is
 * listed — yard and field alike since the trucks were removed (Jeff, 2026-10-05).
 */
const buildDeliveries = (): Array<DeliveryRow> =>
  allFills()
    .map((fill) => {
      const genset = seededGenset(fill.gensetId);
      const depot = DEPOTS.find((d) => d.id === fill.depotId);

      return {
        id: fill.id,
        gensetId: fill.gensetId,
        name: genset === undefined ? fill.gensetId : gensetLabel(genset),
        at: fill.at,
        litres: Math.round(fill.litres),
        depotId: fill.depotId,
        depotName: depot === undefined ? 'Unassigned' : `${depot.name} depot`,
      };
    })
    .sort((a, b) => b.at - a.at);

export const FuelPage = ({
  view,
  onViewChange,
  depotId,
  onDepotChange,
}: {
  view: FuelView;
  onViewChange: (next: FuelView) => void;
  /** The History table's depot filter, held in the URL; `undefined` is every yard. */
  depotId: string | undefined;
  onDepotChange: (next: string | undefined) => void;
}) => {
  // ## One fixed window, and no control over it
  //
  // The page reports on the last 30 days, and says so in each card's corner pill.
  // It had a 1 day / 7 days / 1 month / custom control above every tab until
  // 2026-09-30, when Jeff asked for the page to show the current state only. The
  // tables keep their own control for looking further back — the genset analysis
  // tab's `RangePicker` since 2026-10-05, see `TablePeriod`. See `useFuelWindow`.
  const {now, period, from, to, periodLabel} = useFuelWindow();
  // What the two tables open on, and the record's start their calendars stop at.
  const pageWindow: PageWindow = {period, from, to, now, earliest: historyStart()};

  return (
    // The page scrolls, not the table inside it. The shell is `h-screen
    // overflow-hidden` so every page owns its own scrolling, and this one had given
    // it to the delivery table: the depot cards stayed pinned while a reader dragged
    // a scrollbar inside a box to read a list of hundreds. The tanks are worth
    // scrolling past.
    // `pb-24` below `md`: `MobileNav` is a floating pill rather than a docked bar,
    // so nothing reserves space for it and the last card's final rows sat under it.
    //
    // Depot tanks and History are a second rail on the left from `md` (Jeff,
    // 2026-09-29; the Service rail's look since 2026-10-05), and cards above the
    // page on a phone. See `FuelNav`.
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FuelNav />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-24 md:pb-4">
        <ViewSwitch value={view} onChange={onViewChange} from={from} to={to} />

        {view === 'history' ? (
          <DeliveriesView page={pageWindow} depotId={depotId} onDepotChange={onDepotChange} />
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
      verdict: varianceSeverity(movement.varianceLitres),
    };
  });
  // The bigger gap first.
  const flagged = yards
    .filter((yard) => yard.verdict !== undefined)
    .sort(
      (a, b) =>
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
          tile's own words — `1, 826 L missing in transit` (`Sensor fault` too until
          2026-10-05) — each a
          link to that yard's page. It replaced two cards, `Fuel unaccounted for`
          and `Sensor faults`, that counted yards without naming them: with four
          tiles a count sent the reader scanning for which, and their filters hid
          one or two tiles that were already on screen. `Fuel in stock`, `Low stock`
          and `Days of stock` were tried and cut the same day. */}
      <SummaryCardRow cappedColumns={2}>
        <SummaryCard label="Needs attention" pill={periodLabel}>
          {flagged.length === 0 ? (
            <Headline value="None" detail="every depot balances" />
          ) : (
            <ul className="flex flex-col gap-1">
              {flagged.map(({depot, movement}) => (
                <li key={depot.id}>
                  <Link
                    to="/fuel/depots/$depotId"
                    params={{depotId: depot.id}}
                    className="group flex items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        'bg-severity-critical',
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-primary underline-offset-2 group-hover:underline">
                      {depot.name}
                    </span>
                    <span className="truncate text-secondary">
                      {verdictLabel(movement.varianceLitres)}
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

/** The History tab: every genset fill, with its supplying depot. */
const DeliveriesView = ({
  page,
  depotId,
  onDepotChange,
}: {
  page: PageWindow;
  depotId: string | undefined;
  onDepotChange: (next: string | undefined) => void;
}) => {
  // Every delivery the record holds. Built once because the full list is the
  // expensive part; the table cuts it to the page's period, or its own.
  const all = useMemo(() => buildDeliveries(), []);
  return <DeliveriesTable rows={all} page={page} depotId={depotId} onDepotChange={onDepotChange} />;
};
