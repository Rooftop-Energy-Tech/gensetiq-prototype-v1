import {amount} from '@/lib/format';
import type {AlertSeverity} from '../../types/alert.type';
import {barFill} from './barTone';
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
/**
 * ## Sized for the card, 2026-09-22
 *
 * 8px bars and `text-sm` figures, up from 4px and `text-xs`. The group was drawn at
 * 322px fixed when it sat loose on a full-width band; inside a card that is one
 * third of that band, a 4px rule under 10px units read as a diagram of a chart
 * rather than a chart. The fixed width goes with it — the card decides the width
 * now, and a 322px floor inside a narrower card is what forces a sideways scroll.
 *
 * Units and phase labels drop to `text-secondary`. At the larger size three columns
 * of equally solid text made the figure compete with the `V` beside it; the figure
 * is the reading and the other two say what it is.
 */
export const PhaseBars = ({
  group,
  severities,
}: {
  group: PhaseGroup;
  /** Worst alarm per reading key, for colouring a phase that is out on its own. */
  severities?: ReadonlyMap<string, AlertSeverity>;
}) => (
  <div className="flex min-w-0 flex-col gap-2">
    <p className="text-sm font-medium text-primary">{group.label}</p>

    <div className="flex flex-col gap-1">
      {group.channels.map((channel) => {
        const fraction = Math.min(1, Math.max(0, channel.value / group.scale));

        return (
          <div key={channel.key} className="flex items-center gap-5">
            <div
              className="h-2 flex-1 overflow-hidden rounded-sm bg-tertiary"
              role="meter"
              aria-valuenow={channel.value}
              aria-valuemin={0}
              aria-valuemax={group.scale}
              aria-label={`${group.label} ${channel.label}`}
            >
              <div
                className={`h-full rounded-sm ${barFill(severities?.get(channel.key))}`}
                style={{width: `${fraction * 100}%`}}
              />
            </div>

            <div className="flex w-[64px] items-center gap-1 whitespace-nowrap">
              <span className="text-sm font-semibold text-primary">
                {amount(channel.value, '')}
              </span>
              <span className="text-xs font-medium text-secondary">{group.unit}</span>
            </div>

            <span className="w-[64px] text-sm font-medium text-secondary">{channel.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);
