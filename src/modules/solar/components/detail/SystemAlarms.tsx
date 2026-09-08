import {useState} from 'react';

import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {plantAlarmsWatched} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {solarAlarmQueue} from '../../data/solarAlarmQueue';
import {systemDetail} from '../../data/systemDetail';
import {useSolarSystem} from '../../data/systems';

/**
 * The array's Alarms tab — every alarm it is carrying, from both sources.
 *
 * ## Both sources, one queue
 *
 * This tab used to hold the registers alone and the home page's health band held
 * the derived rules alone, so the page and the strip that summarised it printed
 * different totals. They are one list now, built by `solarAlarmQueue`, and this is
 * the only screen where a row from either source can be acted on.
 *
 * The distinction between them is not lost by merging, because it decides which page
 * to believe about a given morning. The model can see that output stepped down in
 * March and nothing on the roof can; the device can tell a cloud from a dead string
 * and the model cannot — `PV N Array Fault` is the only register in the whole poll
 * table that separates those two, which is why all four were taken. So a derived row
 * says `Derived` in the `Class` column and names its rule where the others name a box
 * and a register.
 *
 * ## How these are ranked
 *
 * Off the register map's `Sev` column, like every row on every one of these tabs.
 * All four `PV N Array Fault` rows are `MA` and come out critical.
 *
 * ## 🆕 Why the conversion units are not on this tab
 *
 * They were, and they moved to the **site** on 2026-09-08. `SSU Lost` and the four
 * `SSU N Fault` rows are modules in the power cabinet's subrack, in the same shelf as
 * the rectifiers, and a category here answers *who is dispatched* — the person who
 * swaps an SSU is the person who swaps a rectifier. What an SSU converts is solar;
 * where it is, is the plant. `plantAlarms.ts` carries the rule and the hardware it
 * is drawn from.
 *
 * What is left is the array itself: fifteen strings across four junction boxes, and
 * `PV N Array Fault` is the only register in the whole poll table that tells a dead
 * one from a cloud.
 *
 * ⚠️ **The consequence is that `SSU N` and `PV N` — the device's best diagnostic pair
 * — now sit on two different tabs.** SSU 3 faulted with PV 3 clear is a module to
 * swap; PV 3 faulted with SSU 3 clear is a string to trace; both asserted is the
 * ambiguous case. The **site's** pooled Alarms tab is the one screen that shows all
 * four categories in one queue, which is where the pair stays readable together.
 */
export const SystemAlarms = ({systemId}: {systemId: string}) => {
  const handling = useAlarmHandling();
  const session = useSession();
  const by = session?.email ?? 'operator';

  // One clock reading for the page, so two rows' ages cannot land either side of a
  // minute boundary. Every screen in this app that shows a relative time does this.
  const [now] = useState(() => Date.now());

  // A system's id is its site's, as a bank's is: one array per site, feeding one
  // −48 V bus. See `solar/data/systems.ts`.
  const system = useSolarSystem(systemId, now);
  const detail = system === undefined ? undefined : systemDetail(system, now, false);

  const queue =
    system === undefined || detail === undefined
      ? {standing: [], cleared: []}
      : solarAlarmQueue(system, detail, now, handling);

  const watched =
    system === undefined ? 0 : plantAlarmsWatched(systemId, system.role, 'SOLAR');

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <AlarmLists
        standing={queue.standing}
        cleared={queue.cleared}
        by={by}
        subject="this array"
        device="the monitoring unit"
      />

      {/* The denominator. Four registers is the whole of what the device knows about
          the array *itself*, and a reader who has seen `Solar 4` on the site tab's
          cross-reference and then finds two rows here needs to be told that two are
          being watched rather than that they have gone missing.

          It says `array` rather than `system` on purpose. The five conversion-unit
          rows that used to be counted here are now `SITE` — see the note above — so a
          reader who remembers nine registers is owed the explanation rather than left
          to notice the number shrank. */}
      {watched > 0 ? (
        <p className="max-w-prose text-xs text-tertiary">
          The site's monitoring unit polls {watched} registers against this array — one
          per string group, each separating a dead string from a passing cloud — and is
          asserting some of them; the whole table is on the site's Alarms tab. The
          conversion units the array feeds are watched too, by another five registers,
          but they are modules in the site's own cabinet and are counted there. Rows
          marked <span className="text-secondary">Derived</span> are not from the device
          at all: they are this app's own arithmetic over the generation series and the
          service schedule, and the system's home page draws each one against the
          reading behind it.
        </p>
      ) : (
        // The other twenty-four sites, where every row here is `Derived` and the
        // column already says so. What it cannot say is what is *missing*: a dead
        // string at this array is invisible, because nothing here separates it from a
        // cloud. That is a real limit on this page and the reader should have it.
        <p className="max-w-prose text-xs text-tertiary">
          Every row here is{' '}
          <span className="text-secondary">Derived</span> — this app's own arithmetic
          over the generation series and the service schedule, not a device's claim. No
          monitoring unit is fitted at this site, so nothing reports on the array
          itself, and the one thing that arithmetic cannot see is a dead string: less
          current off the roof looks the same as a cloud going over. At SBH-1336 four
          registers separate the two.
        </p>
      )}
    </div>
  );
};
