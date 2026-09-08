import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {
  ActivityIcon,
  BatteryChargingIcon,
  BellIcon,
  DropletIcon,
  SunMediumIcon,
} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, fuelHeadline} from '@/lib/format';
import {BANK_RESERVE_LABEL} from '@/modules/battery/types/bank.type';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {gensetName} from '@/modules/genset/types/genset.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {CurrentRunCard} from '@/modules/genset/components/detail/CurrentRunCard';
import {CONDITION_META, SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {useFuelIntegrity} from '@/modules/genset/data/fuelIntegrity';
import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {isLeak} from '@/modules/genset/types/fuelIntegrity.type';
import {deviceGensetId, gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, solarMonths, todaySoFarKwh} from '../data/hybrid';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {siteSeed} from '../data/siteSeed';
import {siteFeed} from '../data/sites';
import type {SiteGenset, SiteSummary} from '../data/sites';
import {SiteDeviceCard, SiteDeviceFigures} from './SiteDeviceCard';

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
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  device: SiteDeviceKey | undefined;
  now: number;
}) => {
  const seed = siteSeed(summary.site.id);
  const plant = seed === undefined ? undefined : hybridPlant(seed, role);
  const gensetId = device === undefined ? undefined : deviceGensetId(device);
  const member =
    gensetId === undefined
      ? undefined
      : summary.gensets.find(({genset}) => genset.id === gensetId);

  /**
   * The array's and the bank's rows, taken as slices of **the site's own queue.**
   *
   * Not re-derived here, and that is the point. `useSiteAlarmQueue` is the union the
   * strip at the top of this page counts and the Alarms tab lists, with every row
   * tagged by the asset it belongs to — so slicing it is the one way of getting these
   * two numbers that cannot disagree with the two screens either side of it. A second
   * call to `assertedPlantAlarms` here would give the same answer today and be a
   * second place for it to stop doing so.
   *
   * One tag each is enough for these two because a site has one array and one bank.
   * The gensets are not sliced this way: a yard can have several, they share the
   * monitoring unit's AC rows, and each card is about one machine — so the genset
   * card does its own union, from the same two sources its own page does.
   *
   * Read before the branches below, not inside them: a hook cannot sit behind an
   * early return, and this component returns from four places.
   */
  const {standing} = useSiteAlarmQueue(summary.site.id, now);

  // `device` comes from `siteDevices` — through a reader's click and a fallback that
  // re-checks the list — so every branch below is reachable and the `undefined` tail
  // is the genuinely empty site rather than a lookup that failed. Written as a
  // fall-through anyway: a stale key surviving a role change must render the empty
  // state, not throw.
  if (member !== undefined) {
    return (
      <GensetDeviceCard
        member={member}
        role={role}
        onLoad={member.genset.id === summary.defaultDutyId}
        now={now}
      />
    );
  }

  if (device === 'solar' && seed !== undefined) {
    return (
      <SolarDeviceCard
        siteId={summary.site.id}
        seed={seed}
        role={role}
        alarms={standing.filter((row) => row.asset === 'SOLAR')}
        now={now}
      />
    );
  }

  if (device === 'battery' && seed !== undefined) {
    return (
      <BatteryDeviceCard
        siteId={summary.site.id}
        seed={seed}
        role={role}
        plantKwh={plant?.batteryKwh ?? 0}
        soh={plant?.soh ?? 0}
        alarms={standing.filter((row) => row.asset === 'BATTERY')}
        now={now}
      />
    );
  }

  return (
    <p className="px-1 text-sm text-secondary">
      No plant is installed at this site — there is nothing here to report on.
    </p>
  );
};

/**
 * Every device at this site that has a card, in the order the page ranks them.
 *
 * The gensets first and in `summary.gensets` order, which is attention-ordered — so
 * a fallback that takes the head of this list lands on the set that is turning, or
 * the sickest if none is. The array and the bank follow, as the design's rows did.
 *
 * The `Fitted` checks are the reason this is a function and not `hasSolar(role)` at
 * the call site: a site can be *declared* a solar hybrid on its settings tab and
 * still have no array in the dataset, and a selectable box with an empty card
 * behind it is worse than no box.
 */
export const siteDevices = (
  summary: SiteSummary,
  role: SitePowerRole,
): Array<SiteDeviceKey> => {
  const seed = siteSeed(summary.site.id);
  const plant = seed === undefined ? undefined : hybridPlant(seed, role);

  return [
    ...summary.gensets.map(({genset}) => gensetDeviceKey(genset.id)),
    ...(seed !== undefined && hasSolar(role) && (plant?.solarKwp ?? 0) > 0
      ? (['solar'] as const)
      : []),
    ...(seed !== undefined && hasBattery(role) && (plant?.batteryKwh ?? 0) > 0
      ? (['battery'] as const)
      : []),
  ];
};

