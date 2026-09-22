import {TankGlyph} from '@/components/global/TankGlyph';
import {amount} from '@/lib/format';
import {depotCapacityLitres, depotSeries} from './data/depotTank';

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
 * So the same glyph the genset pages use, at the same `2xl`, labelled for the yard.
 * One tank drawn the way the reader already knows how to read, instead of
 * thirty-eight restated from elsewhere.
 *
 * ## It has no reserve line, and should not
 *
 * A machine's tank has a reserve because running it dry strands a set mid-load and
 * needs the fuel system bled. A depot running low is a purchasing problem with days
 * of warning, so the glyph carries the level and the capacity and nothing about
 * urgency — the reconciliation beside it is where this page raises alarms.
 */
export const DepotTank = () => {
  const series = depotSeries();
  const capacity = depotCapacityLitres();
  const level = series.at(-1)?.litres ?? 0;
  const fraction = capacity > 0 ? level / capacity : 0;

  return (
    <section className="flex min-w-0 flex-col gap-2 self-stretch rounded-md border border-subtle bg-element px-5 py-4">
      <h2 className="text-xs font-medium tracking-wide text-secondary uppercase">Depot</h2>

      <div className="flex items-start gap-4 py-1.5">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <TankGlyph fraction={fraction} tone="teal" size="2xl" />
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
          {/* Said out loud because it is not a nameplate: the tank is sized at half
              again the heaviest month this fleet has drawn, so it grows with the
              estate. A reader seeing 350,000 L should know where it came from. */}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm font-medium text-secondary">Sized for</dt>
            <dd className="text-right text-sm font-semibold text-primary tabular-nums">
              Heaviest month + 50%
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
