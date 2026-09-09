import {cn} from '@/lib/utils';
import type {SiteTrend} from '../data/siteTrend';

/**
 * The bank's day as one line — see `SiteTrend.flow` for the model.
 *
 * A marker stands where the day began; everything the bank gave the tower lies
 * to its left in the bank's own blue, everything that refilled it lies to its
 * right in the colour of whoever supplied it, and the right end is where the
 * bank stands now. The lengths are points of capacity, so the picture *is* the
 * arithmetic: initial − discharged + charged = current.
 *
 * The legend mirrors the track's widths the way `ShareBar`'s does, so each
 * figure sits under the movement it prices.
 */
export const BatteryFlowBar = ({flow}: {flow: NonNullable<SiteTrend['flow']>}) => {
  const inPct = flow.in.reduce((total, segment) => total + segment.pct, 0);
  const span = flow.out.pct + inPct;
  if (span <= 0) return null;

  const widthOf = (pct: number): string => `${(pct / span) * 100}%`;

  return (
    // One grid, so the track row and the legend row share their right column —
    // the `Now` figure sizes it for both, and each legend cell stays exactly
    // under its segment.
    <div className="mt-3 grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2.5">
      {/* Room above the track for the initial-SoC marker's label. */}
      <div className="pt-5">
        <div className="flex h-7 w-full items-stretch">
          {flow.out.pct > 0 && (
            <div
              className={cn(
                'flex items-center justify-center overflow-hidden rounded-l-full bg-current opacity-50',
                flow.out.token,
              )}
              style={{width: widthOf(flow.out.pct)}}
            >
              {flow.out.pct / span >= 0.15 && (
                <span className="truncate px-2 text-xs font-medium whitespace-nowrap text-white tabular-nums">
                  {flow.out.label} · {flow.out.pct}%
                </span>
              )}
            </div>
          )}

          {/* Where the day began. The label rides above the marker so the track
              itself stays unbroken movement. */}
          <div className="relative w-[3px] shrink-0 bg-current text-primary">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-secondary tabular-nums">
              Initial · {flow.initialPct}% ({flow.initialEnergy})
            </span>
          </div>

          {flow.in.map((segment, index) => (
            <div
              key={segment.label}
              className={cn(
                'flex items-center justify-center overflow-hidden bg-current',
                index === flow.in.length - 1 && 'rounded-r-full',
                segment.token,
              )}
              style={{width: widthOf(segment.pct)}}
            >
              {segment.pct / span >= 0.15 && (
                <span className="truncate px-2 text-xs font-medium whitespace-nowrap text-white tabular-nums">
                  {segment.label} · {segment.pct}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Where the bank stands now — the level the movement landed on. */}
      <span className="pb-1 text-sm whitespace-nowrap text-tertiary tabular-nums">
        Now · <span className="text-primary">{flow.endPct}%</span> ({flow.endEnergy})
      </span>

      <div className="min-w-0 whitespace-nowrap text-sm">
        <div className="flex w-full">
          {flow.out.pct > 0 && (
            <div style={{width: widthOf(flow.out.pct), minWidth: 'fit-content'}} className="pr-3">
              <span className={cn('flex items-center gap-1.5', flow.out.token)}>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-current opacity-50"
                  aria-hidden="true"
                />
                <span className="text-tertiary">
                  {flow.out.label} ·{' '}
                  <span className="text-primary tabular-nums">{flow.out.energy}</span>
                </span>
              </span>
            </div>
          )}
          <div className="w-[3px] shrink-0" />
          {flow.in.map((segment) => (
            <div
              key={segment.label}
              style={{width: widthOf(segment.pct), minWidth: 'fit-content'}}
              className="pr-3"
            >
              <span className={cn('flex items-center gap-1.5', segment.token)}>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-current"
                  aria-hidden="true"
                />
                <span className="text-tertiary">
                  {segment.label} ·{' '}
                  <span className="text-primary tabular-nums">{segment.energy}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