/**
 * Which device the page opens on: **whatever is carrying the site.**
 *
 * A reader arriving at a site page is asking what is keeping the tower up, and the
 * drawing has already answered it in teal — so the panel beside it opening on that
 * same thing is the page agreeing with itself. It also means the two most common
 * arrivals need no click at all: a solar hybrid in daylight opens on its array, and
 * a set that has picked up an outage opens on that set.
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
    feed.source === 'GENSET'
      ? gensetDeviceKey(feed.gensetId)
      : feed.source === 'SOLAR'
        ? 'solar'
        : feed.source === 'BATTERY'
          ? 'battery'
          : undefined;

  return carrying !== undefined && devices.includes(carrying) ? carrying : devices[0];
};

/**
 * What this device is carrying, and the way through to the rows themselves.
 *
 * ## One element, three cards
 *
 * The genset card had this badge and the array's and the bank's did not, which made
 * the panel say different things depending on which box a reader had clicked: a set
 * with two criticals showed them, an array with two showed nothing and read as an
 * array with nothing wrong. There is no reason the count belongs to engines — every
 * asset here raises alarms, and the site's own strip at the top of the page counts
 * all of them together. So the badge is a component now and all three use it.
 *
 * ## Three numbers, coloured rather than labelled
 *
 * `Critical · Warning · Neutral`, in that order and in their own colours. It is the
 * treatment the design specifies and `MetricStrip` already uses at the top of this
 * same page — where the tooltip spells the order out, so a reader meeting the
 * pattern here has been taught it a few hundred pixels above.
 *
 * ## Why it is a link and no longer has a tooltip
 *
 * A count is a question — *which two?* — and the panel cannot answer it: there is no
 * room for a queue beside a drawing. Every one of these badges now goes to the tab
 * that can, so the reading is one click rather than a title, a nav and a tab.
 *
 * That costs the hover legend, because a target that is both clickable and hovered
 * is fussy — the pointer lands on it and two things happen. The legend is not lost:
 * it is the `title`, which is also the accessible name, so the numbers announce as
 * `Critical 2 · Warning 0 · Neutral 0` rather than as `2 0 0`.
 *
 * `to` and `params` are the caller's because the three assets have three routes.
 */
const AlarmBadge = ({
  counts,
  to,
  params,
}: {
  counts: Record<AlertSeverity, number>;
  to: LinkProps['to'];
  params?: LinkProps['params'];
}) => {
  const legend = ALERT_SEVERITIES.map(
    (severity) => `${SEVERITY_META[severity].label} ${counts[severity]}`,
  ).join(' · ');

  return (
    <Badge asChild variant="secondary" className="gap-1.5 transition-colors hover:bg-highlight">
      <Link
        to={to}
        params={params}
        aria-label={legend}
        title={legend}
        className="outline-none focus-visible:ring-2 focus-visible:ring-outline"
      >
        <BellIcon className="text-secondary" aria-hidden="true" />
        {ALERT_SEVERITIES.map((severity) => (
          <span key={severity} className={SEVERITY_META[severity].textClassName}>
            {counts[severity]}
          </span>
        ))}
      </Link>
    </Badge>
  );
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
  member,
  role,
  onLoad,
  now,
}: {
  member: SiteGenset;
  role: SitePowerRole;
  onLoad: boolean;
  now: number;
}) => {
  const {genset, detail} = member;
  const stateMeta = RUN_STATE_META[genset.runState];
  const StateIcon = stateMeta.icon;
  const conditionMeta = CONDITION_META[detail.condition];

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
      label="Genset"
      identity={
        <Link
          to="/gensets/$gensetId"
          params={{gensetId: genset.id}}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          {gensetName(genset)}
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
            />
          )}
        </>
      }
    >
      <SiteDeviceFigures
        figures={[{label: 'Fuel level', value: `${Math.round(genset.fuelLitres).toLocaleString('en-MY')}`, unit: 'L'}]}
      />

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

