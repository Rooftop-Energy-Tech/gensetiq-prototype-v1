import {useMemo, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {DropletIcon, SearchXIcon} from 'lucide-react';

import {stampAt} from '@/lib/format';
import {seededDeployments, seededMemberships} from '@/modules/deployment/data/seed';
import {GENSETS} from '@/modules/genset/data/fleet';
import {refuelsIn} from '@/modules/genset/data/history';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {DepotTank} from './DepotTank';
import {DEPOTS} from './data/depotTank';
import {PERIOD_LABEL, PeriodControl, inputDay, periodWindow} from './PeriodControl';
import type {Period} from './PeriodControl';
import {historyStart} from '@/modules/genset/data/history';

/**
 * `/fuel` — diesel, in the two halves an operations room asks about.
 *
 * **Tanks first, deliveries under them.** The tank panel is who will need a tanker;
 * the delivery list is where one has already been. That order is deliberate and is
 * the argument in `FleetTanks` — a machine at 8% with nothing booked against it is
 * invisible on a page made only of what has been booked.
 *
 * ## Where a delivery says it happened
 *
 * The placename on a delivery row is **the posting that held the machine at that
 * instant**, not where the set is standing now. A delivery is history: BRF 9540 took
 * 1,057 L at a yard on the 16th and is in the workshop today, and a list built from
 * current placenames would put five deliveries in a workshop no tanker ever visited.
 * A fill between two jobs says so rather than borrowing the nearest yard.
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

type DeliveryRow = {
  id: string;
  gensetId: string;
  name: string;
  at: number;
  litres: number;
  place: string;
};

/** Where a machine was standing at an instant — the posting that held it then. */
const placeAt = (gensetId: string, at: number): string => {
  const deployments = new Map(seededDeployments().map((d) => [d.id, d]));

  for (const member of seededMemberships()) {
    if (member.gensetId !== gensetId) continue;
    const deployment = deployments.get(member.deploymentId);
    if (deployment === undefined) continue;

    const startMs = new Date(deployment.startsAt).getTime();
    const endMs =
      deployment.endsAt === null
        ? Number.POSITIVE_INFINITY
        : new Date(deployment.endsAt).getTime();
    if (at >= startMs && at <= endMs) return deployment.locationLabel;
  }

  return 'Between postings';
};

const buildDeliveries = (now: number): Array<DeliveryRow> => {
  const rows: Array<DeliveryRow> = [];

  for (const genset of GENSETS) {
    // The whole record rather than a window: this list is short by nature — a fleet
    // takes a few deliveries a week — and a reader scanning it wants the last one
    // each machine had, not the last thirty days of them.
    for (const refuel of refuelsIn(genset.id, 0, now)) {
      rows.push({
        id: `${genset.id}-${refuel.at}`,
        gensetId: genset.id,
        name: gensetLabel(genset),
        at: refuel.at,
        litres: Math.round(refuel.litres),
        place: placeAt(genset.id, refuel.at),
      });
    }
  }

  return rows.sort((a, b) => b.at - a.at);
};

export const FuelPage = () => {
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>('1m');
  const [customFrom, setCustomFrom] = useState(() => inputDay(now - 30 * 24 * 3_600_000));
  const [customTo, setCustomTo] = useState(() => inputDay(now));

  const {from, to} = periodWindow(period, now, customFrom, customTo);

  // Every delivery the record holds, then cut to the window. Built once because the
  // full list is the expensive part and the filter is a comparison.
  const all = useMemo(() => buildDeliveries(now), [now]);
  const deliveries = all.filter((row) => row.at >= from && row.at <= to);

  const litres = deliveries.reduce((sum, row) => sum + row.litres, 0);

  return (
    // The page scrolls, not the table inside it. The shell is `h-screen
    // overflow-hidden` so every page owns its own scrolling, and this one had given
    // it to the delivery table: the depot cards stayed pinned while a reader dragged
    // a scrollbar inside a box to read a list of hundreds. The tanks are worth
    // scrolling past.
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
      {/* Above everything, because the page is a reconciliation and two halves of
          one measured over different periods do not reconcile. */}
      <PeriodControl
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        earliest={historyStart()}
        now={now}
        onPeriodChange={setPeriod}
        onCustomChange={(nextFrom, nextTo) => {
          setCustomFrom(nextFrom);
          setCustomTo(nextTo);
          setPeriod('custom');
        }}
      />

      {/* One card per yard. A grid rather than a row: four of these on a wide band
          would each be 320px and the tank inside would shrink to a smudge, and at
          phone width a row would scroll sideways. */}
      <div className="grid gap-4 md:grid-cols-2">
        {DEPOTS.map((depot) => (
          <DepotTank
            key={depot.id}
            depot={depot}
            from={from}
            to={to}
            periodLabel={PERIOD_LABEL[period].toLowerCase()}
          />
        ))}
      </div>

      <section className="flex min-h-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-primary">Deliveries</h2>
          <p className="text-xs text-secondary">
            {deliveries.length.toLocaleString('en-MY')} in this period ·{' '}
            {litres.toLocaleString('en-MY')} L
          </p>
        </header>

        {deliveries.length === 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-subtle bg-element p-3 text-sm text-secondary">
            <SearchXIcon className="size-4 shrink-0" aria-hidden="true" />
            No delivery in this period.
          </p>
        ) : (
          // `overflow-x-auto` only. The table sets its own height and the page
          // carries it; what it must still do is scroll sideways rather than push
          // the whole page wide on a narrow window.
          <div className="overflow-x-auto rounded-md border border-subtle">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-element">
                <tr className="text-left text-xs text-secondary">
                  <th className="border-b border-subtle p-2 font-medium">Genset</th>
                  <th className="border-b border-subtle p-2 font-medium">Delivered</th>
                  <th className="border-b border-subtle p-2 font-medium">Litres</th>
                  <th className="border-b border-subtle p-2 font-medium">Where</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((row) => (
                  <tr key={row.id} className="bg-element">
                    <td className="h-11 truncate border-b border-subtle p-2">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: row.gensetId}}
                        className="text-primary underline-offset-2 outline-none hover:underline focus-visible:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="h-11 truncate border-b border-subtle p-2 text-primary">
                      {stampAt(new Date(row.at).toISOString())}
                    </td>
                    <td className="h-11 truncate border-b border-subtle p-2 text-primary tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <DropletIcon className="size-3.5 text-fuel" aria-hidden="true" />
                        {row.litres.toLocaleString('en-MY')} L
                      </span>
                    </td>
                    <td className="h-11 truncate border-b border-subtle p-2 text-secondary">
                      {row.place}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
