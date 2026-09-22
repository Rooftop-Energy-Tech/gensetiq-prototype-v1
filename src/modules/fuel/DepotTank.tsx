import {amount} from '@/lib/format';
import {DepotTankGlyph} from './DepotTankGlyph';
import {depotFleet, depotSeries} from './data/depotTank';
import type {Depot} from './data/depotTank';

/**
 * The yard's bulk tank, drawn as a genset's is.
 *
 * ## Why this replaced the list of every tank
 *
 * The page opened on all thirty-eight machine tanks ranked worst-first, which is a
 * fleet fuel *status* board — and the fleet register already ranks by fuel, and each
 * machine's own page carries its tank in more detail than a bar can. What this page
 * has that no other does is **the depot**: the one tank whose level says how much
 * fuel left the yard, which is the whole basis of the reconciliation beside it.
 *
 * It gets its own mark rather than the genset glyph — see `DepotTankGlyph`. A yard's
 * bulk tank is a horizontal vessel on saddles, and drawing it as a machine's upright
 * belly tank made the page's one *place* look like a thirty-ninth machine.
 *
 * ## It has no reserve line, and should not
 *
 * A machine's tank has a reserve because running it dry strands a set mid-load and
 * needs the fuel system bled. A depot running low is a purchasing problem with days
 * of warning, so the glyph carries the level and the capacity and nothing about
 * urgency — the reconciliation beside it is where this page raises alarms.
 */
export const DepotTank = ({depot}: {depot: Depot}) => {
  const series = depotSeries(depot.id);
  const capacity = depot.capacityLitres;
  const served = depotFleet(depot.id).length;
  const level = series.at(-1)?.litres ?? 0;
  const fraction = capacity > 0 ? level / capacity : 0;

  return (
    <section className="flex min-w-0 flex-col gap-2 self-stretch rounded-md border border-subtle bg-element px-5 py-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-xs font-medium tracking-wide text-secondary uppercase">
          {depot.name} depot
        </h2>
        <p className="text-xs text-tertiary">{depot.locationLabel}</p>
      </header>

      <div className="flex items-start gap-4 py-1.5">
        <div className="flex w-[200px] shrink-0 flex-col items-center gap-1.5">
          <DepotTankGlyph fraction={fraction} className="w-full text-secondary" />
          <p className="text-sm font-semibold whitespace-pre text-primary">
            {`${amount(level, 'L')}  |  ${Math.round(fraction * 100)}%`}
          </p>
        </div>

        <dl className="flex min-w-0 flex-1 flex-col divide-y divide-subtle">
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Max capacity</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {amount(capacity, 'L')}
            </dd>
          </div>
          {/* How many machines draw from here. The variance beside it is a figure
              about this catchment and not the estate, and a reader comparing two
              yards needs to know one serves seventeen sets and another five. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Machines served</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {served}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Instrument</dt>
            <dd className="text-right text-sm font-semibold text-primary">Level sensor only</dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
