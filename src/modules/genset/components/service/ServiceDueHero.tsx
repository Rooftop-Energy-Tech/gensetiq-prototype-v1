import {cn} from '@/lib/utils';
import {calendarDueDate, counterOvershoot} from '../../types/service.type';
import type {ServiceCounter, ServiceStatus} from '../../types/service.type';
import {stampDate} from '@/lib/format';
import {COUNTER_META, SERVICE_SEVERITY_META} from './serviceMeta';

/**
 * One counter, drawn as a bar with its own scale.
 *
 * Each bar is filled against **its own interval**, which is what lets two
 * quantities that share no unit sit side by side and still be compared at a
 * glance: 90% of 250 hours and 90% of six months are the same distance along,
 * because both are 90% of the way to a service.
 *
 * The bar is capped at full while the figure above it is not. An overdue counter
 * reading `291 h` over a bar pinned at the end says "past it, by this much"; a
 * bar allowed to overflow its track would just look like a rendering bug.
 */
const CounterBar = ({counter, binding}: {counter: ServiceCounter; binding: boolean}) => {
  const meta = COUNTER_META[counter.kind];
  const severity = SERVICE_SEVERITY_META[counter.severity];
  const fraction = counter.interval > 0 ? Math.min(1, counter.elapsed / counter.interval) : 0;

  // Hours are whole; months carry one decimal. A run-hour meter reading "232.4 h"
  // implies a precision the counter does not have, and "5 months" hides the
  // difference between just-serviced and nearly-due.
  const elapsed =
    counter.kind === 'hours'
      ? Math.round(counter.elapsed).toLocaleString('en-MY')
      : counter.elapsed.toFixed(1);

  return (
    <div className="flex min-w-[240px] flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('text-sm', binding ? 'text-primary' : 'text-secondary')}>
          {meta.label}
        </span>
        {binding && (
          <span className={cn('text-xs font-medium', severity.textClassName)}>
            {severity.label}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-2xl font-medium tabular-nums',
            counter.severity === 'OK' ? 'text-primary' : severity.textClassName,
          )}
        >
          {elapsed}
        </span>
        <span className="text-sm text-secondary tabular-nums">
          of {counter.interval.toLocaleString('en-MY')} {meta.unit}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-element">
        <div
          className={cn(
            'h-full rounded-full',
            counter.severity === 'OVERDUE'
              ? 'bg-severity-critical'
              : counter.severity === 'DUE_SOON'
                ? 'bg-severity-warning'
                : 'bg-severity-ok',
          )}
          style={{width: `${fraction * 100}%`}}
        />
      </div>
    </div>
  );
};

/**
 * The head of the Service tab: both counters, and one sentence saying where the
 * unit stands.
 *
 * Both are always shown, at the same size, side by side. That is the whole
 * argument of the feature made visible — a genset is due on whichever comes
 * first, so a layout that promoted one counter and tucked the other underneath
 * would be drawing a policy the fleet does not run on. Only the *emphasis*
 * moves: the binding counter gets the verdict label beside it, because "which of
 * these two is the problem" is a different question from "which of these two
 * matters".
 */
export const ServiceDueHero = ({status}: {status: ServiceStatus}) => {
  if (status.kind === 'never-serviced') {
    return (
      <section
        aria-label="Service status"
        className="flex flex-col gap-2 rounded-lg border border-dashed border-default bg-element px-4 py-4"
      >
        <p className="text-base font-medium text-primary">No service recorded</p>
        <p className="max-w-prose text-sm text-secondary">
          Both counters measure from the last service, so neither can be read until one has
          been logged. This genset is not overdue — it is unmeasured, which is a different
          thing and worth not confusing on a screen somebody makes a call-out from.
        </p>
        <p className="text-sm text-secondary">
          Schedule · every {status.schedule.intervalHours.toLocaleString('en-MY')} run hours or{' '}
          {status.schedule.intervalMonths} months, whichever comes first.
        </p>
      </section>
    );
  }

  const meta = SERVICE_SEVERITY_META[status.severity];
  const Icon = meta.icon;
  const bindingCounter = status.binding === 'hours' ? status.hours : status.calendar;
  const overshoot = counterOvershoot(bindingCounter);
  const dueDate = calendarDueDate(status.lastService, status.schedule);

  /**
   * The sentence under the glyph.
   *
   * It names the counter, because "overdue" on its own sends somebody to look at
   * the wrong number — and on a set overdue by run hours, the calendar counter
   * sitting at two of six months is exactly the reassuring figure that would
   * make them close the page.
   */
  const verdict =
    status.severity === 'OVERDUE'
      ? status.binding === 'hours'
        ? `Overdue by ${Math.round(overshoot).toLocaleString('en-MY')} run hours.`
        : `Overdue by ${overshoot.toFixed(1)} months — due ${stampDate(dueDate.toISOString())}.`
      : status.severity === 'DUE_SOON'
        ? status.binding === 'hours'
          ? `Due in ${Math.round(-overshoot).toLocaleString('en-MY')} run hours.`
          : `Due ${stampDate(dueDate.toISOString())}.`
        : 'Neither counter is near its interval.';

  return (
    <section
      aria-label="Service status"
      className={cn(
        'flex flex-wrap items-center gap-x-10 gap-y-6 rounded-lg border bg-element px-4 py-4',
        meta.borderClassName,
      )}
    >
      {/* The 113px column and 32px glyph the home page's two heroes use, so a
          reader moving between tabs finds the verdict in the same place. */}
      <div className="flex w-[113px] shrink-0 flex-col items-center gap-2">
        <Icon className={cn('size-8', meta.textClassName)} aria-hidden="true" />
        <p className="text-center text-base font-medium text-primary">{meta.label}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-sm text-secondary">{verdict}</p>

        <div className="flex flex-wrap gap-x-10 gap-y-5">
          <CounterBar counter={status.hours} binding={status.binding === 'hours'} />
          <CounterBar counter={status.calendar} binding={status.binding === 'calendar'} />
        </div>
      </div>
    </section>
  );
};
