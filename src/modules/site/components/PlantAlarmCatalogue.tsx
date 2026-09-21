import type {ReactNode} from 'react';
import {Link} from '@tanstack/react-router';
import {BellIcon, CircleAlertIcon, CircuitBoardIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {CATEGORY_META} from './categoryMeta';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {GENSETS} from '@/modules/genset/data/fleet';
import {useSitePowerRole} from '../data/siteConfig';
import {plantAlarms, plantMonitoringUnit} from '../data/plantAlarms';
import {
  ALERT_SEVERITIES,
  CHECKABILITIES,
  CHECKABILITY_META,
  HUAWEI_SEVERITY_LABEL,
  PLANT_ALARM_CATEGORIES,
  PLANT_ALARM_CATEGORY_LABEL,
  countByCheckability,
  rerankDirection,
} from '../types/plantAlarm.type';
import type {PlantAlarm, PlantAlarmCategory} from '../types/plantAlarm.type';

/**
 * The alarms one subsystem's monitoring unit is set to poll — the shared body of
 * all four Alarms tabs.
 *
 * ## One component, because it is one device
 *
 * The site, battery, solar and genset tabs are four **routings of one poll table**,
 * not four alarm systems: there is a single box on the cabinet wall watching the
 * whole −48 V plant, and the category on each row says who fixes that thing. Four
 * copies of this page would be four chances for the same fifty-eight rows to be
 * counted, coloured or caveated differently on the tab a reader happens to open,
 * and the caveat is the part that must not vary — see the callout below.
 *
 * So the tabs differ in exactly two things, and both are props: which category to
 * show, and the noun for the empty state.
 *
 * ## Why this reports what is watched rather than what is wrong
 *
 * Because nothing has been read. The gateway on site is a version behind the poll
 * set, which is unbuilt — so there is no assertion, no raise time and nothing to
 * acknowledge, and the alternative to saying so was dealing a few plausible faults
 * to make the page look inhabited. That would be the one lie this screen cannot
 * afford: **fourteen of the fifty-eight rows have nothing in the poll set that
 * could contradict a quiet register**, so a page of green rows would be asserting a
 * clean site on evidence that cannot support it.
 *
 * There is therefore no standing/cleared split here and no acknowledge button. The
 * genset tab keeps both for its controller's own alarms and carries this catalogue
 * underneath as a separate band, which is the shape that stops the two kinds of row
 * from being read as one list.
 */

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
  >
    {children}
  </th>
);

/**
 * Where a category's rows live, so the rest are one click away.
 *
 * A reader on the battery tab looking at twenty-eight rows has no way of knowing
 * the same device is watching the other thirty, and the categories are a dispatch
 * decision rather than a boundary in the hardware — a low bus on the site tab is
 * the row that precedes the load-shed ladder on the battery tab. Naming the split
 * on every tab is what keeps four pages reading as one poll table.
 *
 * The genset target is the **set standing on this site**, looked up rather than
 * derived: a bank and an array are one per site and keyed by the site's own id, and
 * a machine is not. A site with no set — or with several — gets no link, because
 * there is no single right destination and a link to the first of three would be a
 * guess.
 */
const CategoryLink = ({
  category,
  siteId,
  count,
}: {
  category: PlantAlarmCategory;
  siteId: string;
  count: number;
}) => {
  const label = `${PLANT_ALARM_CATEGORY_LABEL[category]} ${count}`;
  const className =
    'rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline';

  // The site's own pooled tab. Every `SITE` row is the yard's monitoring unit or its
  // incomer, and that tab is where they are worked — the same destination the chip
  // names.
  if (category === 'SITE') {
    return (
      <Link to="/sites/$siteId/alarms" params={{siteId}} className={className}>
        {label}
      </Link>
    );
  }

  const onSite = GENSETS.filter((genset) => genset.siteId === siteId);
  if (onSite.length !== 1) return <span className="text-tertiary">{label}</span>;

  return (
    <Link
      to="/gensets/$gensetId/alarms"
      params={{gensetId: onSite[0]!.id}}
      className={className}
    >
      {label}
    </Link>
  );
};

/**
 * The four grades, explained once above the table rather than on every row.
 *
 * Fifty-eight rows each carrying a sentence about ambiguity is a page nobody
 * finishes, and the grade is a closed vocabulary of four — the kind a reader learns
 * once and then reads as a word. What stays on the row is the grade and the
 * specific corroboration for *that* register, which is the part that differs.
 *
 * `one way only` is first, against the register map's own ordering. The map builds
 * up to it; this page has to lead with it, because a reader who stops after the
 * first line should have been told the thing that matters.
 */
const CheckabilityLegend = ({counts}: {counts: Record<string, number>}) => (
  <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-subtle bg-element p-3 sm:grid-cols-2">
    {CHECKABILITIES.map((grade) => (
      <div key={grade} className="flex flex-col gap-0.5">
        <dt className={cn('text-xs font-medium', CHECKABILITY_META[grade].textClassName)}>
          {CHECKABILITY_META[grade].label} · {counts[grade] ?? 0}
        </dt>
        <dd className="text-xs text-secondary">{CHECKABILITY_META[grade].blurb}</dd>
      </div>
    ))}
  </dl>
);

