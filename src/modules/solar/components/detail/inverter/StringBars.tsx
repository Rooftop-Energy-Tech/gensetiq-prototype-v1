import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {StringReading} from '../../../types/reading.type';

/**
 * Every string on one inverter against one scale — the box's answer to `PhaseBars`.
 *
 * The argument is the one `PhaseBars` makes and it is stronger here. Three phase
 * currents are drawn as bars because an *imbalance* is a fault you can see before
 * you read a number; six string currents are drawn as bars because a **dead
 * string is a bar of zero length**, and that is visible from across a room in a
 * way "String 5 — 0.0 A" in a list of six rows is not.
 *
 * Scoped to a box rather than to the whole system, because that is where a string
 * physically lands: on one of an inverter's MPPT inputs. On a ten-inverter plant
 * a single chart of a hundred and thirty strings would be a texture, and the one
 * that matters is the thirteen on the box that is short.
 *
 * A string that is down is marked as well as short, in the severity colour rather
 * than the teal. Length alone would be ambiguous at dusk, when every bar is short
 * and none of them is broken — which is the reason the whole group is withheld
 * after dark rather than drawn empty. See `InverterPage`.
 *
 * Zero-based, like the phase bars, and here it costs nothing: the comparison this
 * drawing exists to make is against zero.
 */
export const StringBars = ({strings}: {strings: Array<StringReading>}) => {
  const scale = Math.max(...strings.map((one) => one.amps), 1);

  return (
    <div className="flex w-[322px] shrink-0 flex-col gap-2">
      <p className="text-xs font-medium text-primary">String currents</p>

      <div className="flex flex-col gap-1">
        {strings.map((one) => {
          const fraction = Math.min(1, Math.max(0, one.amps / scale));

          return (
            <div key={one.label} className="flex items-center gap-5">
              <div
                className="h-1 flex-1 overflow-hidden rounded-sm bg-tertiary"
                role="meter"
                aria-valuenow={one.amps}
                aria-valuemin={0}
                aria-valuemax={scale}
                aria-label={`${one.label}${one.down ? ', offline' : ''}`}
              >
                <div
                  className={cn('h-full rounded-sm', one.down ? 'bg-severity-critical' : 'bg-teal')}
                  // A dead string still draws a sliver, so the row reads as a
                  // measurement of nothing rather than as a missing bar.
                  style={{width: `${Math.max(fraction, one.down ? 0.02 : 0) * 100}%`}}
                />
              </div>

              <div className="flex w-[50px] items-center gap-0.5 whitespace-nowrap">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    one.down ? 'text-severity-critical' : 'text-primary',
                  )}
                >
                  {amount(one.amps, '', 1)}
                </span>
                <span className="text-[10px] font-medium text-primary">A</span>
              </div>

              <span className="w-[62px] text-xs font-medium text-primary">{one.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
