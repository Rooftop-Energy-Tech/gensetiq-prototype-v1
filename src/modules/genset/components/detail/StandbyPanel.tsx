import {PauseIcon, PowerOffIcon} from 'lucide-react';

import {amount, fuelHeadline, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {Genset} from '../../types/genset.type';
import type {Reading} from '../../types/telemetry.type';

/** One standby figure. Label over value — quieter than `MetricRow`'s ruled row. */
const Figure = ({label, value, stale}: {label: string; value: string; stale: boolean}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="truncate text-xs font-medium text-secondary">{label}</span>
    <span
      className={cn(
        'text-sm font-semibold whitespace-nowrap',
        stale ? 'text-secondary' : 'text-primary',
      )}
    >
      {value}
    </span>
  </div>
);

/**
 * What band 2 shows when the engine is not turning.
 *
 * ## Two figures, and only two
 *
 * The band has no live readings to draw, and the temptation is to backfill it
 * with every quantity that survives a shutdown — coolant, oil, engine hours, the
 * lot. That builds a second dashboard out of the absence of the first one.
 *
 * The panel carries **the tank and the starter battery** instead, because those
 * are the two things that decide whether the machine will actually crank when the
 * pad beside it is pressed. Fuel is deliberately repeated from the strip at the
 * top of the page: up there it is one of three summary figures, here it is half
 * of a start check, and a reader looking at a stopped set should not have to
 * scroll back up to find out whether starting it is possible.
 *
 * Everything else a stopped controller reports is still on the page — the
 * analysis tab plots it and band 6 lists it under its tag. This band is not the
 * place for it.
 *
 * ## The two states are not the same absence
 *
 * `IDLE` is a healthy set at rest: the tank is the tank and the battery is being
 * measured now. `OFFLINE` is a panel that has stopped talking, so the same two
 * numbers are the last ones it sent, of stated age — the sentence gives that age
 * and the values drop to secondary text, because printing a two-day-old battery
 * voltage in the same weight as a live one is the kind of quiet lie a dashboard
 * should never tell.
 */
export const StandbyPanel = ({
  genset,
  readings,
  now,
}: {
  genset: Genset;
  readings: Record<string, Reading>;
  now: number;
}) => {
  const offline = genset.runState === 'OFFLINE';
  const Icon = offline ? PowerOffIcon : PauseIcon;
  const battery = readings['battery-voltage'];

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-md border border-default bg-element px-4 py-4 md:max-w-[360px] md:flex-1">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            offline ? 'bg-status-offline/12' : 'bg-status-idle/12',
          )}
        >
          <Icon
            className={cn('size-5', offline ? 'text-status-offline' : 'text-status-idle')}
            aria-hidden="true"
          />
        </span>

        <p className="min-w-0 pt-1.5 text-sm text-secondary">
          {offline
            ? `Genset not reporting — last message ${relativeTime(genset.lastUpdated, now)}.`
            : 'Genset not running, no live data available.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 border-t border-subtle pt-3">
        <Figure
          label="Fuel level"
          value={fuelHeadline(genset.fuelLitres, genset.fuelCapacityLitres)}
          stale={offline}
        />
        {battery !== undefined && (
          <Figure
            label={battery.label}
            value={amount(battery.value, battery.unit, battery.precision)}
            stale={offline}
          />
        )}
      </div>
    </div>
  );
};