/** The array: what it has made today, and what it made last full month. */
const SolarDeviceCard = ({
  siteId,
  seed,
  role,
  alarms,
  now,
}: {
  siteId: string;
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
  /** This array's slice of the site's queue — see the note in `SiteDevicePanel`. */
  alarms: Array<AlarmView>;
  now: number;
}) => {
  const plant = hybridPlant(seed, role);
  const state = hybridState(seed, role, now);
  const months = solarMonths(seed, role, now);

  /**
   * The **last complete** month, not the running one.
   *
   * `solarMonths` ends on the month in progress, and a card headed "Generated last
   * month" showing eleven days of September against a full August is the mistake
   * `SolarMonth.inProgress` exists to prevent. So this steps back past it.
   */
  const lastFull = [...months].reverse().find((month) => !month.inProgress);

  return (
    <SiteDeviceCard
      label="Solar"
      identity={
        <Link
          to="/solar/$systemId"
          params={{systemId: siteId}}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          PV array | {amount(plant.solarKwp, 'kWp')}
        </Link>
      }
      badges={
        <>
          <Badge variant="secondary">
            <SunMediumIcon
              className={state.solarKw > 0 ? 'text-solar' : 'text-tertiary'}
              aria-hidden="true"
            />
            {/* An array is generating or it is dark, and at night "Idle" would read as
                a fault rather than as the sun having set. */}
            {state.solarKw > 0 ? `Generating | ${amount(state.solarKw, 'kW')}` : 'Dark'}
          </Badge>

          {alarms.length > 0 && (
            <AlarmBadge
              counts={countBySeverity(alarms)}
              to="/solar/$systemId/alarms"
              params={{systemId: siteId}}
            />
          )}
        </>
      }
    >
      <SiteDeviceFigures
        figures={[
          {
            label: 'Generated today',
            value: `${Math.round(todaySoFarKwh(seed, role, now)).toLocaleString('en-MY')}`,
            unit: 'kWh',
          },
          {
            label: 'Generated last month',
            value:
              lastFull === undefined
                ? '—'
                : `${Math.round(lastFull.actualKwh).toLocaleString('en-MY')}`,
            unit: lastFull === undefined ? undefined : 'kWh',
          },
        ]}
      />
    </SiteDeviceCard>
  );
};

/** The bank: where its charge stands, how long it would carry the site alone, and
 *  how much of the bank there still is to do it with. */
const BatteryDeviceCard = ({
  siteId,
  seed,
  role,
  plantKwh,
  soh,
  alarms,
  now,
}: {
  siteId: string;
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
  plantKwh: number;
  soh: number;
  /** This bank's slice of the site's queue — see the note in `SiteDevicePanel`. */
  alarms: Array<AlarmView>;
  now: number;
}) => {
  const state = hybridState(seed, role, now);
  const charging = state.batteryKw < 0;

  return (
    <SiteDeviceCard
      label="Battery"
      identity={
        // A link now that a bank has a page, the same move the solar row makes.
        // `bankId` is the site id — one bank per site.
        <Link
          to="/battery/$bankId"
          params={{bankId: siteId}}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          Bank | {amount(plantKwh, 'kWh')}
        </Link>
      }
      badges={
        <>
          <Badge variant="secondary" className="whitespace-pre">
            <BatteryChargingIcon
              className={charging ? 'text-battery' : 'text-tertiary'}
              aria-hidden="true"
            />
            {/* Which way the energy is going, and at what. The sign convention is
                `hybridState`'s: negative is into the bank. */}
            {charging ? 'Charging' : 'Discharging'}
            <span className="text-secondary"> | </span>
            {amount(Math.abs(state.batteryKw), 'kW')}
          </Badge>

          {alarms.length > 0 && (
            <AlarmBadge
              counts={countBySeverity(alarms)}
              to="/battery/$bankId/alarms"
              params={{bankId: siteId}}
            />
          )}
        </>
      }
    >
      <SiteDeviceFigures
        figures={[
          {label: 'Battery charge', value: `${Math.round(state.soc * 100)}`, unit: '%'},
          {
            // The figure that decides whether a genset has to be sent for tonight.
            // It used to be `Autonomy from full` — the specification, which answers a
            // question nobody is asking at 42% charge on an aged bank. That figure
            // has not been dropped; it is on the bank's own rail, in the details
            // tooltip beside the converter rating, and in the register's `Autonomy`
            // column — where nameplates belong.
            //
            // The label is the bank module's constant, not a literal, so this card
            // and the bank page's strip cannot end up wording one figure two ways.
            // `BANK_RESERVE_LABEL` carries the argument for the wording.
            label: BANK_RESERVE_LABEL,
            value: `${state.hoursLeft}`,
            unit: 'h',
          },
          {
            // Health next to the hours rather than next to the charge, because it is
            // the reason the hours are what they are.
            label: 'State of health',
            value: `${Math.round(soh * 100)}`,
            unit: '%',
          },
        ]}
      />
    </SiteDeviceCard>
  );
};
