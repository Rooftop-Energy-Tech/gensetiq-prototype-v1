import {cn} from '@/lib/utils';
import {calendarDueDate, counterOvershoot} from '../../types/service.type';
import type {ServiceCounter, ServiceStatus} from '../../types/service.type';
import {stampDate} from '@/lib/format';
import {COUNTER_META, SERVICE_SEVERITY_META} from './serviceMeta';

/**
 * Ring geometry, in viewBox units that happen to be the rendered pixels.
 *
 * The inner hole is `2 × (RADIUS − STROKE / 2)` = 84px, which is what sizes the
 * whole thing: the figure and its `of 250 h` have to sit inside it at a legible
 * size, and a ring drawn small enough to need the number outside it has given
 * away the only thing a donut has over the bar it replaced.
 */
const SIZE = 112;
const CENTRE = SIZE / 2;
const RADIUS = 47;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The lap ring: thinner, inset, concentric — see `CounterDonut` for why it exists.
 */
const LAP_RADIUS = 35;
const LAP_STROKE = 5;
const LAP_CIRCUMFERENCE = 2 * Math.PI * LAP_RADIUS;

/**
 * One counter, drawn as a ring filled against its own interval.
 *
 * Each ring is filled against **its own interval**, which is what lets two
 * quantities that share no unit sit side by side and still be compared at a
 * glance: 90% of 250 hours and 90% of six months are the same distance round,
 * because both are 90% of the way to a service.
 *
 * ## Why a ring rather than the bar this replaced
 *
 * The bar spent its width on a quantity that is never more than a fraction and
 * left the figure stranded above it, so each counter needed 240px and the pair
 * ran the width of the band. A ring closes the same fraction into a shape whose
 * middle is empty, and the figure goes in the middle — one puck per counter,
 * self-contained, and the two sit together at a size where the *shapes* can be
 * compared before either number is read. Which is the question the tab opens
 * with: not "what are these two numbers" but "is either of them nearly round".
 *
 * ## The lap
 *
 * A bar past its interval can be pinned at the end and read as "past it". A ring
 * cannot: a full circle is a full circle, and a set 1% over would draw exactly
 * what a set 60% over draws. So the overshoot **goes round again** — a second,
 * thinner arc inside the first, starting from twelve o'clock, filled with
 * whatever is past the interval.
 *
 * That is not a decoration standing in for the overflow; on the hours counter it
 * is literally what happened. A set at 291 of 250 hours has run its interval and
 * started into the next one, and the inner arc is how far into it. The figure in
 * the middle still reads `291`, uncapped, because the ring says *past* and only
 * the number says *by how much*.
 *
 * A second lap is not drawn. A set two intervals overdue is a different
 * conversation from a screen, and drawing a third ring would be building for a
 * fleet nobody should be running.
 */
