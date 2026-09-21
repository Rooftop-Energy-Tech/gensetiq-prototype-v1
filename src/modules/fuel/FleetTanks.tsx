import {useMemo} from 'react';
import {Link} from '@tanstack/react-router';
import {DropletIcon} from 'lucide-react';

import {gensetById} from '@/modules/genset/data/deployment';
import {GENSETS} from '@/modules/genset/data/fleet';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {
  FUEL_LEVEL_LABEL,
  RESERVE_FRACTION,
  fuelFraction,
  fuelLevelKind,
} from '@/modules/genset/types/fuelLevel.type';
import type {FuelLevelKind} from '@/modules/genset/types/fuelLevel.type';

/**
 * Every tank on the estate, worst first — the panel above the order list.
 *
 * ## Why it leads the page rather than sitting under the orders
 *
 * The order list answers *what has been booked*. It cannot answer the question the
 * operations room actually opens this screen with, which is **who is going to need a
 * tanker and has nobody booked for it yet**: a set can be at 8% with no order against
 * it, and on a page made only of orders that machine is invisible precisely because
 * nothing has been done about it. So the tanks come first and the orders follow.
 *
 * ## It ranks by fraction, not by litres
 *
 * A 600 L tank at 120 L and a 2,450 L tank at 400 L hold different amounts and are
 * in the same trouble. Sorting by litres would put the big tank's comfortable 400 L
 * above the small tank's near-dry 120, which is the order a driver would read as a
 * priority list and get wrong. The litres are still in the row, because that is what
 * a delivery is booked in.
 *
 * Levels and thresholds come from `fuelLevel.type` rather than being restated here,
 * so a machine this panel calls low is one the fleet register, the genset page and
 * the overview buckets also call low.
 */

const BAR_TONE: Record<FuelLevelKind | 'ok', string> = {
  empty: 'bg-severity-critical',
  low: 'bg-fuel',
  ok: 'bg-severity-ok',
};

type TankRow = {
  id: string;
  name: string;
  litres: number;
  capacityLitres: number;
  fraction: number;
  kind: FuelLevelKind | undefined;
  place: string;
};

const buildRows = (): Array<TankRow> =>
  GENSETS.map((seeded) => {
    // The *deployed* row, so the placename is where the machine is standing now
    // rather than where the fleet seed first put it. A tanker sent to the seed's
    // yard would be sent to the wrong one.
    const genset = gensetById(seeded.id) ?? seeded;
    return {
      id: genset.id,
      name: gensetLabel(genset),
      litres: genset.fuelLitres,
      capacityLitres: genset.fuelCapacityLitres,
      fraction: fuelFraction(genset.fuelLitres, genset.fuelCapacityLitres),
      kind: fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres),
      place: genset.locationLabel,
    };
  }).sort((a, b) => a.fraction - b.fraction);

export const FleetTanks = () => {
  const rows = useMemo(buildRows, []);
  const needing = rows.filter((row) => row.kind !== undefined);
  const litresToFill = needing.reduce(
    (sum, row) => sum + Math.max(0, row.capacityLitres - row.litres),
    0,
  );

  return (
    <section className="flex flex-col gap-2 rounded-md border border-subtle bg-element p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-primary">Tanks</h2>
        {/* The position in one line, and it is the *workload*: how many machines are
            under a line, and what filling all of them would take. A count alone does
            not size a tanker run. */}
        <p className="text-xs text-secondary">
          {needing.length === 0
            ? 'Every tank above its reserve line'
            : `${needing.length} of ${rows.length} below reserve · ${Math.round(litresToFill).toLocaleString('en-MY')} L to fill them`}
        </p>
      </header>

      {/* Scrolls inside itself rather than growing the page: the order list below is
          the other half of this screen and must stay reachable without paging past
          thirty-eight tanks. */}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {rows.map((row) => {
          const percent = Math.round(row.fraction * 100);
          const tone = BAR_TONE[row.kind ?? 'ok'];

          return (
            <li key={row.id}>
              <Link
                to="/gensets/$gensetId"
                params={{gensetId: row.id}}
                className="flex items-center gap-3 rounded px-2 py-1.5 outline-none hover:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
              >
                <span className="w-28 shrink-0 truncate text-sm text-primary">{row.name}</span>

                {/* The bar is the comparison and the numbers are the booking. The
                    reserve line is drawn on the bar itself rather than stated
                    beside it — a threshold a reader has to hold in their head to
                    use is a threshold that gets misread. */}
                <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-highlight">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${tone}`}
                    style={{width: `${Math.max(1, percent)}%`}}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-px bg-primary/30"
                    style={{left: `${RESERVE_FRACTION * 100}%`}}
                  />
                </span>

                <span className="w-24 shrink-0 text-right text-sm text-primary tabular-nums">
                  {Math.round(row.litres).toLocaleString('en-MY')} L
                </span>
                <span className="w-10 shrink-0 text-right text-sm text-secondary tabular-nums">
                  {percent}%
                </span>
                <span className="hidden w-40 shrink-0 truncate text-xs text-tertiary sm:block">
                  {row.place}
                </span>
                <span className="w-20 shrink-0 text-right text-xs">
                  {row.kind === undefined ? (
                    <span className="text-tertiary">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-secondary">
                      <DropletIcon className="size-3 text-fuel" aria-hidden="true" />
                      {FUEL_LEVEL_LABEL[row.kind]}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
