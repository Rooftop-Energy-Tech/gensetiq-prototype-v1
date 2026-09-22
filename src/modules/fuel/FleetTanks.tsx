import {useMemo} from 'react';
import {Link} from '@tanstack/react-router';
import {DropletIcon} from 'lucide-react';

import {gensetById} from '@/modules/genset/data/deployment';
import {GENSETS} from '@/modules/genset/data/fleet';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {
  FUEL_LEVEL_LABEL,
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
      <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        {rows.map((row) => {
          const percent = Math.round(row.fraction * 100);
          const tone = BAR_TONE[row.kind ?? 'ok'];

          return (
            <li key={row.id}>
              <Link
                to="/gensets/$gensetId"
                params={{gensetId: row.id}}
                className="flex items-center gap-3 rounded px-2 py-1 outline-none hover:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
              >
                <span className="w-28 shrink-0 truncate text-sm text-primary">{row.name}</span>

                {/* The bar carries all three numbers, which is the point of drawing
                    one: what is in the tank sits over the end of the fill, what the
                    tank holds sits at the end of the track, and the half-tank line is
                    drawn between them. A reader gets level, capacity and the
                    threshold in one glance without matching a figure to a column.

                    `pt-4` rather than a taller bar: the floating figure needs the
                    room above the track, and the track itself stays 8px so thirty
                    eight of these still fit a scroll pane. */}
                <span className="relative min-w-0 flex-1 pt-4">
                  {/* Pinned to the end of the coloured fill and centred on it, so it
                      travels with the level. Clamped away from both ends — at 2% the
                      label would hang off the left of the track and at 100% off the
                      right, and a number half outside its own row reads as belonging
                      to the one beside it. */}
                  <span
                    className="absolute top-0 -translate-x-1/2 text-xs whitespace-nowrap text-primary tabular-nums"
                    style={{left: `${Math.min(92, Math.max(8, percent))}%`}}
                  >
                    {Math.round(row.litres).toLocaleString('en-MY')} L
                  </span>

                  <span className="relative block h-2 overflow-hidden rounded-full bg-highlight">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${tone}`}
                      style={{width: `${Math.max(1, percent)}%`}}
                    />
                    {/* Half a tank. Not the 30% reserve line this drew until
                        2026-09-22 — Afifah's call. Half is the figure an operations
                        room actually plans a tanker round against: a set past it has
                        used more than it has left, which is the moment to book rather
                        than the moment to scramble. The reserve line has not gone
                        anywhere — it is still what `fuelLevelKind` colours the fill
                        by, so a bar past this mark is not yet a bar painted low. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 w-px bg-primary/30"
                      style={{left: '50%'}}
                    />
                  </span>
                </span>

                {/* The tank, not what is left in it. The level is on the bar now, and
                    two litre figures a column apart were read as a pair to subtract. */}
                <span className="w-24 shrink-0 text-right text-sm text-secondary tabular-nums">
                  {Math.round(row.capacityLitres).toLocaleString('en-MY')} L
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
