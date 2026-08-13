import {amount} from '@/lib/format';
import type {PhaseGroup} from '../../types/telemetry.type';

/**
 * Three bars against one scale — the line voltages, or the phase currents.
 *
 * The value of drawing these as bars rather than three rows of text is entirely
 * in the comparison: an imbalance across the phases is a real fault (a dropped
 * conductor, an unbalanced load) and it is visible here as three bars of
 * different lengths before anybody reads a number. The figures are still there to
 * the right, because the bar tells you *that* they differ and only the number
 * tells you by how much.
 *
 * Both groups are drawn from zero, which the design does too. It costs some
 * sensitivity — a healthy set puts all three bars at much the same length — and
 * the alternative (centring each bar on nominal) would exaggerate a 2 V spread
 * into something alarming. Zero-based understates; centred overstates. For a
 * screen watched all day, understating is the safer error.
 */
export const PhaseBars = ({group}: {group: PhaseGroup}) => (
  <div className="flex w-[322px] shrink-0 flex-col gap-2">
    <p className="text-xs font-medium text-primary">{group.label}</p>

    <div className="flex flex-col gap-1">
      {group.channels.map((channel) => {
        const fraction = Math.min(1, Math.max(0, channel.value / group.scale));

        return (
          <div key={channel.key} className="flex items-center gap-5">
            <div
              className="h-1 flex-1 overflow-hidden rounded-sm bg-tertiary"
              role="meter"
              aria-valuenow={channel.value}
              aria-valuemin={0}
              aria-valuemax={group.scale}
              aria-label={`${group.label} ${channel.label}`}
            >
              <div className="h-full rounded-sm bg-teal" style={{width: `${fraction * 100}%`}} />
            </div>

            <div className="flex w-[50px] items-center gap-0.5 whitespace-nowrap">
              <span className="text-xs font-semibold text-primary">
                {amount(channel.value, '')}
              </span>
              <span className="text-[10px] font-medium text-primary">{group.unit}</span>
            </div>

            <span className="w-[50px] text-xs font-medium text-primary">{channel.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);
