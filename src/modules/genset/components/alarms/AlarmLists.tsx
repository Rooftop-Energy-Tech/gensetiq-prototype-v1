import type {ReactNode} from 'react';
import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {CATEGORY_META} from '@/modules/site/components/categoryMeta';
import {PART_META} from '@/modules/site/components/partMeta';
import {relativeTime, stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {ALERT_SEVERITIES, countBySeverity} from '../../types/alert.type';
import type {AlertSeverity} from '../../types/alert.type';
import {standingOf} from '../../types/alarmState.type';
import type {AlarmView} from '../../types/alarmView.type';
import {
  acknowledgeAlarm,
  clearAlarm,
  reopenAlarm,
  unacknowledgeAlarm,
} from '../../data/alarms';
import {SEVERITY_META} from '../detail/severityMeta';
import {STANDING_META} from './standingMeta';

/**
 * The two alarm tables, the severity chips over them, and the note under them.
 *
 * ## Why this is shared rather than three pages
 *
 * Because it is one alarm system with three subjects. A genset, a bank and an array
 * each have an Alarms tab; all three answer the same two questions — what is
 * standing, and what has been done about it — and all three write to one handling
 * store keyed by alarm id. Three copies of these tables would be three chances for
 * the same register to be counted, coloured, ordered or caveated differently
 * depending on which tab a reader happened to open, and the caveat at the foot is
 * the part that must not vary.
 *
 * What the pages keep for themselves is the part that is genuinely theirs: which
 * rows to hand in. The genset merges its controller's own register map with the
 * site unit's AC rows; the bank and the array have only the unit. That is the whole
 * difference, and it belongs at the call site rather than behind a flag in here.
 *
 * ## Merge before you split
 *
 * Callers hand in one list and this splits it. The order matters: a page that
 * sorted each source and concatenated would put every monitoring-unit row below
 * every controller row whatever their severity, which is the two-lists problem with
 * the seam moved into the middle of one table.
 */

const Th = ({children}: {children: ReactNode}) => (
  <th scope="col" className="px-3 py-2 text-left font-medium">
    {children}
  </th>
);

/**
 * The alarm's own identity — its name, and which device is asserting it.
 *
 * The second line is the same claim of provenance the home page's cards make, and
 * it matters more here than there. This page is the log: a row that gets
 * screenshotted into a message to the panel supplier has to say where it came
 * from, or it is one crew's paraphrase of a fault.
 *
 * It is also now the line that tells the two devices apart. A controller bit gives
 * its rule and its coordinates on Deep Sea's map; a row off the site's monitoring
 * unit names the unit and its register, because the panel has never heard of it and
 * a technician sent to the wrong box has been sent to the wrong box. Each source
 * writes its own — see `alarmView.type.ts` on why that is a string rather than a
 * set of fields half of which would be null.
 */
const AlarmIdentity = ({alarm}: {alarm: AlarmView}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="font-medium text-primary">{alarm.name}</span>
    <span className="text-xs text-secondary">{alarm.provenance}</span>
  </div>
);

/**
 * What a row is about: which asset, and — for a cabinet row — which part of it.
 *
 * ## Why the part is a second line and not a second pill
 *
 * Because it is a signpost, not a finding. `ModuleRack` settled this argument for the
 * battery's modules: "a pill is how this app draws a state worth acting on, and
 * `lowest` is a signpost — giving it the same silhouette as the finding beside it
 * would make the two read as one severity at two wordings." A row already carries two
 * pills that *are* findings, this one and the Huawei class, and a third of the same
 * shape would join that group rather than qualify the first of them.
 *
 * A quieter line under the badge is also a shape this row already uses: the first cell
 * stacks the alarm's name over its provenance, so primary-over-secondary now appears
 * twice per row instead of once. It is the arrangement the **filter** uses too, where
 * the part chips sit indented under `Cabinet` — so the table reads the way the control
 * that narrowed it does.
 *
 * It costs no height. Every row is already two lines tall because of that provenance
 * line, so the sub-line lands in space the cell had spare.
 *
 * ## Why the part becomes the badge when there is no asset
 *
 * `asset` is the site's pooled queue only, so this whole column is dropped on the four
 * single-asset tabs. The cabinet's own tab is the exception worth handling: every row
 * there is about one box, `Cabinet` would be the same word seventeen times, and the
 * part is the *only* thing telling them apart. So where there is no asset the part is
 * promoted to the badge and the header reads `Part` instead of `Asset`.
 *
 * A part reaching this component at all already means the row is filed under the
 * cabinet — `assertedPlantAlarms` is where that is enforced, so nothing here has to
 * know which page it is on.
 *
 * ## Why a column rather than a chip beside the name
 *
 * It was beside the name first, and that was the wrong place for it. A value that
 * every row carries and that a reader **scans down** wants a column: eleven chips at
 * eleven different horizontal positions, each starting wherever its alarm's name
 * happened to end, cannot be read as a list. In its own column the four words line
 * up and `Battery, Battery, Genset` becomes something you take in at a glance —
 * which is the whole point of the value being on the row at all.
 *
 * ## Why it is quiet
 *
 * Uncoloured, with a tertiary glyph, sitting next to a `Class` badge that carries the
 * severity colour. Severity is the claim a reader must not miss and there is one
 * coloured thing per row to say it; a second chip competing for the same glance would
 * make the row argue with itself about what matters. This one only has to be
 * findable, and a column makes it findable without any weight at all.
 *
 * Both words match the filter chips above the table exactly, so turning `Genset` on
 * and reading `Genset` down the column is visibly the same claim — and so is turning
 * `Solar Supply Units` on and reading it down the sub-lines.
 */
const SubjectCell = ({alarm}: {alarm: AlarmView}) => {
  const part = alarm.part === undefined ? undefined : PART_META[alarm.part];

  // See `AlarmView.asset` on why an asset's own tab has nothing to say here — except
  // the cabinet's, where the part is the whole of what there is to say.
  if (alarm.asset === undefined) {
    if (part === undefined) return null;

    const PartIcon = part.icon;

    return (
      <td className="px-3 py-2.5">
        <Badge variant="element" className="border-subtle whitespace-nowrap text-secondary">
          <PartIcon className="text-tertiary" aria-hidden="true" />
          {part.label}
        </Badge>
      </td>
    );
  }

  const meta = CATEGORY_META[alarm.asset];
  const Icon = meta.icon;
  const PartIcon = part?.icon;

  return (
    <td className="px-3 py-2.5">
      <Badge variant="element" className="border-subtle whitespace-nowrap text-secondary">
        <Icon className="text-tertiary" aria-hidden="true" />
        {meta.label}
      </Badge>

      {part !== undefined && PartIcon !== undefined && (
        <span className="flex items-center gap-1 pt-1 pl-0.5 text-xs whitespace-nowrap text-tertiary">
          <PartIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {part.label}
        </span>
      )}
    </td>
  );
};

/**
 * The asserting device's protection class, in the severity's colour. Same pairing
 * as `AlertCard`.
 *
 * The word is the device's and the colour is ours, and the pair is the point. Deep
 * Sea says `Shutdown Alarm`; Huawei says `Major alarm`. Both are translated to one
 * of three chips so a reader can rank a row from either device against the other,
 * and neither has its own vocabulary taken away to get there — a `Major alarm`
 * rendered as `Warning` would be this page quietly overwriting the only claim the
 * device actually made.
 */
const ClassBadge = ({alarm}: {alarm: AlarmView}) => (
  <Badge variant="element" className="border-subtle whitespace-nowrap">
    <BellIcon className={SEVERITY_META[alarm.severity].textClassName} aria-hidden="true" />
    {alarm.className}
  </Badge>
);

/**
 * One standing alarm, and the two things that can be done to it.
 *
 * **Acknowledge does not remove the row.** That is the behaviour the whole
 * two-axis model exists to produce, and it is the one thing a reader coming from
 * an inbox-shaped UI will not expect: taking an alarm on says a person is dealing
 * with it, not that the engine is well. The row stays, its standing changes, and
 * the name of whoever claimed it appears on it.
 *
 * The buttons are asymmetric on purpose. `Acknowledge` is replaced by
 * `Unacknowledge` once somebody has claimed it, because acknowledging twice is
 * meaningless and the store ignores it anyway, while releasing a claim is the
 * undo the first click needs — a row taken on by mistake, or by the shift that
 * turned out not to own it, has to be gettable back onto the queue. `Clear` is
 * always there, because an alarm can be dealt with by a person who never
 * bothered to claim it first and refusing that would only teach people to click
 * two buttons in a row.
 *
 * `Unacknowledge` is the quiet `ghost`, the same weight `Reopen` gets in the
 * cleared table: both are corrections rather than steps forward, and neither
 * should compete with `Clear` for the eye.
 */
const StandingRow = ({alarm, by}: {alarm: AlarmView; by: string}) => {
  const standing = standingOf(alarm.handling);
  const meta = STANDING_META[standing];
  const StandingIcon = meta.icon;

  return (
    <tr className="border-b border-subtle last:border-b-0">
      <td className="px-3 py-2.5">
        <AlarmIdentity alarm={alarm} />
      </td>
      <SubjectCell alarm={alarm} />
      <td className="px-3 py-2.5">
        <ClassBadge alarm={alarm} />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
        {stampAt(alarm.raisedAt)}
        <span className="block text-xs text-tertiary">{relativeTime(alarm.raisedAt)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', meta.textClassName)}>
          <StandingIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>
        {alarm.handling.acknowledgedBy !== null && (
          <span className="block text-xs text-tertiary">
            by {alarm.handling.acknowledgedBy}
            {alarm.handling.acknowledgedAt !== null &&
              ` · ${relativeTime(alarm.handling.acknowledgedAt)}`}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-2">
          {alarm.handling.acknowledgedAt === null ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => acknowledgeAlarm(alarm.id, by)}
            >
              Acknowledge
            </Button>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => unacknowledgeAlarm(alarm.id)}
            >
              Unacknowledge
            </Button>
          )}
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => clearAlarm(alarm.id, by)}
          >
            Clear
          </Button>
        </div>
      </td>
    </tr>
  );
};

