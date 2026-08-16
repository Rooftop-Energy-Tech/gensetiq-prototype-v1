import {ActivityIcon, BellIcon, CircleGaugeIcon, DropletIcon, WrenchIcon} from 'lucide-react';
import {Link} from '@tanstack/react-router';

import {Badge} from '@/components/ui/badge';
import {amount, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {ALERT_SEVERITIES, countBySeverity, worstSeverity} from '../../types/alert.type';
import type {AlertSeverity, GensetAlert, GensetCondition, GensetTag} from '../../types/alert.type';
import type {ServiceNotice, ServiceStatus} from '../../types/service.type';
import type {FuelLeakNotice} from '../../types/fuelIntegrity.type';
import type {Reading} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import {CONDITION_META, SEVERITY_META} from './severityMeta';
import type {GensetDetail} from '../../data/detail';

/** The tag an overdue service is filed under — the one it already belonged to. */
const SERVICE_TAG_ID = 'service';

/**
 * And the one a leak is filed under.
 *
 * `Fuel` was the tag that deliberately carried no alarms, and the note in
 * `detail.ts` explaining why is still true: the register map's two fuel bits
 * (`AL Fuel Level Wrn`, `AL Fuel Level Sd`) are not marked for the dashboard, so
 * the map contributes nothing here. What has changed is that the *app* now does.
 */
const FUEL_TAG_ID = 'fuel';

/**
 * An overdue service, in the alert list but not disguised as an alarm.
 *
 * The differences from `AlertCard` are the point rather than styling drift. It
 * carries a spanner instead of a bell, and where an alarm prints its register and
 * bit this prints `Service schedule` — because that is honestly where it came
 * from. A reader has to be able to tell at a glance which rows are the panel
 * talking and which are the app's own arithmetic, and the register line is what
 * they already use to do it.
 *
 * The card links to the Service tab, because unlike an alarm there is something
 * to *do* about this one and the place to do it is one click away.
 */
const ServiceNoticeCard = ({notice}: {notice: ServiceNotice}) => (
  <div className="flex w-full flex-col gap-3 rounded-md border border-severity-critical/40 bg-element px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-3.5">
      <Badge variant="element" size="md" className="border-subtle">
        <WrenchIcon className="text-severity-critical" aria-hidden="true" />
        Service
      </Badge>
      <p className="text-base font-medium text-primary">{notice.message}</p>
      <p className="ml-auto text-xs text-secondary">{notice.source}</p>
    </div>

    <Link
      to="/gensets/$gensetId/service"
      params={{gensetId: notice.gensetId}}
      className="text-sm text-secondary underline-offset-4 hover:text-primary hover:underline"
    >
      Open the service log
    </Link>
  </div>
);

/**
 * A leak, in the alert list and visibly not from the panel.
 *
 * Same shape as the service notice above and for the same reason: a droplet
 * instead of a bell, and `Fuel reconciliation` where an alarm prints its register
 * and bit. No controller raises this — a panel watches its own tank and its own
 * injectors and never puts the two together — so a card that looked like a
 * register-map row would be claiming a source that does not exist.
 *
 * Unlike the service notice it takes a severity colour, because unlike an overdue
 * chore this is a live fault: it is what turns the verdict above from `Optimum`,
 * and a border that did not agree with that would leave the reader hunting.
 */
const FuelLeakNoticeCard = ({notice}: {notice: FuelLeakNotice}) => (
  <div
    className={cn(
      'flex w-full flex-col gap-3 rounded-md border bg-element px-3 py-2.5',
      notice.kind === 'critical' ? 'border-severity-critical/40' : 'border-severity-warning/40',
    )}
  >
    <div className="flex flex-wrap items-center gap-3.5">
      <Badge variant="element" size="md" className="border-subtle">
        <DropletIcon
          className={
            notice.kind === 'critical' ? 'text-severity-critical' : 'text-severity-warning'
          }
          aria-hidden="true"
        />
        Fuel leak
      </Badge>
      <p className="text-base font-medium text-primary">{notice.message}</p>
      <p className="ml-auto text-xs text-secondary">{notice.source}</p>
    </div>

    <Link
      to="/gensets/$gensetId/settings"
      params={{gensetId: notice.gensetId}}
      className="text-sm text-secondary underline-offset-4 hover:text-primary hover:underline"
    >
      See the reconciliation
    </Link>
  </div>
);

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
        <p className="ml-auto text-xs text-secondary">
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
  service,
  notice,
  leak,
  condition,
  focus,
  onFocusChange,
}: {
  detail: GensetDetail;
  /** Live service status — the source of the `hours-since-service` figure below. */
  service: ServiceStatus;
  notice: ServiceNotice | undefined;
  leak: FuelLeakNotice | undefined;
  /**
   * The verdict, passed in rather than read off `detail`.
   *
   * `detail.condition` is the register map's verdict alone, and a set losing fuel
   * carries an alarm the register map has no bit for. The combined reading lives in
   * `data/fuelIntegrity.ts`; this component stays a view over what it is given.
   */
  condition: GensetCondition;
  focus: AlertFocus;
  onFocusChange: (focus: AlertFocus) => void;
}) => {
  const {alerts, tags} = detail;

  /** The leak's severity, in the alert module's own three-value ranking. */
  const leakSeverity: AlertSeverity | undefined =
    leak === undefined ? undefined : leak.kind === 'critical' ? 'CRITICAL' : 'WARNING';

  /**
   * The chip counts, **including the leak**.
   *
   * This is where it parts company with the service notice below, and the reason is
   * worth stating because the notice's own comment argues the opposite. A service
   * falling due does not move the verdict above these chips, so leaving it out of
   * them costs nothing. A leak does — and a page reading `Critical` over a row of
   * chips reading `Critical 0` is a summary contradicting the thing it summarises.
   * Worse, the reader who clicks `Critical` looking for what turned the verdict
   * would find an empty list.
   *
   * The chips count *this section's rows*, not the register map. The map's own
   * identity is protected where it actually lives: on the card, which prints
   * `Fuel reconciliation` where an alarm prints its register and bit.
   */
  const counts = countBySeverity(alerts);
  if (leakSeverity !== undefined) counts[leakSeverity] += 1;

  /**
   * The readings, with `hours-since-service` taken from the service log rather
   * than from the snapshot.
   *
   * `detail.ts` publishes a seeded value for it — correct at module load and
   * stale the moment somebody logs a service. Overriding it here is what makes
   * the spec's "the reading agrees with the log" true *after* an operator has
   * done something, not just on first paint.
   *
   * On a never-serviced genset the key is removed outright. There is no baseline
   * to subtract from, and a row reading "Hours since service 0 h" on a machine
   * that has never been serviced is precisely the invented number this feature
   * exists to delete.
   */
  const readings = (() => {
    const base = detail.readings;
    if (service.kind === 'never-serviced') {
      const {'hours-since-service': _dropped, ...rest} = base;
      return rest;
    }
    return {
      ...base,
      'hours-since-service': {
        ...base['hours-since-service'],
        value: Math.round(service.hours.elapsed),
      },
    };
  })();
  const conditionMeta = CONDITION_META[condition];
  const ConditionIcon = conditionMeta.icon;

  // Keyed by reading, so a tag can pull in the alarms on the readings it lists.
  const alertsByKey = new Map<string, Array<GensetAlert>>();
  for (const alert of alerts) {
    if (alert.readingKey === null) continue;
    alertsByKey.set(alert.readingKey, [...(alertsByKey.get(alert.readingKey) ?? []), alert]);
  }

  /**
   * A tag's alarms: those on its readings, plus the ones it names outright.
   *
   * The second half is for `Sd Override` and `DPF status`, which watch no reading
   * and would otherwise be filed nowhere. Deduped by id, because an alarm that is
   * both named by the tag and sitting on one of its readings is still one alarm.
   */
  const alertsForTag = (tag: GensetTag): Array<GensetAlert> => {
    const byReading = tag.readingKeys.flatMap((key) => alertsByKey.get(key) ?? []);
    const named = alerts.filter((alert) => (tag.alarmIds ?? []).includes(alert.ruleId));
    return [...new Map([...byReading, ...named].map((alert) => [alert.id, alert])).values()];
  };

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

  const showNotice =
    notice !== undefined &&
    (focus.kind === 'none' || (focus.kind === 'tag' && focus.tagId === SERVICE_TAG_ID));

  const showLeak =
    leak !== undefined &&
    (focus.kind === 'none' ||
      (focus.kind === 'tag' && focus.tagId === FUEL_TAG_ID) ||
      (focus.kind === 'severity' && focus.severity === leakSeverity));

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
    <section
      aria-label="Alerts"
      // A column below `md`, and the verdict runs across the top of it. Kept as a
      // row, the 113px condition rail takes a third of a 390px screen and leaves
      // the chips 223px to wrap into a ten-line stack — the same trade `SiteHome`
      // and `SiteGensetRow` make, and for the same reason.
      className="flex flex-col gap-2.5 py-4 pl-0 md:flex-row md:pl-3"
    >
      {/* Band 1's run-state hero geometry, repeated exactly — the same 12px
          inset, the same 113px column, the same 10px gap to the content beside
          it. The two glyphs are the page's only 32px marks and they answer the
          same kind of question ("what is this machine doing" / "how is it"), so
          they have to sit on one vertical line; anything else reads as two
          sections that were laid out separately.
          On a phone that line cannot exist — there is no column beside it — so the
          pair turns and reads as a heading instead. */}
      <div className="flex shrink-0 flex-row items-center gap-2 md:w-[113px] md:flex-col md:pt-4">
        <ConditionIcon
          className={cn('size-8', conditionMeta.textClassName)}
          aria-hidden="true"
        />
        <p className="text-base font-medium text-primary md:text-center">{conditionMeta.label}</p>
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
              // The leak colours the `Fuel` chip, which is how it reaches the chip
              // row at all. It deliberately does *not* touch the three severity
              // chips above — those count the register map, and slipping an
              // app-generated row into them would undo the reason it is a separate
              // type. Colouring the tag is the honest half of the same job: the
              // verdict says something is wrong, and the chip row says where.
              const worst =
                tag.id === FUEL_TAG_ID && leakSeverity !== undefined
                  ? leakSeverity
                  : worstSeverity(alertsForTag(tag));
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
          {/* Shown unfiltered and under the tag it belongs to, and nowhere else.
              It is not an alarm, so a severity chip cannot claim it — filtering
              to "Critical" narrows to the register map, and quietly slipping an
              app-generated row into that list would undo the whole reason it is a
              separate type. */}
          {showNotice && notice !== undefined && <ServiceNoticeCard notice={notice} />}
          {showLeak && leak !== undefined && <FuelLeakNoticeCard notice={leak} />}

          {orderedAlerts.length === 0 &&
          quietReadings.length === 0 &&
          !showNotice &&
          !showLeak ? (
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
