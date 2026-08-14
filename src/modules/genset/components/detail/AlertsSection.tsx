import {ActivityIcon, BellIcon, CircleGaugeIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {ALERT_SEVERITIES, countBySeverity, worstSeverity} from '../../types/alert.type';
import type {AlertSeverity, GensetAlert, GensetTag} from '../../types/alert.type';
import type {Reading} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import {CONDITION_META, SEVERITY_META} from './severityMeta';
import type {GensetDetail} from '../../data/detail';

/**
 * A reading and its number, on one line.
 *
 * The glyph carries the verdict: severity colour when a threshold is crossed,
 * green when it isn't. That is the whole reason a reading is worth showing next
 * to its alert — "Starter battery voltage 21.8 V" is what makes "Undervoltage"
 * checkable rather than something the reader has to take on trust.
 */
const ReadingRow = ({
  reading,
  severity,
}: {
  reading: Reading;
  severity: AlertSeverity | undefined;
}) => (
  <div className="flex w-full items-center justify-between gap-4">
    <div className="flex min-w-0 items-center gap-3">
      <CircleGaugeIcon
        className={cn(
          'size-3 shrink-0',
          severity === undefined ? 'text-severity-ok' : SEVERITY_META[severity].textClassName,
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'truncate text-base font-medium',
          severity === undefined ? 'text-secondary' : 'text-primary',
        )}
      >
        {reading.label}
      </span>
    </div>
    <span className="text-base font-medium whitespace-nowrap text-primary">
      {amount(reading.value, reading.unit, reading.precision)}
    </span>
  </div>
);

/**
 * One alert, with the reading that tripped it inside the same card.
 *
 * The card is what pairs them. An alert list on its own is a list of adjectives;
 * putting the number in the box with the name is what turns "Warning · AL Battery
 * Voltage" into a claim you can check, and the threshold underneath says what the
 * rule actually is.
 *
 * The badge reads the register map's own protection class — `Shutdown Alarm`
 * rather than `Critical` — while keeping the severity's colour. The colour is what
 * ties a card to the chip row above it; the word is what tells the reader whether
 * the panel stopped the engine or opened the breaker, which the three severities
 * cannot say on their own. Roll-up bits arrive with no reading, so the card is the
 * name and the rule and nothing underneath.
 */
const AlertCard = ({alert, reading}: {alert: GensetAlert; reading: Reading | undefined}) => {
  const meta = SEVERITY_META[alert.severity];

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border border-default bg-element px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3.5">
        <Badge variant="element" size="md" className="border-subtle">
          <BellIcon className={meta.textClassName} aria-hidden="true" />
          {alert.type}
        </Badge>
        <p className="text-base font-medium text-primary">{alert.name}</p>
        <p className="ml-auto text-xs text-tertiary">
          {alert.threshold} · raised {relativeTime(alert.raisedAt)}
        </p>
      </div>

      {reading !== undefined && <ReadingRow reading={reading} severity={alert.severity} />}
    </div>
  );
};

/**
 * The alerts half of the genset home page.
 *
 * Two rows of chips over a result list. The chips are a **single-select filter**
 * with two kinds of entry that answer different questions:
 *
 *   - a **severity** chip asks "what is wrong, worst first" — it lists alerts and
 *     nothing else;
 *   - a **tag** chip asks "how is this subsystem doing" — it lists every reading
 *     the operator filed under that tag, with the alerting ones promoted into
 *     cards and the quiet ones as plain rows underneath.
 *
 * That asymmetry is deliberate. A severity is a property of alerts, so filtering
 * by it cannot surface a healthy reading; a tag is a property of readings, so
 * filtering by it has to show the readings that are fine as well — otherwise
 * selecting "Coolant" on a healthy engine would return an empty list, and the
 * reader could not tell "nothing wrong" from "nothing measured".
 *
 * Single-select, not multi: two filters intersected produce a result nobody asked
 * for ("critical alerts, but only coolant ones") and the chip row stops being
 * readable as a summary of the machine.
 */
