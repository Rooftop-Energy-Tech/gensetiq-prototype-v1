import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {plantAlarmQueue, plantAlarmsWatched} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';

/**
 * The cabinet's Alarms tab — the seventeen rows of the `SITE` category.
 *
 * ## This tab needed no new data at all
 *
 * Which is the strongest argument that the cabinet should have been an asset all
 * along. The 2026-09-08 recategorisation drew the alarm buckets on **where the thing
 * physically is** — anything that is a module in the subrack is `SITE`, whatever it
 * converts — and the result is a category every one of whose rows is inside or on
 * this box: both surge arresters, the DC bus over/undervoltage pair, the load fuse in
 * the `DCDU-600AN1`, the door, water and smoke sensors on the enclosure itself, the
 * four rectifier rows, and `SSU Lost` plus the four per-slot SSU faults.
 *
 * So there was a complete, correctly-routed alarm list for an asset with no page to
 * put it on, and the site's own tab was carrying it under a chip that named the page
 * a reader was already looking at. The chip now says `Cabinet` and points here.
 *
 * The category **id** is still `SITE`, which is not sloppiness — see
 * `PLANT_ALARM_CATEGORY_LABEL`. It is what the poll set calls these rows and what
 * the source document calls them, and renaming it would edit seventeen rows of
 * `plantAlarms.ts` to say the same thing in a different word.
 *
 * ## What the shelf can and cannot tell you about itself
 *
 * Four of these rows are about the rectifiers and **all four describe the group**:
 * missing, abnormal, comms failure, low remaining capacity. There is no per-module
 * rectifier row, and that is deliberate — their addresses are hand-set on the LCD,
 * 1–60, and nobody has confirmed the six here were addressed, so `Rectifier 3 Fault`
 * would be a real value under a wrong name. The Devices rack draws that gap rather
 * than hiding it: every rectifier card reads `not reported`.
 *
 * The five SSU rows are the opposite. Identity is positional — each module reads its
 * slot off detection pins — so `SSU 3 Fault` is trustworthy per slot, and the rack
 * marks the slot it names.
 *
 * ⚠️ **`Rectifiers Comms Failure` is the subtlest row here.** It does not say the
 * rectifiers stopped working; it says the monitoring unit lost the internal CAN bus
 * and is **blind**, so the shelf's telemetry goes stale while still returning its
 * last values. Everything on the home page — the dial, the module cards, the
 * headroom — is downstream of that bus.
 */
export const CabinetAlarms = ({cabinetId}: {cabinetId: string}) => {
  const handling = useAlarmHandling();
  const session = useSession();
  const by = session?.email ?? 'operator';

  // A cabinet's id *is* its site's — one DC plant per site — so no lookup is needed
  // to get from the route's param to the unit on this cabinet's own wall.
  const role = useSitePowerRole(cabinetId);
  const {standing, cleared} = plantAlarmQueue(cabinetId, role, 'SITE', handling);

  const watched = plantAlarmsWatched(cabinetId, role, 'SITE');

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <AlarmLists
        standing={standing}
        cleared={cleared}
        by={by}
        subject="this cabinet"
        device="the monitoring unit"
      />

      {/* The denominator, so the site tab's cross-reference reconciles with this
          page — and the split inside it, because seventeen rows about one box come
          from four quite different kinds of sensor and a reader deciding what to
          carry to site needs to know which. */}
      {watched > 0 && (
        <p className="max-w-prose text-xs text-tertiary">
          The monitoring unit on this cabinet's wall polls {watched} registers against
          it: the shelf as a group and each solar unit by slot, the DC bus it delivers
          on, the load fuse and both surge arresters, and the door, water and smoke
          sensors on the enclosure. Five of those describe the rectifiers, and none of
          them names a module — their addresses are hand-set, so the shelf can only
          report itself as a whole. The same rows appear on the site's Alarms tab,
          pooled with the bank's, the array's and the gensets'.
        </p>
      )}
    </div>
  );
};
