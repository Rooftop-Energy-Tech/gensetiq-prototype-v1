import type {LucideIcon} from 'lucide-react';
import type {ComponentType, SVGProps} from 'react';

import type {GaugeReading} from '../../types/telemetry.type';

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
 * ## The scale ends go with the needle
 *
 * A dial carried its own range on its face: `45` and `55` either side of the
 * frequency arc, `0` and `8` on the oil. A tile has nowhere to put them, and that is
 * a real loss for one reading of the five — oil pressure is read against its limits
 * rather than as a number in itself. It is stated as a note under the figure where
 * the reading has one, rather than dropped silently.
 */
export const ReadingTile = ({
  reading,
  icon: Icon,
  note,
}: {
  reading: GaugeReading;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  /** The band this figure is healthy in, e.g. `2–8 bar`. */
  note?: string;
}) => (
  <div className="flex w-[132px] shrink-0 flex-col items-center gap-2 text-center">
    {/* 48px, and the tinted square is the reference's. Its saturated violet is not:
        five of those in a row would be the loudest thing on a page whose subject is
        the figures under them. `bg-highlight` carries the same chip shape at the
        weight the rest of this app uses for a raised inner surface. */}
    <span className="flex size-12 items-center justify-center rounded-xl bg-highlight">
      <Icon className="size-6 text-secondary" aria-hidden="true" />
    </span>

    <div className="flex flex-col items-center gap-0.5">
      <p className="text-xs font-medium text-secondary">{reading.label}</p>
      <p className="text-lg font-semibold text-primary tabular-nums">
        {reading.value.toLocaleString('en-MY', {
          minimumFractionDigits: reading.precision ?? 0,
          maximumFractionDigits: reading.precision ?? 0,
        })}
        {reading.unit === '' ? '' : <span className="text-sm text-secondary"> {reading.unit}</span>}
      </p>
      {note !== undefined && <p className="text-xs text-tertiary">{note}</p>}
    </div>
  </div>
);
