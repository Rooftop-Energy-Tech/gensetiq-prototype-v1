import {TriangleAlertIcon} from 'lucide-react';
import {amount} from '@/lib/format';
import {DepotTankGlyph} from './DepotTankGlyph';
import {cn} from '@/lib/utils';
import {
  depotCapacityLitres,
  depotFleet,
  depotSeries,
  reconcile,
  varianceSeverity,
} from './data/depotTank';
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
  const capacity = depotCapacityLitres(depot.id);
  const served = depotFleet(depot.id).length;
  // Thirty days back from now, which is the window the tile states. `useMemo` is not
  // worth it: `reconcile` walks a 60-day hourly series once per card and the page
  // draws four.
  const movement = reconcile(depot.id, Date.now() - 30 * 24 * 3_600_000, Date.now());
  // 2% of what was issued, or 100 L, whichever is larger — and half that to warn.
  // A tanker meter and a tank float never agree exactly, so a threshold in percent
  // alone cries wolf on a quiet yard where 40 L of noise is 8%, and one in litres
  // alone stays silent through a busy month where 90 L is lost in the rounding.
  const verdict = varianceSeverity(movement.outLitres, movement.varianceLitres);
  const level = series.at(-1)?.litres ?? 0;
  const fraction = capacity > 0 ? level / capacity : 0;

  return (
    <section className="flex min-w-0 flex-col gap-2 self-stretch rounded-md border border-subtle bg-element px-5 py-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-xs font-medium tracking-wide text-secondary uppercase">
          {depot.name} depot
        </h2>

        {/* The verdict, where a reader's eye lands first on a grid of four yards.
            Absent when the two sides agree, rather than a green `Reconciled` chip:
            four cards each declaring success is four things to read past to find
            the one that did not. */}
        {verdict === undefined ? (
          <p className="text-xs text-tertiary">{depot.locationLabel}</p>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              verdict.severity === 'CRITICAL'
                ? 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical'
                : 'border-severity-warning/25 bg-severity-warning/10 text-severity-warning',
            )}
          >
            <TriangleAlertIcon className="size-3" aria-hidden="true" />
            {/* Named for what actually happened. A shortfall is fuel that left and
                did not arrive; a surplus is machines reporting more than the yard
                released, which is instruments disagreeing rather than a loss. */}
            {verdict.kind === 'shortfall' ? 'Fuel did not arrive' : 'Readings disagree'}
          </span>
        )}
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
          {/* The two movements a level sensor can see, over the last 30 days.
              Issued is every fall, received is every rise, and they are kept apart
              rather than netted: a 50,000 L delivery into the yard would otherwise
              cancel a week of tankers going out and the tile would read as a quiet
              month. Thirty days until the period control lands — long enough that
              every yard has taken at least one delivery in it. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Issued, 30 days</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {amount(movement.outLitres, 'L')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Received, 30 days</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {movement.receivedLitres === 0 ? (
                <span className="text-tertiary">No delivery</span>
              ) : (
                amount(movement.receivedLitres, 'L')
              )}
            </dd>
          </div>
          {/* The other side of the reconciliation: what the machines' own tanks
              recorded arriving, summed across this yard's catchment. Issued is a
              depot instrument, this is thirty-eight separate ones, and the gap
              between them is the only thing on this page that is anybody's
              problem. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Delivered at sites</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {amount(movement.deliveredLitres, 'L')}
            </dd>
          </div>

          {/* Signed, and the sign is the story. **Positive means fuel left the yard
              and never arrived** — the case worth chasing. Negative means machines
              recorded more than the depot released, which is not theft in reverse
              but an instrument disagreeing: a float reading long, or a top-up from
              a drum nobody put through the yard. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Variance</dt>
            <dd
              className={cn(
                'text-right text-sm font-semibold tabular-nums',
                verdict?.severity === 'CRITICAL'
                  ? 'text-severity-critical'
                  : verdict?.severity === 'WARNING'
                    ? 'text-severity-warning'
                    : 'text-primary',
              )}
            >
              {movement.varianceLitres > 0 ? '+' : ''}
              {amount(movement.varianceLitres, 'L')}
              {movement.variancePercent !== null && (
                <span className="font-medium text-secondary">
                  {` (${movement.variancePercent > 0 ? '+' : ''}${movement.variancePercent.toFixed(1)}%)`}
                </span>
              )}
            </dd>
          </div>

          {/* Kept because the figures above are a catchment's, not the estate's: a
              yard serving twenty-one sets issues four times what one serving five
              does, and neither is remarkable. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Machines served</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              {served}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
