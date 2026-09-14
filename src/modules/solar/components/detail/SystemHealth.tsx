import {BellIcon, CircleCheckIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, relativeTime, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META, SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {SystemAlert, SystemCondition} from '../../types/health.type';
import type {SystemReading} from '../../types/reading.type';

/**
 * A rule, its verdict, and where the claim came from.
 *
 * Every card prints its `source`, and that is the one thing here worth defending.
 * A genset's alert card prints its Modbus register and bit, and `AlertsSection`
 * explains why: a reader has to be able to tell at a glance which rows are the
 * panel talking and which are the app's own arithmetic. A PV system has no
 * register sheet, and some of these rules are this app reasoning over months
 * nothing on a roof can see. `Telemetry` / `Generation series` / `Service
 * schedule` in the corner is doing the register's job.
 *
 * A card used to lead with the **box's name** wherever there was one, because on
 * a ten-inverter plant "String offline" was an alert nobody could act on and
 * "Inverter 4 · String offline" was a job with an address. There are no boxes on
 * a telco site, so the name is gone and the alert says how many strings of how
 * many instead — the address is the site, and the reader is already on its page.
 */
const AlertCard = ({alert}: {alert: SystemAlert}) => {
  const meta = SEVERITY_META[alert.severity];

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-md border bg-element px-3 py-2.5',
        alert.severity === 'CRITICAL'
          ? 'border-severity-critical/40'
          : alert.severity === 'WARNING'
            ? 'border-severity-warning/40'
            : 'border-subtle',
      )}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <Badge variant="element" size="md" className="border-subtle">
          <BellIcon className={meta.textClassName} aria-hidden="true" />
          {alert.name}
        </Badge>
        <p className="min-w-0 flex-1 text-sm text-primary">{alert.message}</p>
        <p className="ml-auto shrink-0 text-xs text-secondary">{alert.source}</p>
      </div>

      <p className="text-xs text-tertiary">
        {alert.threshold} · since {stampDate(alert.raisedAt)}
      </p>
    </div>
  );
};

/**
 * One reading and its number.
 *
 * A reading sits next to an alert for the genset page's reason: `Days since last
 * clean 121 days` is what makes `Wash overdue` checkable rather than something to
 * be taken on trust. Readings with a rule watching them take the rule's colour;
 * the rest are neutral, because a page where every number is coloured is a page
 * where none of them is.
 */
const ReadingRow = ({
  reading,
  alerted,
  daylight,
}: {
  reading: SystemReading;
  alerted: boolean;
  daylight: boolean;
}) => (
  <div className="flex w-full items-center justify-between gap-4 text-sm">
    <span className="min-w-0 flex-1 truncate text-secondary">{reading.label}</span>
    <span
      className={cn(
        'shrink-0 tabular-nums whitespace-nowrap',
        alerted ? 'text-severity-warning' : 'text-primary',
      )}
    >
      {/* An em dash, not a zero, in two cases and for one reason — the figure does
          not exist rather than being low.

          A quantity that needs sun is not low at midnight, it is absent; the earth
          turned. And a `withheld` figure is one the model declined to publish
          because nobody heard the plant it would have been measured from — see
          `SystemReading`. Printing `0.00` for either would be this app inventing a
          measurement and then colouring it neutral. */}
      {reading.withheld || (reading.daylightOnly && !daylight)
        ? '—'
        : amount(reading.value, reading.unit, reading.precision)}
    </span>
  </div>
);

/**
 * The health band — what is wrong, and the numbers behind it.
 *
 * It takes alerts and readings rather than reaching for them, which is what it
 * was built for: the band was shared between the system's page and each
 * inverter's, and a box passed only the rules that named it. The inverter pages
 * are gone and the system is the only caller left, but the props stay — one
 * rendering that cannot read differently depending on which page you met it on is
 * worth more than the two lines saving them would buy.
 *
 * The genset's alerts band without its filing system. No tag chips and no
 * severity chips, and their absence is a decision rather than an omission: a
 * genset carries thirty-odd alarms across ten operator-defined tags, and the
 * chips exist to narrow that. A solar system has three rules. A filter over three
 * rows costs a click to do nothing and makes this look like a bigger page than it
 * is. Both bands sit on their asset's Alarms tab now, over the tables that carry
 * the registers; when array alarms become a real set the chips come back.
 */
export const SystemHealth = ({
  alerts,
  condition,
  readings,
  daylight,
  lastUpdated,
  now,
  heading = 'Readings',
}: {
  alerts: Array<SystemAlert>;
  condition: SystemCondition;
  readings: Array<SystemReading>;
  /** Whether the sun is up — decides what a `daylightOnly` reading prints. */
  daylight: boolean;
  lastUpdated: string;
  now: number;
  heading?: string;
}) => {
  const meta = CONDITION_META[condition];
  const alertedKeys = new Set(
    alerts.map((alert) => alert.readingKey).filter((key): key is string => key !== null),
  );

  return (
    <section
      aria-label="Health"
      // Band 1's hero geometry repeated exactly, the way `AlertsSection` repeats
      // it: the same 113px column and the same 32px glyph, so the page's two big
      // marks — "what is it doing" and "how is it" — sit on one vertical line.
      className="flex flex-col gap-2.5 py-4 pl-0 md:flex-row md:pl-3"
    >
      <div className="flex shrink-0 flex-row items-center gap-2 md:w-[113px] md:flex-col md:pt-4">
        <meta.icon className={cn('size-8', meta.textClassName)} aria-hidden="true" />
        <p className="text-base font-medium text-primary md:text-center">{meta.label}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-subtle bg-element px-3 py-2.5">
              <CircleCheckIcon className="size-4 shrink-0 text-severity-ok" aria-hidden="true" />
              <p className="text-sm text-secondary">
                Nothing is wrong here. Every rule it is watched by is inside its line, and the
                readings below are what that is based on.
              </p>
            </div>
          ) : (
            alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-medium text-primary">{heading}</h3>
            <span className="text-xs text-tertiary">
              Last heard from {relativeTime(lastUpdated, now)}
            </span>
          </div>

          <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
            {readings.map((reading) => (
              <ReadingRow
                key={reading.key}
                reading={reading}
                alerted={alertedKeys.has(reading.key)}
                daylight={daylight}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