const CounterDonut = ({counter, binding}: {counter: ServiceCounter; binding: boolean}) => {
  const meta = COUNTER_META[counter.kind];
  const severity = SERVICE_SEVERITY_META[counter.severity];
  const fraction = counter.interval > 0 ? counter.elapsed / counter.interval : 0;
  const filled = Math.min(1, Math.max(0, fraction));
  const lapped = Math.min(1, Math.max(0, fraction - 1));

  // Hours are whole; months carry one decimal. A run-hour meter reading "232.4 h"
  // implies a precision the counter does not have, and "5 months" hides the
  // difference between just-serviced and nearly-due.
  const elapsed =
    counter.kind === 'hours'
      ? Math.round(counter.elapsed).toLocaleString('en-MY')
      : counter.elapsed.toFixed(1);

  const scale = `${counter.interval.toLocaleString('en-MY')} ${meta.unit}`;

  return (
    <div className="flex w-[152px] flex-col items-center gap-2.5">
      <div className="relative size-28 shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block size-full"
          role="img"
          aria-label={`${meta.label}: ${elapsed} of ${scale} — ${severity.label.toLowerCase()}`}
        >
          {/* Rotated so the fill starts at twelve o'clock and runs clockwise,
              which is the direction a reader already expects a dial to fill. */}
          <g transform={`rotate(-90 ${CENTRE} ${CENTRE})`}>
            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              stroke="currentColor"
              // The ring a reader measures the fill against. It was `text-element`
              // — the card's own surface — so on a card it was invisible and the
              // dial read as a bare arc floating in space: no way to see how much
              // of the interval is left, which is the whole question the dial
              // answers. `tertiary` is what the phase bars and the tank glyph use
              // for the part that is not filled, so the three agree.
              className="text-tertiary"
            />

            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE * filled} ${CIRCUMFERENCE}`}
              stroke="currentColor"
              className={severity.textClassName}
            />

            {lapped > 0 && (
              <circle
                cx={CENTRE}
                cy={CENTRE}
                r={LAP_RADIUS}
                fill="none"
                strokeWidth={LAP_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${LAP_CIRCUMFERENCE * lapped} ${LAP_CIRCUMFERENCE}`}
                stroke="currentColor"
                className={severity.textClassName}
              />
            )}
          </g>
        </svg>

        {/* Absolutely centred rather than SVG `<text>`, the way `TickGauge` puts
            its reading inside the dial: the type tokens are Tailwind's, and a
            number drawn in SVG would be the one figure on the page that does not
            get them. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span
            className={cn(
              'text-2xl leading-none font-medium tabular-nums',
              counter.severity === 'OK' ? 'text-primary' : severity.textClassName,
            )}
          >
            {elapsed}
          </span>
          <span className="text-[11px] text-secondary tabular-nums">of {scale}</span>
        </div>
      </div>

      {/* The counter's name, and nothing under it. The binding counter used to
          carry the severity label here — `In service`, `Due soon`, `Overdue` — and
          it was the same word the verdict column is already printing 113px to the
          left, in every state: `status.severity` *is* the binding counter's
          severity, by the definition of `binding` in `service.type.ts`. Two
          printings of one word, one of them under a ring already drawn in that
          severity's colour. Removed 2026-09-14 (Tristan).

          `binding` still decides this line's *weight*, which is the distinction
          that was doing work: which of the two counters the verdict is about. */}
      <span className={cn('text-center text-sm', binding ? 'text-primary' : 'text-secondary')}>
        {meta.label}
      </span>
    </div>
  );
};

/**
 * The head of the Service tab: both counters, and — when there is something to
 * say — one sentence saying where the unit stands.
 *
 * Both are always shown, at the same size, side by side. That is the whole
 * argument of the feature made visible — a genset is due on whichever comes
 * first, so a layout that promoted one counter and tucked the other underneath
 * would be drawing a policy the fleet does not run on. Which is also why the two
 * rings are separate and equal rather than concentric: nesting them is the
 * obvious thing to do with two rings and it would silently make one of the
 * counters the outer, larger, first-read one.
 *
 * Only the *emphasis* moves: the binding counter's name is set in the primary ink
 * and the other's in the secondary, because "which of these two is the problem" is
 * a different question from "which of these two matters".
 *
 * ## The band says each thing once
 *
 * Two labels came off it on 2026-09-14. The binding counter carried the severity
 * **word** under its ring, which the verdict column beside it was already printing;
 * and a healthy set carried the sentence *"Neither counter is near its interval."*,
 * which two green part-filled rings had already said. Both are noted where they
 * stood. What is left is: the glyph and the word on the left, the figures that are
 * only stated here in the middle, and the rings.
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
   * The sentence under the glyph — **when there is one**.
   *
   * It names the counter, because "overdue" on its own sends somebody to look at
   * the wrong number — and on a set overdue by run hours, the calendar counter
   * sitting at two of six months is exactly the reassuring figure that would
   * make them close the page.
   *
   * `undefined` at `OK`, where it used to read *"Neither counter is near its
   * interval."* (removed 2026-09-14, Tristan). That sentence was the one state in
   * which the line carried nothing: two rings drawn a fifth of the way round, in
   * green, under a heading that already says `In service`, do not need a sentence
   * to say they are not nearly full. The other two states are the opposite — the
   * overshoot and the due date are quantities nothing else on this page states —
   * so they keep the line.
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
        : undefined;

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
        {verdict !== undefined && <p className="text-sm text-secondary">{verdict}</p>}

        <div className="flex flex-wrap gap-x-6 gap-y-5">
          <CounterDonut counter={status.hours} binding={status.binding === 'hours'} />
          <CounterDonut counter={status.calendar} binding={status.binding === 'calendar'} />
        </div>
      </div>
    </section>
  );
};
