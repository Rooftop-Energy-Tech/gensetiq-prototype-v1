import {Link} from '@tanstack/react-router';
import {
  ActivityIcon,
  BatteryChargingIcon,
  BellIcon,
  DropletIcon,
  SunMediumIcon,
} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import {gensetName} from '@/modules/genset/types/genset.type';
import {gensetSearch} from '@/modules/genset/types/view.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {CurrentRunCard} from '@/modules/genset/components/detail/CurrentRunCard';
import {CONDITION_META, SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {useFuelIntegrity} from '@/modules/genset/data/fuelIntegrity';
import {isLeak} from '@/modules/genset/types/fuelIntegrity.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, solarMonths, todaySoFarKwh} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import type {SiteGenset, SiteSummary} from '../data/sites';
import {SiteDeviceCard, SiteDeviceFigures} from './SiteDeviceCard';

/**
 * The page's last band: the primary devices, stacked.
 *
 * ## What "primary" means, and why it is not "all"
 *
 * One row per **kind of plant on the bus**: the genset that is carrying or would
 * carry, the array, the bank. That is the design's three, and the brief's
 * instruction that this is not a device list is the important half — a yard with
 * four sets, two string inverters and a bank is eight devices, and eight rows is an
 * inventory. An inventory is a useful screen and it is not this one.
 *
 * So a multi-set site shows its **lead set** — `summary.gensets` is
 * attention-ordered, so that is the one turning, or the sickest if none is — and
 * says how many others there are with a way through to them. What it must not do is
 * silently drop them: a stack that looks like the whole yard at a site with three
 * more sets standing in it is the one failure mode this band has.
 *
 * ## Why they stack
 *
 * Because device count varies from one to three and a stack is the one arrangement
 * that does not care. Seventeen of the twenty-five sites on this estate have
 * exactly one device; a row of cards has to decide what fills the other two thirds
 * at every one of them, and every answer is either a stretched card or a hole. Rows
 * make one device and three devices the same layout at different heights, and the
 * figures line up down the page between them.
 *
 * ## What the frame's copy actually specifies
 *
 * The design's `Solar` and `Battery` rows both carry the genset's identity string
 * (`BGI1495 | FG Wilson 20 kVa`) and the genset's `Idle` badge, which is a
 * copy-paste of the first row rather than a statement about arrays. Reproducing it
 * literally would put a diesel engine's name on a roof, so each row here names its
 * own plant and reports the state that plant can actually be in — generating or
 * dark for an array, charging or discharging for a bank.
 */
export const SitePrimaryDevices = ({
  summary,
  role,
  now,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  now: number;
}) => {
  const seed = siteSeed(summary.site.id);
  const plant = seed === undefined ? undefined : hybridPlant(seed, role);
  const lead = summary.gensets[0];

  const solarFitted = seed !== undefined && hasSolar(role) && (plant?.solarKwp ?? 0) > 0;
  const batteryFitted = seed !== undefined && hasBattery(role) && (plant?.batteryKwh ?? 0) > 0;

  if (lead === undefined && !solarFitted && !batteryFitted) {
    return (
      <p className="px-1 text-sm text-secondary">
        No plant is installed at this site — there is nothing here to report on.
      </p>
    );
  }

  return (
    <section aria-label="Primary devices" className="flex flex-col gap-2">
      {/* The design's 8px between rows. Tighter than the 16px between bands, and
          deliberately so: these are one list, and spacing them like separate
          sections would break the column the figures read down. */}
      <div className="flex flex-col gap-2">
        {lead !== undefined && (
          <GensetDeviceCard member={lead} onLoad={lead.genset.id === summary.defaultDutyId} now={now} />
        )}

        {solarFitted && seed !== undefined && (
          <SolarDeviceCard siteId={summary.site.id} seed={seed} role={role} now={now} />
        )}

        {batteryFitted && seed !== undefined && (
          <BatteryDeviceCard seed={seed} role={role} plantKwh={plant?.batteryKwh ?? 0} autonomyHours={plant?.autonomyHours ?? 0} now={now} />
        )}
      </div>

      {/* The rest of the yard, named rather than hidden. See the note above. */}
      {summary.gensets.length > 1 && (
        <p className="px-1 text-xs text-tertiary">
          {summary.gensets.length - 1} more genset
          {summary.gensets.length - 1 === 1 ? '' : 's'} at this site ·{' '}
          <Link
            to="/gensets"
            // Through `gensetSearch()` rather than a bare `{q}`: a link type-checks
            // against the fleet's whole parsed search shape, and this is where its
            // defaults are kept so a call site that only cares about the query does
            // not have to restate `view`.
            search={gensetSearch({q: summary.site.name})}
            className="rounded-sm underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-outline"
          >
            see all plant
          </Link>
        </p>
      )}
    </section>
  );
};

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
  onLoad,
  now,
}: {
  member: SiteGenset;
  onLoad: boolean;
  now: number;
}) => {
  const {genset, detail} = member;
  const stateMeta = RUN_STATE_META[genset.runState];
  const StateIcon = stateMeta.icon;
  const conditionMeta = CONDITION_META[detail.condition];
  const counts = countBySeverity(detail.alerts);

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
      aside={<CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />}
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

          {detail.alerts.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="cursor-help gap-1.5">
                  <BellIcon className="text-secondary" aria-hidden="true" />
                  {ALERT_SEVERITIES.map((severity) => (
                    <span key={severity} className={SEVERITY_META[severity].textClassName}>
                      {counts[severity]}
                    </span>
                  ))}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-1">
                {ALERT_SEVERITIES.map((severity) => (
                  <span key={severity}>
                    {SEVERITY_META[severity].label} · {counts[severity]}
                  </span>
                ))}
              </TooltipContent>
            </Tooltip>
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
  now,
}: {
  siteId: string;
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
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
        <Badge variant="secondary">
          <SunMediumIcon
            className={state.solarKw > 0 ? 'text-solar' : 'text-tertiary'}
            aria-hidden="true"
          />
          {/* An array is generating or it is dark, and at night "Idle" would read as
              a fault rather than as the sun having set. */}
          {state.solarKw > 0 ? `Generating | ${amount(state.solarKw, 'kW')}` : 'Dark'}
        </Badge>
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

/** The bank: where its charge stands, and how long it would carry the site alone. */
const BatteryDeviceCard = ({
  seed,
  role,
  plantKwh,
  autonomyHours,
  now,
}: {
  seed: ReturnType<typeof siteSeed> & {};
  role: SitePowerRole;
  plantKwh: number;
  autonomyHours: number;
  now: number;
}) => {
  const state = hybridState(seed, role, now);
  const charging = state.batteryKw < 0;

  return (
    <SiteDeviceCard
      label="Battery"
      identity={`Bank | ${amount(plantKwh, 'kWh')}`}
      badges={
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
      }
    >
      <SiteDeviceFigures
        figures={[
          {label: 'Battery charge', value: `${Math.round(state.soc * 100)}`, unit: '%'},
          {
            // Hours from full, which is the figure that decides whether a genset has
            // to be sent for. A kWh capacity alone does not answer it.
            label: 'Autonomy from full',
            value: `${Math.round(autonomyHours * 10) / 10}`,
            unit: 'h',
          },
        ]}
      />
    </SiteDeviceCard>
  );
};
