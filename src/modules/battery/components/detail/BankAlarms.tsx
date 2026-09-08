import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {plantAlarmQueue, plantAlarmsWatched} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';

/**
 * The bank's Alarms tab.
 *
 * ## Why the storage module borrows the genset module's alarm machinery
 *
 * Because there is one alarm system, and the genset module is where it was built.
 * The two tables, the two-axis handling model and the store behind it are not about
 * diesel — they are about *an alarm and what a person did with it* — and
 * `health.type.ts` already established the rule for this: the solar module aliases
 * the genset's severities rather than redeclaring them, on the grounds that an
 * operator reading `Attention` on one page and `Degraded` on the next would
 * reasonably assume the two meant different things. Re-implementing the tables here
 * would be that mistake with more code.
 *
 * ## Why storage turned out to be the best-instrumented thing on the site
 *
 * This tab's placeholder used to say that the alarm column reads zero at every bank
 * on the estate not because they are all healthy but because no rule had ever been
 * written — storage being the one component whose failure takes the site down. That
 * is still true of the twenty-four sites with no monitoring unit.
 *
 * At the one that has a unit it is emphatically not: **twenty-eight of the
 * fifty-eight registers in its poll table are about the battery** — the bank's
 * discharge state, its temperatures and its fuse, the four load-shed stages and the
 * battery's own disconnect, and one row per lithium module.
 *
 * ## What is still missing, and it is the same gap
 *
 * Cell imbalance and state-of-charge thresholds, which the old placeholder named,
 * and none of the twenty-eight supply them. Half a dozen `0x5520`-block registers
 * would, and they were deliberately left out of the poll set: their index runs to
 * six and this bank has thirteen modules, so nobody can yet say whether they count
 * modules or the three 200 A branches. Adding a critical alarm under a
 * possibly-wrong label is the worst outcome available.
 */
export const BankAlarms = ({bankId}: {bankId: string}) => {
  const handling = useAlarmHandling();
  const session = useSession();
  const by = session?.email ?? 'operator';

  // A bank's id *is* its site's — one bank per site in this model — so no lookup is
  // needed to get from the route's param to the unit on the wall beside it.
  const role = useSitePowerRole(bankId);
  const {standing, cleared} = plantAlarmQueue(bankId, role, 'BATTERY', handling);

  const watched = plantAlarmsWatched(bankId, role, 'BATTERY');

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <AlarmLists
        standing={standing}
        cleared={cleared}
        by={by}
        subject="this bank"
        device="the monitoring unit"
      />

      {/* Which of the two zeros this bank's is — the whole reason this tab stopped
          being a placeholder.

          `Nothing standing` above means one of two completely different things and
          the table cannot tell them apart: **nothing wrong**, where a device is
          watching and asserting none of its rows, or **nothing watching**, where the
          zero is the absence of a sensor rather than the absence of a fault. The
          source document is explicit that the second must never be presented as
          reassurance, and a bare empty table does exactly that.

          So one of these two paragraphs is always drawn. The first also carries the
          denominator, so the site tab's cross-reference reconciles with this page,
          and names the five rows that are never asserted here — their absence is a
          deliberate rule rather than luck: each one claims load is off the air, and
          every other screen for this site says it is up and generating. */}
      {watched > 0 ? (
        <p className="max-w-prose text-xs text-tertiary">
          The site's monitoring unit polls {watched} registers against this bank — the
          most of any subsystem on the plant — and is asserting the rows above. Five of
          the {watched} are never asserted in this prototype: the four load-shed stages
          having actually shed, and the battery having been disconnected from the bus.
          Each of those means load is off the air, and the rest of this site's screens
          say it is up. The whole table is on the site's Alarms tab.
        </p>
      ) : (
        <p className="max-w-prose text-xs text-tertiary">
          <span className="text-secondary">Nothing is watching this bank.</span> There
          is no monitoring unit at this site, so no device reports on the battery and
          this app derives no rule over it — the queue above is empty because nothing
          could put a row in it, not because the bank has been checked and found well.
          A bank decides whether the tower stays up overnight, and it is the one asset
          here with no fallback source: a genset has its own controller everywhere and
          an array has this app's arithmetic, and storage has neither. At SBH-1336,
          where a unit is fitted, twenty-eight of its fifty-eight registers are about
          the battery.
        </p>
      )}
    </div>
  );
};
