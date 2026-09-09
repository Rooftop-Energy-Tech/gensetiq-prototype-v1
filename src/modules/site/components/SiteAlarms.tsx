import {useState} from 'react';
import {FilterXIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {CATEGORY_META} from './categoryMeta';
import {monitoringUnit} from '../data/monitoringUnit';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {CABINET_PARTS, PLANT_ALARM_CATEGORIES} from '../types/plantAlarm.type';
import type {CabinetPart, PlantAlarmCategory} from '../types/plantAlarm.type';
import {PART_META} from './partMeta';
import {PlantAlarmCatalogue} from './PlantAlarmCatalogue';

/**
 * One filter chip, used by both rows of them.
 *
 * Extracted when the cabinet's parts became a second row: the category chips and the
 * part chips are the same control at two tiers, and two copies of the same twenty
 * lines is how the tiers end up looking subtly unalike — a different hover, a
 * different dimming rule — and reading as two different kinds of thing.
 *
 * `count === 0 && !on` dims it rather than dropping it. A chip that would show
 * nothing is still information: `Enclosure 0` says the door is shut and the box is
 * dry, which is a different statement from the chip not being there.
 */
const FilterChip = ({
  label,
  icon: Icon,
  count,
  on,
  onToggle,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  on: boolean;
  onToggle: () => void;
}) => (
  <Badge
    asChild
    variant="element"
    size="md"
    className={cn(
      'cursor-pointer border-subtle transition-colors hover:bg-highlight',
      on && 'border-default bg-highlight',
      count === 0 && !on && 'opacity-50',
    )}
  >
    <button type="button" aria-pressed={on} onClick={onToggle}>
      <Icon className="text-tertiary" aria-hidden="true" />
      <span className={on ? 'text-primary' : 'text-secondary'}>
        {label} {count}
      </span>
    </button>
  </Badge>
);

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
  /**
   * The third tier: which part of the cabinet, drawn under the `Cabinet` chip.
   *
   * Only `Cabinet` gets one, because it is the only category that is not one thing.
   * A bank is a bank and an array is an array; the cabinet is a box with a shelf of
   * modules in it, and at a grid-backed site it is the biggest category on the plant
   * — twenty-six rows spanning a smoke detector, a bus voltage, six rectifiers and
   * four converters. "Something in the cabinet is wrong" does not tell a technician
   * what to put in the van, and these five chips do. See `CabinetPart`.
   */
  const [parts, setParts] = useState<ReadonlySet<CabinetPart>>(new Set());

  const {standing, cleared} = useSiteAlarmQueue(siteId, now);
  const unit = monitoringUnit(siteId);

  const inCategories = (row: {asset?: PlantAlarmCategory}): boolean =>
    categories.size === 0 || (row.asset !== undefined && categories.has(row.asset));
  const inSeverities = (row: {severity: AlertSeverity}): boolean =>
    severities.size === 0 || severities.has(row.severity);

  /**
   * The part filter narrows the cabinet and **only** the cabinet.
   *
   * `row.asset !== 'SITE'` passes, and that clause is what makes the tier nest
   * properly. A reader who has selected `Cabinet` and `Battery` and then `Rectifiers`
   * wants the rectifier rows *and* all the battery rows — not the battery rows
   * silently dropped because a bank has no cabinet part. A third tier that quietly
   * filtered its siblings would be a fourth top-level axis wearing an indent.
   */
  const inParts = (row: {asset?: PlantAlarmCategory; part?: CabinetPart}): boolean =>
    parts.size === 0 ||
    row.asset !== 'SITE' ||
    (row.part !== undefined && parts.has(row.part));

  const passes = (row: {
    asset?: PlantAlarmCategory;
    part?: CabinetPart;
    severity: AlertSeverity;
  }): boolean => inCategories(row) && inSeverities(row) && inParts(row);

  /**
   * Each axis counted against the other's selection. See the note above on why.
   *
   * These are the *standing* rows only. The cleared table is filtered by the same
   * selection but never counted into a chip — a log is not a workload.
   *
   * The part row is the one exception worth stating: it counts cabinet rows past the
   * severity filter and ignores the category selection entirely, because it is only
   * ever drawn while `Cabinet` is on. Folding that in would count every part chip
   * against a condition that is already true.
   */
  const severityCounts = countBySeverity(
    standing.filter((row) => inCategories(row) && inParts(row)),
  );
  const categoryCounts = standing.filter(inSeverities);
  const partCounts = standing.filter((row) => row.asset === 'SITE' && inSeverities(row));

  const visibleStanding = standing.filter(passes);
  const visibleCleared = cleared.filter(passes);

  const filtered = categories.size > 0 || severities.size > 0 || parts.size > 0;

  /**
   * One toggle for a row of chips — a `Set` of whatever that row's values are.
   *
   * Written generically because the rows behave identically and a second copy is a
   * second chance for one of them to stop clearing on a re-click. Two of the three
   * use it; the category row has its own because turning `Cabinet` off has to disarm
   * the tier underneath it.
   */
  const toggler =
    <Value,>(set: (update: (current: ReadonlySet<Value>) => ReadonlySet<Value>) => void) =>
    (value: Value) =>
      set((current) => {
        const next = new Set(current);
        if (!next.delete(value)) next.add(value);
        return next;
      });

  const toggleSeverity = toggler<AlertSeverity>(setSeverities);
  const togglePart = toggler<CabinetPart>(setParts);

  /**
   * The category toggle, which is no longer generic — it has a tier under it.
   *
   * Turning `Cabinet` off **clears the part selection**, because a filter a reader
   * cannot see must not still be narrowing the table. `inParts` would also let those
   * rows through once `Cabinet` left the selection, so the table would be correct
   * either way; what this prevents is the surprise on the way back — clicking
   * `Cabinet` on again and finding only rectifiers, filtered by a chip row that was
   * not on screen when the choice was made.
   *
   * Written out rather than passed through `toggler` for that one reason. The
   * generic version is still what the other two rows use.
   */
  const toggleCategory = (category: PlantAlarmCategory): void => {
    const next = new Set(categories);
    if (!next.delete(category)) next.add(category);

    setCategories(next);
    if (!next.has('SITE')) setParts(new Set());
  };

  /**
   * The asset chips, the cabinet's parts under them, and then what the chip rows
   * have left standing.
   *
   * Two rows rather than one that wraps. The chips are the control; the `Showing …`
   * line is a **readout of what the control did**, so it belongs under the whole set
   * rather than trailing the last chip — where its position shifted every time a
   * chip's count changed width, which is the one thing a status line must not do. A
   * reader looking for the number had to find it first.
   *
   * With the severity row that `AlarmLists` puts above, the stack reads top to bottom
   * as: narrow by how bad, narrow by what, narrow by which part of it, here is what is
   * left. The third of those appears only under `Cabinet`, which is the only category
   * with parts to narrow — see the note on `parts`.
   */
  const controls = (
    <div className="flex flex-col gap-2.5">
      {/* The four assets. Dimmed at zero and still clickable, exactly as a zero
          severity chip is: turning one on to see an explicit "nothing from the
          battery" is a legitimate answer, and a disabled control makes a reader
          wonder whether it is broken. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PLANT_ALARM_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            label={CATEGORY_META[category].label}
            icon={CATEGORY_META[category].icon}
            count={categoryCounts.filter((row) => row.asset === category).length}
            on={categories.has(category)}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>

      {/* The five parts of the cabinet, and only while the cabinet is selected.
          Indented behind a rule rather than sitting in the row above, because it is a
          tier and not a fifth asset. The three rows read down as *how bad*, *what*,
          *which bit of it* — each one narrowing what the row above it left.

          It is drawn from `categories.has('SITE')` rather than from a chip's own
          expand state, so there is one thing to click and no second control that can
          disagree with it: the parts are visible exactly when the category they
          belong to is in play. */}
      {categories.has('SITE') && (
        <div className="flex flex-wrap items-center gap-1.5 border-l border-subtle pl-3">
          {CABINET_PARTS.map((part) => (
            <FilterChip
              key={part}
              label={PART_META[part].label}
              icon={PART_META[part].icon}
              count={partCounts.filter((row) => row.part === part).length}
              on={parts.has(part)}
              onToggle={() => togglePart(part)}
            />
          ))}
        </div>
      )}

      {/* Only while something is on. A permanent `11 of 11` is a number that never
          says anything, and its absence is what makes the filtered case read as a
          state somebody chose. It counts the standing table because that is what the
          chips count; the cleared table narrows with it silently.

          The reset clears **all three** rows. With three multi-select axes a reader
          can reach a combination with nothing in it — `Neutral` plus `Battery`, or
          `Cabinet` plus `Enclosure` plus `Critical` on a site with a shut door — and
          working out which of up to twelve chips to click off again is not a puzzle
          an empty table should set. It is also the only control that clears the part
          row without going through the category above it.

          It is a chip like the ones it undoes rather than the underlined link it
          started as, which had put the control that turns twelve filters off in a
          different visual language from the twelve that turn them on.

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
                setParts(new Set());
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
