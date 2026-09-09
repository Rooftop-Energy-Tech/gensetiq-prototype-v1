import type {ReactNode} from 'react';

import {Link} from '@tanstack/react-router';
import {
  ActivityIcon,
  BatteryChargingIcon,
  BatteryIcon,
  DropletIcon,
  ServerIcon,
  SunMediumIcon,
} from 'lucide-react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {Badge} from '@/components/ui/badge';
import {amount, fuelHeadline} from '@/lib/format';
import {BANK_RESERVE_LABEL} from '@/modules/battery/types/bank.type';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {CurrentRunCard} from '@/modules/genset/components/detail/CurrentRunCard';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {useFuelIntegrity} from '@/modules/genset/data/fuelIntegrity';
import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {isLeak} from '@/modules/genset/types/fuelIntegrity.type';
import {useSubrackCabinet} from '@/modules/cabinet/data/cabinets';
import {siteHasCabinet} from '@/modules/cabinet/data/shelf';
import {deviceGensetId, gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, solarMonths, todaySoFarKwh} from '../data/hybrid';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {fromSite} from '../types/fromSearch.type';
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
  telemetry,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  device: SiteDeviceKey | undefined;
  now: number;
  /** A reading over time about the selected device, placed at the foot of the card. */
  telemetry?: ReactNode;
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
        siteId={summary.site.id}
        member={member}
        role={role}
        onLoad={member.genset.id === summary.defaultDutyId}
        now={now}
        telemetry={telemetry}
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
        telemetry={telemetry}
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
        telemetry={telemetry}
      />
    );
  }

  if (device === 'cabinet') {
    return (
      <CabinetDeviceCard
        siteId={summary.site.id}
        // The cabinet's rows are the site queue's `SITE` slice, sliced the same way
        // the array's and the bank's are — and `SITE` is the category that reads
        // `Cabinet` on every chip since the recategorisation. See
        // `plantAlarm.type.ts` on why the id and the word differ.
        alarms={standing.filter((row) => row.asset === 'SITE')}
        now={now}
        telemetry={telemetry}
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
 * The cabinet: what the shelf could carry, what the bus is delivering, and how warm
 * the box is.
 *
 * ## Why the figures are the page's own three
 *
 * `Rectifier capacity`, `Bus output` and `Enclosure` are exactly the summary band at
 * the head of the cabinet page, in the same order and off the same assembly. The
 * capacity moves into the identity line because that is where every other card puts
 * a rating — `PV array | 12 kWp`, `Bank | 93 kWh` — which leaves the two readings for
 * the figures.
 *
 * ## Why this card is taller than the other three, and allowed to be
 *
 * It used to end at those two readings, on the argument that it should keep "the same
 * shape as its three neighbours". That argument was wrong twice. The panel shows **one
 * card at a time**, so the four are never side by side and their heights never
 * actually compare — and the cabinet is the deepest asset in the app. Twenty-three
 * bays, two shelves and a monitoring unit sat behind a card that said less than the
 * bank's, whose whole subject is one percentage.
 *
 * So a spec block joins the readings, in `MetricRow` — the same label-left value-right
 * pair the shelf's bay panel and every details band use. Rows rather than more
 * figures, because at this panel's `18rem` minimum a third headline figure wraps to
 * its own line at 16px semibold and a fourth makes the card mostly numerals; and
 * because these are specification, not measurement, which is what the two shapes are
 * for.
 *
 * **The bus row comes first, and it is the exception** — it is measurement, and it is
 * here rather than in the figures because it elaborates the figure immediately above
 * it. `4.8 kW` then `53.5 V · 94 A` is one bus written twice, which is exactly how the
 * cabinet page's own strip prints it (there in brackets inside the value, which
 * `SiteDeviceFigures` cannot take — its value is a `string`, and widening it to
 * `ReactNode` for one card would put a hole in the other three).
 *
 * Then the make-up: the pair that decides whether the shelf can carry the tower
 * without the sun. It is the shelf band's caption on the cabinet page, and it is the
 * row that came off that page's details band when the band went — this is the card it
 * was already duplicating, so it is the one place it should have been all along.
 *
 * ## The badge says what is converting, and it can be nothing
 *
 * `carrying` has four states and two of them mean the shelf is passing none of the
 * tower: a bank carrying, which is this hybrid working exactly as bought, and an
 * unserved tower, which is an outage. `cabinet.type.ts` argues at length why those
 * must not collapse into one word, and the badge honours it — the icon dims for both
 * and the wording separates them.
 */
const CabinetDeviceCard = ({
  siteId,
  alarms,
  now,
  telemetry,
}: {
  siteId: string;
  /** This cabinet's slice of the site's queue — see the note in `SiteDevicePanel`. */
  alarms: Array<AlarmView>;
  now: number;
  telemetry?: ReactNode;
}) => {
  const cabinet = useSubrackCabinet(siteId, now);
  if (cabinet === undefined) return null;

  const converting = cabinet.carrying === 'RECTIFIERS' || cabinet.carrying === 'SSUS';
  const carryingLabel =
    cabinet.carrying === 'RECTIFIERS'
      ? 'Rectifiers carrying'
      : cabinet.carrying === 'SSUS'
        ? 'SSUs carrying'
        : cabinet.carrying === 'BATTERY'
          ? 'Shelf on standby'
          : 'Not served';

  return (
    <SiteDeviceCard
      telemetry={telemetry}
      label="Cabinet"
      identity={
        <Link
          to="/cabinet/$cabinetId"
          params={{cabinetId: siteId}}
          search={fromSite(siteId)}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          Subrack | {amount(cabinet.capacityKw, 'kW')}
        </Link>
      }
      badges={
        <>
          <Badge variant="secondary">
            <ServerIcon
              className={converting ? 'text-teal' : 'text-tertiary'}
              aria-hidden="true"
            />
            {carryingLabel}
          </Badge>

          {alarms.length > 0 && (
            <AlarmBadge
              counts={countBySeverity(alarms)}
              to="/cabinet/$cabinetId/alarms"
              params={{cabinetId: siteId}}
              search={fromSite(siteId)}
            />
          )}
        </>
      }
    >
      <SiteDeviceFigures
        figures={[
          {
            // `Not served` in words rather than `0 kW`, the same call the load box in
            // the diagram makes: a measurement of zero and an unserved tower are
            // different claims.
            label: 'Bus output',
            value: cabinet.loadKw === null ? 'Not served' : `${cabinet.loadKw.toFixed(1)}`,
            unit: cabinet.loadKw === null ? undefined : 'kW',
          },
          {label: 'Enclosure', value: `${cabinet.tempC.toFixed(1)}`, unit: '°C'},
        ]}
      />

      <div className="flex flex-col gap-1">
        {/* Drawn only where both figures exist, and **no em-dash where they do not**.
            An unserved tower has no bus current to report, and a `Bus — —` row would
            read as a measurement nobody recorded when the fact is that nothing is
            flowing — which the figure directly above already says in words. This is
            the same call the cabinet page's details band made about its two device
            rows, and the one the load box makes about `Not served`. */}
        {cabinet.busVolts !== null && cabinet.busAmps !== null && (
          <MetricRow
            label="Bus"
            value={`${amount(cabinet.busVolts, 'V', 1)} · ${amount(cabinet.busAmps, 'A')}`}
          />
        )}

        <MetricRow
          label="Rectifiers"
          value={`${cabinet.rectifiers} × ${amount(cabinet.rectifierKw, 'kW')}`}
        />
        {/* `Solar Supply Units`, the vendor's own words for the part, not `SSUs` — the
            badge above already says `SSUs carrying` because a badge has no room, and a
            spec row does. See `CABINET_PART_LABEL`. */}
        <MetricRow label="Solar Supply Units" value={`${cabinet.ssus}`} />
      </div>
    </SiteDeviceCard>
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
    // Last, as it is last in the site rail and for the same reason: the three above
    // are what a reader came for, and the cabinet is what they open once one of those
    // has sent them looking for a rectifier. `siteHasCabinet` is the same predicate
    // the drawing places its box on, so the box and this list cannot disagree about
    // whether the node is a control.
    ...(siteHasCabinet(summary.site.id, role) ? (['cabinet'] as const) : []),
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
  telemetry,
}: {
  siteId: string;
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
  /** This array's slice of the site's queue — see the note in `SiteDevicePanel`. */
  alarms: Array<AlarmView>;
  now: number;
  telemetry?: ReactNode;
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
      telemetry={telemetry}
      label="Solar"
      identity={
        <Link
          to="/solar/$systemId"
          params={{systemId: siteId}}
          search={fromSite(siteId)}
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
              search={fromSite(siteId)}
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
  telemetry,
}: {
  siteId: string;
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
  plantKwh: number;
  soh: number;
  /** This bank's slice of the site's queue — see the note in `SiteDevicePanel`. */
  alarms: Array<AlarmView>;
  now: number;
  telemetry?: ReactNode;
}) => {
  const state = hybridState(seed, role, now);
  const charging = state.batteryKw < 0;

  return (
    <SiteDeviceCard
      telemetry={telemetry}
      label="Battery"
      identity={
        // A link now that a bank has a page, the same move the solar row makes.
        // `bankId` is the site id — one bank per site.
        <Link
          to="/battery/$bankId"
          params={{bankId: siteId}}
          search={fromSite(siteId)}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          Bank | {amount(plantKwh, 'kWh')}
        </Link>
      }
      badges={
        <>
          <Badge variant="secondary" className="whitespace-pre">
            {/* The glyph changes with the direction, not just its colour. It was
                `BatteryChargingIcon` in both states — a battery **with a bolt through
                it** — so a discharging bank was drawn with the charging icon and only
                the tint said otherwise. At the 12px a badge gives an icon, a tint is
                not a word: the shape has to carry it. */}
            {charging ? (
              <BatteryChargingIcon className="text-battery" aria-hidden="true" />
            ) : (
              <BatteryIcon className="text-tertiary" aria-hidden="true" />
            )}
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
              search={fromSite(siteId)}
            />
          )}
        </>
      }
    >
      {/* The bank's own glyph, the same one the bank page's hero draws — so a reader
          who clicked this box on the diagram sees the battery they will see when they
          follow the link, and sees the bolt where the badge above says `Charging`.

          `lg` rather than the module card's `sm`, and that is the point of putting it
          here at all: the bolt is drawn at `lg` only, because 8px of bolt inside an
          18px body is a smudge. See `BatteryGlyph`.

          No `label`: the figure directly under it is `Battery charge — 70 %` in real
          text, so announcing the glyph too would read the level twice. That is the
          rule every other level in this app follows. */}
      <BatteryGlyph fraction={state.soc} charging={charging} />

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