/**
 * One row: what the register is, how far to trust it, and what it takes down with
 * it.
 *
 * The label is printed **exactly as the gateway publishes it**, including Huawei's
 * own capitalisation and its numbering. It is a published interface rather than a
 * display string — history downstream is keyed on the raw label, so a page that
 * tidied `Lithium Battery 1 Abnormal` into `Module 1 fault` would be showing an
 * operator a name that appears in no log and no register map.
 *
 * The register address is deliberately not on the row. A genset alert card prints
 * `register 1299 bit 0` because a technician standing at the panel can find that
 * bit on the controller's own display; nobody standing at this cabinet can look up
 * `0x5913`, and the four people who need it are reading the firmware's table rather
 * than this page. It is on the type if that changes.
 */
const AlarmRow = ({alarm, named}: {alarm: PlantAlarm; named: boolean}) => {
  const severity = SEVERITY_META[alarm.severity];
  const checkability = CHECKABILITY_META[alarm.checkability];
  const direction = rerankDirection(alarm);
  // Only when all four categories are in one table. On a single-category tab the
  // page's own title already says it, twenty-eight times over.
  const subsystem = CATEGORY_META[alarm.category];
  const SubsystemIcon = subsystem.icon;

  return (
    <tr className="border-b border-subtle align-top last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-primary">{alarm.label}</span>

            {/* The rule's line, on the eight rows that have one. It sits beside the
                name rather than under it because it is part of what the alarm *is* —
                `AC L1 Undervoltage` is not a complete statement without the voltage
                it trips at — and because the reader most likely to want it is
                scanning names rather than reading the paragraph beneath. */}
            {alarm.threshold !== null && (
              <span className="text-xs whitespace-nowrap text-tertiary">
                {alarm.threshold}
              </span>
            )}

            {named && (
              <Badge
                variant="element"
                size="sm"
                className="border-subtle whitespace-nowrap text-tertiary"
              >
                <SubsystemIcon aria-hidden="true" />
                {subsystem.label}
              </Badge>
            )}
          </span>
          <span className="text-xs text-secondary">{alarm.meaning}</span>

          {/* The two rows that change how other readings are read. Nothing else in
              the payload says so: the SMU keeps returning the last value it had for
              an invalidated register, so a consumer that does not model this reads a
              stale number as a current one. */}
          {alarm.invalidates.length > 0 && (
            <span className="mt-1 text-xs text-severity-warning">
              While asserted, these stop meaning anything: {alarm.invalidates.join(', ')}.
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2.5">
        <div className="flex flex-col items-start gap-1">
          <Badge variant="element" className="border-subtle whitespace-nowrap">
            <BellIcon className={severity.textClassName} aria-hidden="true" />
            {severity.label}
          </Badge>
          <span className="text-xs whitespace-nowrap text-tertiary">
            Device: {alarm.huawei} · {HUAWEI_SEVERITY_LABEL[alarm.huawei]}
          </span>

          {/* The sentence is the argument rather than a flag — an operator who
              disagrees with a re-rank should be able to see what it was made on.

              The two directions are weighted differently on purpose. A row this
              site has raised *above* the device's class is a claim that wants
              reading, so it takes the warning colour; a row lowered to a note
              should not shout about not shouting, so it goes quiet. Both are
              always printed, and the device's own class sits directly above them
              either way — a difference an operator can see is deliberate, rather
              than one they have to assume is a transcription error. */}
          {alarm.reranked !== null && (
            <span
              className={cn(
                'max-w-56 text-xs',
                direction === 'up' ? 'text-severity-warning' : 'text-tertiary',
              )}
            >
              {direction === 'up' ? 'Raised above' : 'Lowered from'} the device's class here.{' '}
              {alarm.reranked}
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-xs font-medium', checkability.textClassName)}>
            {checkability.label}
          </span>
          <span className="text-xs text-secondary">{alarm.corroboration}</span>
        </div>
      </td>
    </tr>
  );
};

export const PlantAlarmCatalogue = ({
  siteId,
  /**
   * One subsystem's rows, or `'ALL'` for the whole poll table.
   *
   * `'ALL'` is the site tab's folded-away reference band. It is a separate value
   * rather than an optional prop because it changes what the page *is*: with four
   * categories in one table every row has to name its own, and the cross-reference
   * footer — "the same unit's other rows" — has nothing left to point at.
   */
  category,
  /**
   * What this tab is about, for the heading and the empty state — `this bank`,
   * `this array`, `this set`, `this site`. The one other thing that varies between
   * the four pages.
   */
  subject,
  /** `false` on the genset tab, where this is a band under the controller's alarms. */
  standalone = true,
}: {
  siteId: string;
  category: PlantAlarmCategory | 'ALL';
  subject: string;
  standalone?: boolean;
}) => {
  const role = useSitePowerRole(siteId);
  const unit = plantMonitoringUnit(siteId);
  const all = plantAlarms(siteId, role);
  const everything = category === 'ALL';
  const rows = everything ? all : all.filter((alarm) => alarm.category === category);

  if (unit === undefined) return null;

  const severities = countBySeverity(rows);
  const checkabilities = countByCheckability(rows);
  const Heading = standalone ? 'h1' : 'h2';

  return (
    <section
      aria-label={
        everything
          ? "Every alarm on the site's monitoring unit"
          : `${PLANT_ALARM_CATEGORY_LABEL[category]} alarms on the site's monitoring unit`
      }
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        {/* No heading in the `'ALL'` band: the disclosure's own summary is the
            heading, and a second one directly under it would be the same sentence
            twice with the second one shouting. */}
        {!everything && (
          <Heading className="text-base font-medium text-primary">
            {standalone ? 'Alarms' : `Also watched by the site's ${unit.deviceName}`}
          </Heading>
        )}
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-secondary">
          <CircuitBoardIcon className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
          {unit.deviceName} · slave {unit.slaveId} ·{' '}
          {everything
            ? `all ${rows.length} alarms in its poll table`
            : `${rows.length} of the ${unit.alarmRows} alarms in its poll table are about ${subject}`}
        </p>
      </div>

      {/* The caveat, and it leads the page rather than closing it.

          A reader who scrolls no further has to leave with the one fact that
          decides how to read everything under it: this is a poll set, not a
          report. The three sentences are the register map's own rules, in the
          order they bite — nothing has answered yet; a quiet register is not a
          healthy plant; and a register that fails to answer publishes `null`,
          which is not a zero. Anything downstream that coerces the third into the
          second turns a comms failure into an all-clear. */}
      <div className="flex gap-2.5 rounded-lg border border-subtle bg-element p-3">
        <CircleAlertIcon
          className="mt-0.5 size-4 shrink-0 text-severity-warning"
          aria-hidden="true"
        />
        <div className="flex max-w-prose flex-col gap-1.5 text-xs text-secondary">
          <p className="text-primary">Nothing here has been read.</p>
          <p>
            The gateway on site — {unit.gatewayId} — runs {unit.gatewayFirmware}, and this
            poll set is {unit.pollFirmware}, which is unbuilt and unflashed. These are the
            registers the unit is set to watch, not alarms it has raised, so no row can be
            acknowledged or cleared.
          </p>
          <p>
            When it does answer, a <span className="text-primary">1</span> is always
            believable — something asserted it. A{' '}
            <span className="text-primary">0</span> is ambiguous three ways: healthy,
            hardware not fitted, or unsupported on this build, and nothing in the protocol
            separates them. That is what the corroboration column grades, and it is why
            this page will never total a site as healthy.
          </p>
          <p>
            A register that does not answer a window publishes{' '}
            <span className="text-primary">null</span>, which is not{' '}
            <span className="text-primary">0</span>. An alarm that failed to read is not an
            alarm reading clear.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        /* Reachable, and worth a sentence rather than a blank. The nine per-phase AC
           rows are filed under Genset only because this site has no incomer; declare
           one on its settings tab and they all become Site rows, which empties this
           tab. A reader who has just done that needs to be told where they went. */
        <p className="max-w-prose text-sm text-secondary">
          The unit polls {unit.alarmRows} alarms and none of them are filed against{' '}
          {subject} as this site is currently configured. The nine per-phase AC rows move
          between the genset and the site depending on whether there is a utility incomer,
          because the device cannot tell you which source the phases belong to.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {ALERT_SEVERITIES.map((severity) => (
              <Badge
                key={severity}
                variant="element"
                size="md"
                className={cn('border-subtle', severities[severity] === 0 && 'opacity-50')}
              >
                <BellIcon
                  className={SEVERITY_META[severity].textClassName}
                  aria-hidden="true"
                />
                <span className="text-secondary">
                  {SEVERITY_META[severity].label} {severities[severity]}
                </span>
              </Badge>
            ))}
          </div>

          <CheckabilityLegend counts={checkabilities} />

          {/* Address order, as the poll table is — see `plantAlarms`. The `0x50`
              block is the plant, `0x55` the battery and `0x59` the solar, so the
              subsystem grouping falls out of the sort and a reader comparing this
              against the firmware's table is reading in the same order. */}
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Alarm</Th>
                  <Th>Severity</Th>
                  <Th>What would catch it</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((alarm) => (
                  <AlarmRow key={alarm.id} alarm={alarm} named={everything} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!everything && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
          <span>The same unit's other rows:</span>
          {PLANT_ALARM_CATEGORIES.filter((other) => other !== category).map((other) => (
            <CategoryLink
              key={other}
              category={other}
              siteId={siteId}
              count={all.filter((alarm) => alarm.category === other).length}
            />
          ))}
        </p>
      )}
    </section>
  );
};
