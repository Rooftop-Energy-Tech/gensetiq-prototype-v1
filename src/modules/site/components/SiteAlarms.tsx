import {useState} from 'react';
import {FilterXIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {CATEGORY_META} from './categoryMeta';
import {monitoringUnit} from '../data/monitoringUnit';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {PLANT_ALARM_CATEGORIES} from '../types/plantAlarm.type';
import type {PlantAlarmCategory} from '../types/plantAlarm.type';
import {PlantAlarmCatalogue} from './PlantAlarmCatalogue';

/**
 * The site's Alarms tab — everything standing anywhere on the yard, in one queue.
 *
 * ## What changed, and why the old page was wrong
 *
 * This tab used to be the monitoring unit's twelve `SITE` registers as a read-only
 * catalogue, with the other forty-six a click away on the bank's, array's and set's
 * tabs. That is a defensible page and it answered the wrong question. Somebody
 * opening a **site's** alarm tab is asking *what is wrong here* — not *what does the
 * cabinet's own sensor list contain* — and the answer was split across four screens
 * with no total anywhere.
 *
 * So this is the roll-up, and it is the union of those four tabs exactly. See
 * `siteAlarmQueue.ts` for the sources and for why that identity is the invariant
 * this page lives or dies on. The poll table it replaced is still here, at the foot,
 * folded away: fifty-eight registers with the grading of how far each can be trusted
 * is reference material, and reference material should not be the first thing on a
 * page somebody opened in a hurry.
 *
 * ## The two chip rows
 *
 * Severity on top, asset underneath, and **both filter**. Both are multi-select,
 * and on both an empty selection means everything — so there is no state in which
 * this page shows nothing because nothing was chosen. Two assets at once is a
 * real request: the array and the bank are one DC bus and a technician on site works
 * both.
 *
 * ## The counts cross-filter, and that is the part worth checking
 *
 * Each row's numbers are counted over the rows that survived **the other** row's
 * selection. Turn on `Critical` and the asset chips recount to how many criticals
 * each asset has; turn on `Genset` and the severity chips recount to
 * that set's four rows.
 *
 * The alternative — counting each chip over the rows that survived its own filter —
 * reads `Critical 7 · Warning 0 · Neutral 0` the moment somebody clicks `Critical`,
 * which is three numbers that have stopped describing anything a reader can act on.
 * A chip has one job: say what turning it on would show. Counting it against the
 * other axis is the only way it can keep doing that job while the other axis moves.
 *
 * Neither row counts the *cleared* table. The chips are about the queue — what is
 * standing and unanswered — and the log below is filtered by the same selection
 * without being counted into it.
 */
export const SiteAlarms = ({siteId}: {siteId: string}) => {
  const session = useSession();
  const by = session?.email ?? 'operator';

  // One clock reading for the page, so two rows' ages cannot land either side of a
  // minute boundary. Every screen in this app that prints a relative time does this.
  const [now] = useState(() => Date.now());

  /**
   * Nothing selected is the resting state and means *all four*, rather than none.
   *
   * A `Set` rather than four booleans: the filter is one question with four answers,
   * and `selected.size === 0` is the whole of the "show everything" test. Held in
   * component state rather than the URL — it is what a reader is *looking at* on this
   * visit, and the page's own note on `GensetHome` argues the same line about a
   * control's home.
   */
  const [categories, setCategories] = useState<ReadonlySet<PlantAlarmCategory>>(new Set());
  const [severities, setSeverities] = useState<ReadonlySet<AlertSeverity>>(new Set());

  const {standing, cleared} = useSiteAlarmQueue(siteId, now);
  const unit = monitoringUnit(siteId);

  const inCategories = (row: {asset?: PlantAlarmCategory}): boolean =>
    categories.size === 0 || (row.asset !== undefined && categories.has(row.asset));
  const inSeverities = (row: {severity: AlertSeverity}): boolean =>
    severities.size === 0 || severities.has(row.severity);

  /**
   * Each axis counted against the other's selection. See the note above on why.
   *
   * These are the *standing* rows only. The cleared table is filtered by the same
   * selection but never counted into a chip — a log is not a workload.
   */
  const severityCounts = countBySeverity(standing.filter(inCategories));
  const categoryCounts = standing.filter(inSeverities);

  const visibleStanding = standing.filter((row) => inCategories(row) && inSeverities(row));
  const visibleCleared = cleared.filter((row) => inCategories(row) && inSeverities(row));

  const filtered = categories.size > 0 || severities.size > 0;

  /**
   * One toggle for both rows — a `Set` of whatever the row's values are.
   *
   * Written generically because the two rows behave identically and a second copy is
   * a second chance for one of them to stop clearing on a re-click.
   */
  const toggler =
    <Value,>(set: (update: (current: ReadonlySet<Value>) => ReadonlySet<Value>) => void) =>
    (value: Value) =>
      set((current) => {
        const next = new Set(current);
        if (!next.delete(value)) next.add(value);
        return next;
      });

  const toggleCategory = toggler<PlantAlarmCategory>(setCategories);
  const toggleSeverity = toggler<AlertSeverity>(setSeverities);

  /**
   * The asset chips, and under them what both chip rows have left standing.
   *
   * Two rows rather than one that wraps. The chips are the control; the `Showing …`
   * line is a **readout of what the control did**, so it belongs under the whole set
   * rather than trailing the last chip — where its position shifted every time a
   * chip's count changed width, which is the one thing a status line must not do. A
   * reader looking for the number had to find it first.
   *
   * With the severity row that `AlarmLists` puts above, the stack reads top to bottom
   * as: narrow by how bad, narrow by what, here is what is left.
   */
  const controls = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {PLANT_ALARM_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const count = categoryCounts.filter((row) => row.asset === category).length;
          const isOn = categories.has(category);

          return (
            <Badge
              key={category}
              asChild
              variant="element"
              size="md"
              className={cn(
                'cursor-pointer border-subtle transition-colors hover:bg-highlight',
                isOn && 'border-default bg-highlight',
                // Dimmed when there is nothing of that kind standing, exactly as a
                // zero severity chip is. The chip stays clickable: turning it on to
                // see an explicit "nothing from the battery" is a legitimate answer,
                // and a disabled control makes a reader wonder whether it is broken.
                count === 0 && !isOn && 'opacity-50',
              )}
            >
              <button type="button" aria-pressed={isOn} onClick={() => toggleCategory(category)}>
                <Icon className="text-tertiary" aria-hidden="true" />
                <span className={isOn ? 'text-primary' : 'text-secondary'}>
                  {meta.label} {count}
                </span>
              </button>
            </Badge>
          );
        })}
      </div>

      {/* Only while something is on. A permanent `11 of 11` is a number that never
          says anything, and its absence is what makes the filtered case read as a
          state somebody chose. It counts the standing table because that is what the
          chips count; the cleared table narrows with it silently.

          The reset clears **both** rows. With two multi-select axes a reader can
          reach a combination with nothing in it — `Neutral` plus `Battery` — and
          working out which of up to seven chips to click off again is not a puzzle an
          empty table should set.

          It is a chip like the ones it undoes rather than the underlined link it
          started as, which had put the control that turns seven filters off in a
          different visual language from the seven that turn them on.

          It carries **no selected state**, because it has none — a toggle stays lit to
          say it is still doing something, and this fires once and then vanishes with
          the condition that produced it. Two things tell it apart from a filter: it
          sits on the status line rather than in either chip row, and it wears a
          crossed-out funnel where every filter chip wears a bell or its asset's own
          icon. */}
      {filtered && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs text-tertiary">
            Showing {visibleStanding.length} of {standing.length} standing
          </span>

          <Badge
            asChild
            variant="element"
            size="md"
            className="cursor-pointer border-subtle transition-colors hover:bg-highlight"
          >
            <button
              type="button"
              onClick={() => {
                setCategories(new Set());
                setSeverities(new Set());
              }}
            >
              <FilterXIcon className="text-tertiary" aria-hidden="true" />
              <span className="text-secondary">Clear filters</span>
            </button>
          </Badge>
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <AlarmLists
        standing={visibleStanding}
        cleared={visibleCleared}
        by={by}
        subject="this site"
        device="any device on the site"
        controls={controls}
        severityFilter={{
          counts: severityCounts,
          selected: severities,
          onToggle: toggleSeverity,
        }}
      />

      {/* Where the rows came from, because the sources are not guessable from the
          table and the reader who needs to check one against its own tab needs to
          know which tab that is.

          It names **two** sources at a site with no monitoring unit and three where
          there is one, rather than listing all three everywhere and leaving a reader
          to wonder which registers they are being told about. This used to be the
          only page in the section gated on a unit being fitted, and the sentence was
          written for the one site that has one. */}
      <p className="max-w-prose text-xs text-tertiary">
        This queue is every alarm standing on the site, pooled from{' '}
        {unit === undefined ? 'the two things' : 'the three things'} that raise one
        here:{' '}
        {unit !== undefined && <>the monitoring unit's registers, </>}
        each genset controller's own bits, and the conditions this app derives from the
        generation series and the service schedule. It is the same set of rows as the
        battery, solar, cabinet and genset Alarms tabs added together — acknowledging
        or clearing one here does it there too, because it is one alarm and not a copy.
        {unit === undefined && (
          <>
            {' '}
            <span className="text-secondary">
              No monitoring unit is fitted at this site,
            </span>{' '}
            so nothing here reports on the plant, the cabinet or the bank — a quiet
            queue is the controllers asserting nothing, not the whole site having been
            checked.
          </>
        )}
      </p>

      {/* The page this tab used to be, folded away.

          It answers a different question — *what is this device set to watch* — and
          fifty-eight rows of it above a working queue would bury the queue. Closed by
          default and open in one click, which is the right weight for a reference
          table: the four people who need `0x5913` are reading the firmware's own map
          anyway, and everyone else is here for the rows at the top. */}
      {unit !== undefined && (
        <details className="rounded-lg border border-subtle bg-element">
          <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline">
            The whole poll table — {unit.alarmRows} registers the {unit.deviceName} is set
            to watch, and how far each can be trusted
          </summary>
          <div className="border-t border-subtle p-3">
            <PlantAlarmCatalogue siteId={siteId} category="ALL" subject="this site" standalone={false} />
          </div>
        </details>
      )}
    </div>
  );
};