/** One alarm somebody has finished with, and the way back if they were wrong. */
const ClearedRow = ({alarm}: {alarm: AlarmView}) => (
  <tr className="border-b border-subtle last:border-b-0">
    <td className="px-3 py-2.5">
      <AlarmIdentity alarm={alarm} />
    </td>
    <SubjectCell alarm={alarm} />
    <td className="px-3 py-2.5">
      <ClassBadge alarm={alarm} />
    </td>
    <td className="px-3 py-2.5 whitespace-nowrap text-secondary">{stampAt(alarm.raisedAt)}</td>
    <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
      {alarm.handling.clearedAt === null ? '—' : stampAt(alarm.handling.clearedAt)}
      <span className="block text-xs text-tertiary">by {alarm.handling.clearedBy}</span>
    </td>
    <td className="px-3 py-2.5">
      <div className="flex">
        <Button type="button" size="xs" variant="ghost" onClick={() => reopenAlarm(alarm.id)}>
          Reopen
        </Button>
      </div>
    </td>
  </tr>
);

export const AlarmLists = ({
  /** Both sources' rows, already merged. See the note above. */
  standing,
  cleared,
  /** Who a click is recorded as — the session's email. */
  by,
  /** The page's own `h1`. `Alarms` everywhere so far. */
  heading = 'Alarms',
  /** `this genset`, `this bank`, `this array` — for the two empty states. */
  subject,
  /**
   * A control row under the severity chips, for the one page that needs one.
   *
   * A slot rather than a prop this component understands, because the filtering
   * itself happens **above** it: callers hand in the rows that survived, so the
   * table and its chips cannot disagree about what is on screen. Putting the filter
   * state in here would put it in three pages that have nothing to filter.
   */
  controls,
  /**
   * Makes the severity chips a filter rather than a readout — the site's pooled
   * queue only.
   *
   * The three asset tabs pass nothing and keep what they have: three counts over
   * one asset's rows, which is a summary and not a control worth having. The site
   * page pools four assets and eleven rows, and *show me only what is
   * critical* becomes a real question there.
   *
   * `counts` is handed in rather than derived from `standing`, and that is the whole
   * reason this is an object. A filtered chip row that counted the rows surviving
   * its own filter would read `Critical 7 · Warning 0 · Neutral 0` the moment
   * somebody clicked `Critical` — three numbers that no longer describe anything a
   * reader can act on. The caller counts the set the filter is applied *to*, so the
   * chips keep saying what turning each one on would show.
   */
  severityFilter,
}: {
  standing: ReadonlyArray<AlarmView>;
  cleared: ReadonlyArray<AlarmView>;
  by: string;
  heading?: string;
  subject: string;
  controls?: ReactNode;
  severityFilter?: {
    counts: Record<AlertSeverity, number>;
    selected: ReadonlySet<AlertSeverity>;
    onToggle: (severity: AlertSeverity) => void;
  };
}) => {
  const counts = severityFilter?.counts ?? countBySeverity(standing);

  /**
   * Whether the tables carry the subject column, and what its header says.
   *
   * Derived from the rows rather than taken as a prop, so a header cell and the cells
   * under it cannot disagree — the one bug an `assets={true}` prop would eventually
   * produce. Read across **both** lists: a filter that empties the standing table must
   * not take the column off the cleared one under it.
   *
   * The header follows the same rule now that a cabinet row can carry a part. On the
   * site's pooled queue every row has an asset and the column is `Asset`, with the
   * part as a sub-line; on the cabinet's own tab no row has an asset, the part is
   * promoted to the badge, and calling that column `Asset` would label seventeen
   * different parts of one box with the word for the box. See `SubjectCell`.
   */
  const anyAsset =
    standing.some((alarm) => alarm.asset !== undefined) ||
    cleared.some((alarm) => alarm.asset !== undefined);
  const anyPart =
    standing.some((alarm) => alarm.part !== undefined) ||
    cleared.some((alarm) => alarm.part !== undefined);
  const named = anyAsset || anyPart;
  const subjectHeading = anyAsset ? 'Asset' : 'Part';
  const unacknowledged = standing.filter(
    (alarm) => alarm.handling.acknowledgedAt === null,
  ).length;

  /**
   * Counts on an asset's tab, and a filter on the site's — see `severityFilter`.
   * The split is the list's length: three counts over one asset's rows are a
   * summary, and eleven rows pooled from four assets are a queue somebody needs to
   * narrow.
   *
   * ## Why this is a variable and not inline
   *
   * Because where it goes depends on which of the two it is, and the difference
   * matters. A **readout** is a caption on the heading and belongs opposite it, out
   * at the right where a reader's eye lands after the title and then leaves. A
   * **control** belongs directly above the thing it acts on, left-aligned with the
   * asset chips under it and the table under those, so the three read as one
   * stack: narrow by this, then by that, then here are the rows. A filter parked in
   * the top-right corner reads as decoration and gets found last.
   */
  const severityChips = (
    <div className="flex flex-wrap gap-1.5">
      {ALERT_SEVERITIES.map((severity) => {
        const meta = SEVERITY_META[severity];
        const label = `${meta.label} ${counts[severity]}`;

        // A readout, on the three tabs that pass no filter.
        if (severityFilter === undefined) {
          return (
            <Badge
              key={severity}
              variant="element"
              size="md"
              className={cn('border-subtle', counts[severity] === 0 && 'opacity-50')}
            >
              <BellIcon className={meta.textClassName} aria-hidden="true" />
              <span className="text-secondary">{label}</span>
            </Badge>
          );
        }

        // And a control, on the one that does. Same chip, same weights as the
        // filter row `AlertsSection` puts above this table on a genset's own tab.
        const isOn = severityFilter.selected.has(severity);

        return (
          <Badge
            key={severity}
            asChild
            variant="element"
            size="md"
            className={cn(
              'cursor-pointer border-subtle transition-colors hover:bg-highlight',
              isOn && 'border-default bg-highlight',
              counts[severity] === 0 && !isOn && 'opacity-50',
            )}
          >
            <button
              type="button"
              aria-pressed={isOn}
              onClick={() => severityFilter.onToggle(severity)}
            >
              <BellIcon className={meta.textClassName} aria-hidden="true" />
              <span className={isOn ? 'text-primary' : 'text-secondary'}>{label}</span>
            </button>
          </Badge>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-medium text-primary">{heading}</h1>
        {severityFilter === undefined && severityChips}
      </div>

      {/* The filter stack, directly over the tables it narrows. `gap-2.5` rather
          than the page's own gap: the two chip rows are one control, and spacing
          them as far apart as they are from the table would make them two. */}
      {(severityFilter !== undefined || controls !== undefined) && (
        <div className="flex flex-col gap-2.5">
          {severityFilter !== undefined && severityChips}
          {controls}
        </div>
      )}

      <section aria-label="Standing alarms" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-medium text-primary">Standing</h2>
          {/* The number that decides whether anybody needs to do something. An
              acknowledged alarm has a name against it; an unacknowledged one is
              the backlog, and it is the only count on this page worth stating in
              words rather than leaving to be counted off the rows. */}
          <p className="text-sm text-secondary">
            {standing.length === 0
              ? 'Nothing standing'
              : `${standing.length} standing · ${unacknowledged} unacknowledged`}
          </p>
        </div>

        {standing.length === 0 ? (
          <p className="max-w-prose text-sm text-secondary">
            No alarms are standing against {subject}. That means none are standing{' '}
            <em>in this browser</em> — the registers are polled, and an alarm cleared here is
            cleared for whoever cleared it.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Alarm</Th>
                  {named && <Th>{subjectHeading}</Th>}
                  <Th>Class</Th>
                  <Th>Raised</Th>
                  <Th>Standing</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {standing.map((alarm) => (
                  <StandingRow key={alarm.id} alarm={alarm} by={by} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Cleared alarms" className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-primary">Cleared</h2>

        {cleared.length === 0 ? (
          <p className="max-w-prose text-sm text-secondary">
            Nothing has been cleared on {subject} yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Alarm</Th>
                  {named && <Th>{subjectHeading}</Th>}
                  <Th>Class</Th>
                  <Th>Raised</Th>
                  <Th>Cleared</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {cleared.map((alarm) => (
                  <ClearedRow key={alarm.id} alarm={alarm} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </>
  );
};
