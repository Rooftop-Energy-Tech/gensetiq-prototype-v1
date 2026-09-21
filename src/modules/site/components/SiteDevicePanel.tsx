import type {ReactNode} from 'react';

import {Link} from '@tanstack/react-router';
import {ActivityIcon, DropletIcon} from 'lucide-react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {Badge} from '@/components/ui/badge';
import {amount, fuelFraction, fuelHeadline} from '@/lib/format';
import {TankGlyph} from '@/components/global/TankGlyph';
import {runTotalsIn} from '@/modules/genset/data/history';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {CurrentRunCard} from '@/modules/genset/components/detail/CurrentRunCard';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {useFuelIntegrity} from '@/modules/genset/data/fuelIntegrity';
import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {isLeak} from '@/modules/genset/types/fuelIntegrity.type';
import {deviceGensetId, gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {fromSite} from '../types/fromSearch.type';
import {siteFeed} from '../data/sites';
import type {SiteGenset, SiteSummary} from '../data/sites';
import {SiteDeviceCard} from './SiteDeviceCard';

/**
 * One device's detail, for the panel beside the single-line diagram.
 *
 * ## One at a time, and the diagram chooses which
 *
 * This used to be the page's last band: every device stacked full-width under the
 * chart, one row per kind of plant. The devices now sit **beside the drawing** and
 * a reader picks one by clicking its box, which changes what this file is for in
 * two ways worth writing down.
 *
 * It shows **one** card rather than a stack, so it takes the device as a prop and
 * holds no opinion about which. And it can afford to be about **any** set rather
 * than the lead one: the old band showed `summary.gensets[0]` and carried a
 * footnote counting the ones it wasn't showing, because a stack of three at a yard
 * of five reads as the whole yard. That footnote is gone, and not because the sets
 * were dropped — the diagram draws every one of them and now selects them
 * individually, so `genset:` keys carry an id and a four-set site has four
 * selectable boxes. The drawing was always the honest inventory; it is now the
 * navigation too.
 *
 * ## Why the figures are unchanged
 *
 * The panel is narrower than the band was, so `SiteDeviceFigures` wraps to one
 * figure per line at most widths instead of two or three across. That is left
 * alone deliberately: the drawing beside it is 380px tall at a solar hybrid and the
 * card has that height to spend, so the wrap costs nothing, and the alternative —
 * shrinking the design's 240px figure columns to make two fit — would be changing
 * the type to fit the furniture.
 *
 * ## What the frame's copy actually specifies
 *
 * The design's `Solar` and `Battery` rows both carry the genset's identity string
 * (`BGI1495 | FG Wilson 20 kVa`) and the genset's `Idle` badge, which is a
 * copy-paste of the first row rather than a statement about arrays. Reproducing it
 * literally would put a diesel engine's name on a roof, so each card here names its
 * own plant and reports the state that plant can actually be in — generating or
 * dark for an array, charging or discharging for a bank.
 */
export const SiteDevicePanel = ({
  summary,
  role,
  /** Which device to report on. `undefined` at a site with no plant at all. */
  device,
  now,
  telemetry,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  device: SiteDeviceKey | undefined;
  now: number;
  /** A reading over time about the selected device, placed at the foot of the card. */
  telemetry?: ReactNode;
}) => {
  const gensetId = device === undefined ? undefined : deviceGensetId(device);
  const member =
    gensetId === undefined
      ? undefined
      : summary.gensets.find(({genset}) => genset.id === gensetId);


  // `device` comes from `siteDevices` — through a reader's click and a fallback that
  // re-checks the list — so every branch below is reachable and the `undefined` tail
  // is the genuinely empty site rather than a lookup that failed. Written as a
  // fall-through anyway: a stale key surviving a role change must render the empty
  // state, not throw.
  if (member !== undefined) {
    return (
      <GensetDeviceCard
        siteId={summary.site.id}
        member={member}
        role={role}
        onLoad={member.genset.id === summary.defaultDutyId}
        now={now}
        telemetry={telemetry}
      />
    );
  }

  return (
    <p className="px-1 text-sm text-secondary">
No genset is standing at this site — there is nothing here to report on.
    </p>
  );
};
/**
 * Every device at this site that has a card, in the order the page ranks them.
 *
 * In `summary.gensets` order, which is attention-ordered — so a fallback that takes
 * the head of this list lands on the set that is turning, or the sickest if none is.
 * A yard's own plant is scenery in this product: the sets are the only boxes with a
 * card behind them.
 */
export const siteDevices = (summary: SiteSummary): Array<SiteDeviceKey> =>
  summary.gensets.map(({genset}) => gensetDeviceKey(genset.id));

/**
 * Which device the page opens on: **whatever is carrying the site.**
 *
 * A reader arriving at a site page is asking what is keeping the tower up, and the
 * drawing has already answered it in teal — so the panel beside it opening on that
 * same thing is the page agreeing with itself. It also means the two most common
 * arrival that matters needs no click at all: a set that has picked up an outage
 * opens on that set.
 *
 * `MAINS` and `NONE` fall through to the head of the list, because neither is a
 * device: an incomer has no card and an unserved site has nothing carrying it. The
 * `includes` guard is not defensive padding either — `siteFeed` can name a genset
 * this list has left out, at a site whose only set is missing from the fixture.
 */
export const siteDefaultDevice = (
  summary: SiteSummary,
  role: SitePowerRole,
  devices: Array<SiteDeviceKey>,
): SiteDeviceKey | undefined => {
  const feed = siteFeed(summary, summary.defaultDutyId, role);
  const carrying: SiteDeviceKey | undefined =
    feed.source === 'GENSET' ? gensetDeviceKey(feed.gensetId) : undefined;

  return carrying !== undefined && devices.includes(carrying) ? carrying : devices[0];
};

/*
 * There was a `hasAlarmsTab` helper here, and it is gone.
 *
 * It existed because the bank's and the array's Alarms tabs were gated on a
 * monitoring unit being fitted, so at twenty-four sites they were placeholders — and
 * an array at one of those can still carry a **derived** row, since this app's own
 * rules over the generation series need no device to fire. A badge reading `1` that
 * led to a page saying the feature was coming would have been a liar about its own
 * subject, so the badge went to the asset's home page instead.
 *
 * The gates are gone now — see the three alarm routes — and with them the reason for
 * the detour. Every badge points at the tab that lists its rows, which is what it
 * should always have done.
 */

/**
 * The genset card, and the only one of the three the design fills in completely:
 * the badge row, the tank, the leak notice and the last run.
 *
 * `CurrentRunCard` is the genset's own component, not a site-flavoured copy. The
 * design's `Last run` block *is* that card, down to the two stamps either side of a
 * down arrow and the three totals beside them, so rebuilding it here would be
 * maintaining a second copy of a card that already exists two directories away.
 */
const GensetDeviceCard = ({
  siteId,
  member,
  role,
  onLoad,
  now,
  telemetry,
}: {
  /** The yard this set stands in — carried into its links so they crumb back here. */
  siteId: string;
  member: SiteGenset;
  role: SitePowerRole;
  onLoad: boolean;
  now: number;
  telemetry?: ReactNode;
}) => {
  const {genset, detail} = member;
  const stateMeta = RUN_STATE_META[genset.runState];
  const StateIcon = stateMeta.icon;
  const conditionMeta = CONDITION_META[detail.condition];

  // The day's totals off the run log — the same sums the fuel chart is drawn
  // from, read here so they can sit beside the tank.
  const dayAnchor = new Date(now);
  const dayStart = new Date(
    dayAnchor.getFullYear(),
    dayAnchor.getMonth(),
    dayAnchor.getDate(),
  ).getTime();
  const today = runTotalsIn(genset.id, dayStart, dayStart + 86_400_000, now);

  /**
   * Everything standing on this machine — **both** things that report on it.
   *
   * Live, because a row cleared on the genset's Alarms tab has to leave this badge
   * on the way back to the site, and `detail.alerts` is the fixture's raw list and
   * cannot know about it.
   *
   * The second source is the correction. This counted the Deep Sea controller's own
   * bits and nothing else, which was right when the controller was the only thing
   * watching a set. The **site's monitoring unit** also watches the AC feeding the
   * rectifiers, and at a site with no utility incomer that AC is this engine's own
   * output — so a dropped phase there is a dropped phase here. Those rows are on the
   * genset's page and on its Alarms tab, and leaving them out made this card read
   * `2` against that page's `4`, one click apart.
   *
   * Same union as `GensetHome`, from the same two calls, so the badge and the page it
   * links to count one list.
   */
  const handling = useAlarmHandling();
  const alerts = standingAlarms(genset.id, handling);
  const plantStanding = plantAlarmQueue(genset.siteId ?? '', role, 'GENSET', handling).standing;
  const standing = [...alerts, ...plantStanding];
  const counts = countBySeverity(standing);

  // Live, so lowering the leak threshold on the settings tab raises the notice here
  // without a reload — the behaviour `useFuelIntegrity` exists for.
  const integrity = useFuelIntegrity(genset.id, now);

  const shortfallPercent =
    isLeak(integrity) && detail.fuel.maxLitres > 0
      ? Math.round((integrity.figures.confirmedShortfallLitres / detail.fuel.maxLitres) * 100)
      : undefined;

  return (
    <SiteDeviceCard
      telemetry={telemetry}
      label="Genset"
      identity={
        <Link
          to="/gensets/$gensetId"
          params={{gensetId: genset.id}}
          search={fromSite(siteId)}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          {/* The machine's own tag and model, not `gensetName` — `label` above
              already says `Genset`, and the name now leads with that word, so the
              helper would print it twice. This is the shape its two siblings use
              here as well: `PV array | 42 kWp`, `Bank | 96 kWh`, and the site is
              already known on this page, so the identity line's job is which
              machine and how big rather than which site. */}
          {genset.tag} | {genset.model}
        </Link>
      }
      aside={
        <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
      }
      badges={
        <>
          <Badge variant="secondary" className="whitespace-pre">
            <StateIcon className={stateMeta.iconClassName} aria-hidden="true" />
            {stateMeta.label}
            {/* A kW figure only while the engine turns *and* the changeover has this
                set on the bus. "0 kW" on a stopped set reads as a genset running
                into an open breaker, which is a different and real fault; and a
                running set whose load has been transferred away is delivering
                nothing here, however much its own controller is still metering. */}
            {detail.loadKw !== null && (
              <>
                <span className="text-secondary"> | </span>
                {onLoad ? amount(detail.loadKw, 'kW') : 'off-load'}
              </>
            )}
          </Badge>

          <Badge variant="secondary" className="whitespace-pre">
            <DropletIcon className="text-fuel" aria-hidden="true" />
            {fuelHeadline(genset.fuelLitres, genset.fuelCapacityLitres)}
          </Badge>

          <Badge variant="secondary">
            <ActivityIcon className={conditionMeta.textClassName} aria-hidden="true" />
            {conditionMeta.label}
          </Badge>

          {/* Only when there is something to say. A `0 0 0` badge is an
              alarm-shaped element on a healthy machine, which is how a row of
              badges stops being read. */}
          {standing.length > 0 && (
            <AlarmBadge
              counts={counts}
              to="/gensets/$gensetId/alarms"
              params={{gensetId: genset.id}}
              search={fromSite(siteId)}
            />
          )}
        </>
      }
    >
      {/* The level as the tank itself — the same segmented glyph the genset's
          own fuel panel draws, with the litres as the headline and the fraction
          under them. Beside it, the day's two answers off the run log: what the
          running cost and how long it ran — the barrel says what is left, the
          figures say what it took to get here. */}
      <div className="flex items-start gap-8 self-start">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] leading-none text-secondary">Fuel level</span>
          <TankGlyph
            fraction={fuelFraction(genset.fuelLitres, genset.fuelCapacityLitres)}
            tone="fuel"
          />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl leading-none font-semibold text-primary tabular-nums">
              {Math.round(genset.fuelLitres).toLocaleString('en-MY')} L
            </span>
            <span className="text-sm leading-none text-secondary tabular-nums">
              {Math.round(fuelFraction(genset.fuelLitres, genset.fuelCapacityLitres) * 100)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] leading-none text-secondary">Total fuel burned today</span>
            <span className="text-xl leading-none font-semibold text-primary tabular-nums">
              {Math.round(today.fuelLitres).toLocaleString('en-MY')} L
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] leading-none text-secondary">Total genset runtime</span>
            <span className="text-xl leading-none font-semibold text-primary tabular-nums">
              {Math.round((today.runtimeMs / 3_600_000) * 10) / 10} h
            </span>
          </div>
        </div>
      </div>

      {/* The design's discrepancy chip, and it is drawn only when there is one.
          A chip reading "0% fuel discrepancy" would be an alarm-shaped element at
          every healthy site, which is how a row of badges stops being read. */}
      {shortfallPercent !== undefined && (
        <Badge variant="element" className="self-start gap-1.5 rounded-xl">
          <ActivityIcon className="text-severity-warning" aria-hidden="true" />
          <span className="text-primary">{shortfallPercent}%</span>
          <span className="text-secondary">fuel discrepancy detected</span>
        </Badge>
      )}
    </SiteDeviceCard>
  );
};

