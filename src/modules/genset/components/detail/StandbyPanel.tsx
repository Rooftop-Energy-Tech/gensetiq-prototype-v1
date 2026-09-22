import {PauseIcon, PowerOffIcon} from 'lucide-react';

import {amount, relativeTime, stampDate} from '@/lib/format';
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
 * ## One figure, and only one
 *
 * The band has no live readings to draw, and the temptation is to backfill it
 * with every quantity that survives a shutdown — coolant, oil, engine hours, the
 * lot. That builds a second dashboard out of the absence of the first one.
 *
 * The panel carries **the starter battery**, because a flat bank is what stops a
 * machine cranking when the pad beside it is pressed.
 *
 * It carried the tank as well until 2026-09-22 — Afifah's call — on the argument
 * that fuel and battery together are the start check. They are, but the tank now
 * has a card of its own two inches to the left with the same figure at the head of
 * it, and repeating it here made the panel look like a summary of a page it sits
 * inside rather than the one thing that page cannot otherwise say.
 *
 * Everything else a stopped controller reports is still on the page — the
 * analysis tab plots it and the Alarms tab lists it under its tag. This band is not the
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

      {battery !== undefined && (
        <div className="border-t border-subtle pt-3">
          {/* The label carries when the figure was taken, because on a stopped set
              it is the one thing the number cannot say for itself: 14.9 V reads the
              same whether it was measured a minute ago or a fortnight. */}
          <Figure
            label={`${battery.label} (${stampDate(genset.lastUpdated)})`}
            value={amount(battery.value, battery.unit, battery.precision)}
            stale={offline}
          />
        </div>
      )}
    </div>
  );
};
