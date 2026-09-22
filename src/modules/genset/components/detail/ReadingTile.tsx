import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import type {ComponentType, SVGProps} from 'react';


/**
 * One live reading as a mark, a name and a figure — the reference controller's
 * treatment, in place of the dial that drew the same reading until 2026-09-22.
 *
 * ## What a dial was doing, and what it was not
 *
 * A needle earns its place where the *position* carries meaning a figure cannot:
 * how close to a limit, which way it is moving. On this band it rarely did. Four of
 * the five readings sit at their nominal almost always — a governor holds 50.0 Hz, a
 * charging circuit holds 29.4 V — so the needle stood still and the reader took the
 * number off the middle of the face anyway. What identifies a reading in a row of
 * five is *which one it is*, and a dial answers that with a caption underneath,
 * which is exactly as slow to read as a label.
 *
 * A mark answers it by shape. Oil, coolant, battery and load are four different
 * pictures, and after a day of use a reader finds the one they want without reading
 * anything at all — which is the reference UI's argument, and it is a good one.
 *
 * ## Not only live readings
 *
 * It takes a formatted string rather than a `Reading`, because two of the tiles on
 * this band are not readings at all: running hours is a counter and hours on the
 * current deployment is arithmetic over a window. A tile that only accepted the
 * controller's own shape would have sent those two back to a list, which is the
 * arrangement they were pulled out of.
 *
 * ## The scale ends go with the needle
 *
 * A dial carried its own range on its face: `45` and `55` either side of the
 * frequency arc, `0` and `8` on the oil. A tile has nowhere to put them, and that is
 * a real loss for one reading of the five — oil pressure is read against its limits
 * rather than as a number in itself. It is stated as a note under the figure where
 * the reading has one, rather than dropped silently.
 */
/**
 * How a mark is coloured: by the worst alarm standing against its own reading.
 *
 * Green for nothing standing, amber for a warning, red for a critical. The same
 * three tokens the alarm chips use, so a reader who sees a red oil mark and a red
 * chip in the band below is looking at one fault stated twice rather than two.
 *
 * `NEUTRAL` is an alert severity but not a colour here: an informational bit
 * standing against a reading is not a reason to stop calling that reading healthy.
 * It falls through to the green.
 */
const TONE: Record<string, {icon: string; chip: string}> = {
  CRITICAL: {icon: 'text-severity-critical', chip: 'bg-severity-critical/10'},
  WARNING: {icon: 'text-severity-warning', chip: 'bg-severity-warning/10'},
  OK: {icon: 'text-severity-ok', chip: 'bg-severity-ok/10'},
};

export const ReadingTile = ({
  label,
  value,
  unit,
  icon: Icon,
  note,
  severity,
}: {
  label: string;
  /** Pre-formatted: the caller knows its own precision, and `Not deployed` is a
   *  legitimate value for a tile whose figure does not exist. */
  value: string;
  unit?: string;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  /** The band this figure is healthy in, e.g. `2–8 bar`. */
  note?: string;
  /**
   * The worst alarm standing against this reading, if any. `undefined` on a tile
   * whose figure no rule watches — a counter, say — which reads as healthy rather
   * than as unknown, because there is nothing about it that could be unhealthy.
   */
  severity?: 'CRITICAL' | 'WARNING' | 'NEUTRAL';
}) => {
  const tone = TONE[severity === 'CRITICAL' || severity === 'WARNING' ? severity : 'OK'];

  return (
  <div className="flex w-[132px] shrink-0 flex-col items-center gap-2 text-center">
    {/* 48px, and the tinted square is the reference's. Its saturated violet is not:
        five of those in a row would be the loudest thing on a page whose subject is
        the figures under them. `bg-highlight` carries the same chip shape at the
        weight the rest of this app uses for a raised inner surface. */}
    <span className={cn('flex size-12 items-center justify-center rounded-xl', tone.chip)}>
      <Icon className={cn('size-6', tone.icon)} aria-hidden="true" />
    </span>

    <div className="flex flex-col items-center gap-0.5">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className="text-lg font-semibold text-primary tabular-nums">
        {value}
        {unit === undefined || unit === '' ? null : (
          <span className="text-sm text-secondary"> {unit}</span>
        )}
      </p>
      {note !== undefined && <p className="text-xs text-tertiary">{note}</p>}
    </div>
  </div>
  );
};