export const AlertsSection = ({
  detail,
  focus,
  onFocusChange,
}: {
  detail: GensetDetail;
  focus: AlertFocus;
  onFocusChange: (focus: AlertFocus) => void;
}) => {
  const {alerts, readings, tags, condition} = detail;
  const counts = countBySeverity(alerts);
  const conditionMeta = CONDITION_META[condition];
  const ConditionIcon = conditionMeta.icon;

  // Keyed by reading, so a tag can pull in the alarms on the readings it lists.
  // The roll-up bits (`AL Common Sd`, `Sd Override`) have no reading and so appear
  // under no tag — correctly: a tag is a set of readings, and an alarm about the
  // panel's state is not filed under a measurement. They still show under the
  // severity chips, which is where "what is wrong" gets asked.
  const alertsByKey = new Map<string, Array<GensetAlert>>();
  for (const alert of alerts) {
    if (alert.readingKey === null) continue;
    alertsByKey.set(alert.readingKey, [...(alertsByKey.get(alert.readingKey) ?? []), alert]);
  }

  const alertsForTag = (tag: GensetTag): Array<GensetAlert> =>
    tag.readingKeys.flatMap((key) => alertsByKey.get(key) ?? []);

  const selectedTag =
    focus.kind === 'tag' ? tags.find((tag) => tag.id === focus.tagId) : undefined;

  /**
   * What the result list shows.
   *
   * Severity focus → the matching alerts. Tag focus → the tag's readings, split
   * into the ones with an alert behind them and the ones without. No focus → every
   * alert, worst first, which is the useful default for a page somebody has just
   * opened.
   */
  const shownAlerts =
    focus.kind === 'severity'
      ? alerts.filter((alert) => alert.severity === focus.severity)
      : selectedTag === undefined
        ? alerts
        : alertsForTag(selectedTag);

  const orderedAlerts = [...shownAlerts].sort(
    (left, right) =>
      ALERT_SEVERITIES.indexOf(left.severity) - ALERT_SEVERITIES.indexOf(right.severity),
  );

  const quietReadings =
    selectedTag === undefined
      ? []
      : selectedTag.readingKeys
          .filter((key) => (alertsByKey.get(key) ?? []).length === 0)
          .map((key) => readings[key])
          .filter((reading) => reading !== undefined);

  const toggleSeverity = (severity: AlertSeverity) =>
    onFocusChange(
      focus.kind === 'severity' && focus.severity === severity
        ? {kind: 'none'}
        : {kind: 'severity', severity},
    );

  const toggleTag = (tagId: string) =>
    onFocusChange(
      focus.kind === 'tag' && focus.tagId === tagId ? {kind: 'none'} : {kind: 'tag', tagId},
    );

  return (
    <section aria-label="Alerts" className="flex gap-9 py-4">
      <div className="flex w-[70px] shrink-0 flex-col items-center gap-2 pt-4">
        <ConditionIcon
          className={cn('size-8', conditionMeta.textClassName)}
          aria-hidden="true"
        />
        <p className="text-center text-base font-medium text-primary">{conditionMeta.label}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          {/* Severity, then tags — one row each, wrapping. The severities lead
              because they are the summary: three chips with counts tell you the
              state of the machine before you read a single tag name. */}
          <div className="flex flex-wrap gap-1.5">
            {ALERT_SEVERITIES.map((severity) => {
              const meta = SEVERITY_META[severity];
              const selected = focus.kind === 'severity' && focus.severity === severity;

              return (
                <Badge
                  key={severity}
                  asChild
                  variant="element"
                  size="md"
                  className={cn(
                    'cursor-pointer border-subtle transition-colors hover:bg-highlight',
                    selected && 'border-default bg-highlight',
                    counts[severity] === 0 && 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSeverity(severity)}
                  >
                    <BellIcon className={meta.textClassName} aria-hidden="true" />
                    <span className={selected ? 'text-primary' : 'text-secondary'}>
                      {meta.label} {counts[severity]}
                    </span>
                  </button>
                </Badge>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const worst = worstSeverity(alertsForTag(tag));
              const selected = focus.kind === 'tag' && focus.tagId === tag.id;

              return (
                <Badge
                  key={tag.id}
                  asChild
                  variant="element"
                  size="md"
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-highlight',
                    selected && 'bg-highlight',
                  )}
                >
                  <button type="button" aria-pressed={selected} onClick={() => toggleTag(tag.id)}>
                    {/* The chip is coloured before anybody clicks it, by the
                        worst alert among its readings. Green means "these
                        numbers are all inside their thresholds" — which is the
                        answer most of the time, and worth being able to see
                        without opening anything. */}
                    <ActivityIcon
                      className={
                        worst === undefined
                          ? 'text-severity-ok'
                          : SEVERITY_META[worst].textClassName
                      }
                      aria-hidden="true"
                    />
                    <span className={selected ? 'text-primary' : 'text-secondary'}>
                      {tag.label}
                    </span>
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="flex max-w-[720px] flex-col gap-5">
          {orderedAlerts.length === 0 && quietReadings.length === 0 ? (
            <p className="text-sm text-secondary">
              {focus.kind === 'none'
                ? 'No active alerts on this genset.'
                : 'Nothing under this filter.'}
            </p>
          ) : (
            <>
              {orderedAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  reading={alert.readingKey === null ? undefined : readings[alert.readingKey]}
                />
              ))}

              {quietReadings.length > 0 && (
                <div className="flex flex-col gap-3 px-3">
                  {quietReadings.map((reading) => (
                    <ReadingRow key={reading.key} reading={reading} severity={undefined} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
