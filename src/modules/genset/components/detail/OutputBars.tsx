import {amount} from '@/lib/format';
import type {AlertSeverity} from '../../types/alert.type';
import {barFill} from './barTone';

/**
 * Power factor, frequency, load and active power as bars, under the phase groups.
 *
 * ## Why these four are drawn and not simply listed
 *
 * Each is read against a range rather than as a number in itself. A power factor is
 * only meaningful against unity; a frequency against nominal; a load against the
 * nameplate it is a share of. A bar states the range by existing, which is the one
 * thing the figure alone cannot, and it puts these four in the same visual sentence
 * as the phases above them — the whole column then answers one question: what is
 * coming out of this machine, and how close to its limits.
 *
 * ## Each line carries its own scale, which `PhaseGroup` cannot
 *
 * Three phases share a scale because they are three measurements of one quantity;
 * that is what makes a group. These four are four quantities, so the range travels
 * with the line rather than with the group.
 *
 * **Frequency's bar starts at 45, not 0.** A 0–55 bar would sit at 91% for every
 * healthy set on the estate and move by a pixel when a governor drooped 2 Hz — the
 * fault the bar exists to show. The other three start at zero, where zero is a real
 * reading: a set can genuinely deliver no power.
 */

export type OutputLine = {
  label: string;
  value: number;
  unit: string;
  /** Bottom of the bar. Zero unless the working band makes zero meaningless. */
  min: number;
  max: number;
  /** Decimal places, where the figure needs them. */
  precision?: number;
  /** The worst alarm standing against the reading this line draws, if any. */
  severity?: AlertSeverity;
};

export const OutputBars = ({lines}: {lines: ReadonlyArray<OutputLine>}) => (
  <div className="flex min-w-0 flex-col gap-2">
    <p className="text-sm font-medium text-primary">Output</p>

    <div className="flex flex-col gap-1">
      {lines.map((line) => {
        const span = line.max - line.min;
        const fraction = span > 0 ? Math.min(1, Math.max(0, (line.value - line.min) / span)) : 0;

        return (
          <div key={line.label} className="flex items-center gap-5">
            <div
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-tertiary"
              role="meter"
              aria-valuenow={line.value}
              aria-valuemin={line.min}
              aria-valuemax={line.max}
              aria-label={line.label}
            >
              <div
                className={`h-full rounded-sm ${barFill(line.severity)}`}
                style={{width: `${fraction * 100}%`}}
              />
            </div>

            <div className="flex w-[64px] items-center gap-1 whitespace-nowrap">
              <span className="text-sm font-semibold text-primary">
                {amount(line.value, '', line.precision)}
              </span>
              <span className="text-xs font-medium text-secondary">{line.unit}</span>
            </div>

            <span className="w-[64px] truncate text-sm font-medium text-secondary">{line.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);
