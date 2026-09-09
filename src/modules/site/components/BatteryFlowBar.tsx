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
    <div className="mt-3 flex max-w-2xl flex-col gap-2.5">
      {/* Room above the track for the initial-SoC marker's label. */}
      <div className="flex w-full items-end gap-3 pt-5">
        <div className="flex h-7 min-w-0 flex-1 items-stretch">
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
              Initial · {flow.initialPct}%
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

        {/* Where the bank stands now — the end the movement adds up to. */}
        <span className="shrink-0 text-sm text-tertiary tabular-nums">
          Now · <span className="text-primary">{flow.endPct}%</span>
        </span>
      </div>

      <div className="flex w-full items-center gap-3 whitespace-nowrap text-sm">
        <div className="flex min-w-0 flex-1">
          {flow.out.pct > 0 && (
            <div style={{width: widthOf(flow.out.pct)}}>
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
            <div key={segment.label} style={{width: widthOf(segment.pct)}}>
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
