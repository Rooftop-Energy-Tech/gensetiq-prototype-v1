import {useSitePowerRole, sitePowerRole} from '@/modules/site/data/siteConfig';
import {enclosureTempC} from '@/modules/site/data/enclosure';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {siteDcBus, siteFeed, siteLoadKw, siteSummary, useSiteSummary} from '@/modules/site/data/sites';
import type {SiteSummary} from '@/modules/site/data/sites';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {SubrackCabinet} from '../types/cabinet.type';

/**
 * The cabinet at a site, assembled from what is already known about that site.
 *
 * ## Nothing new is invented except the shelf's rating
 *
 * The counts are `monitoringUnit`'s, which is the file that exists to hold **real
 * hardware** rather than sized guesses. The load, the bus voltage and the bus
 * current are `sites.ts`'s, the same three figures the site page's own strip prints,
 * so a reader moving from the site to its cabinet cannot be told two different
 * things about one bus. What is carrying comes from `siteFeed`, which is the same
 * function the site diagram colours its conductors from.
 *
 * The one addition is `rectifierKw`, and its note in `monitoringUnit.ts` is explicit
 * that it is a stated figure and not a read one.
 *
 * ## Why `carrying` is derived here and not asked of the reader
 *
 * Because both halves of this shelf are wired to the same bus and a page cannot show
 * both delivering. `siteFeed` already decides which source has the tower — it is
 * what turns the diagram's conductors teal — so this reads that decision rather
 * than making a second one. `MAINS` and `GENSET` both arrive through the rectifiers,
 * which is the fact that collapses five feed states into three:
 *
 * - the incomer or a set is carrying → **the rectifiers** are converting
 * - the array is carrying → **the SSUs** are
 * - the bank is carrying → neither is, and that is the plant working
 * - nothing is carrying → neither is, and that is an outage
 *
 * The last two are kept apart rather than folded into one "nothing converting", for
 * the reason `SubrackCabinet.carrying` gives: they are opposite facts wearing the
 * same symptom.
 */
const cabinetFrom = (
  summary: SiteSummary,
  role: SitePowerRole,
  now: number,
): SubrackCabinet | undefined => {
  const unit = monitoringUnit(summary.site.id);
  if (unit === undefined) return undefined;

  const feed = siteFeed(summary, summary.defaultDutyId, role);
  const carrying =
    feed.source === 'GENSET' || feed.source === 'MAINS'
      ? 'RECTIFIERS'
      : feed.source === 'SOLAR'
        ? 'SSUS'
        : feed.source === 'BATTERY'
          ? 'BATTERY'
          : 'UNSERVED';

  const loadKw = siteLoadKw(summary, summary.defaultDutyId, role);
  const bus = siteDcBus(summary, summary.defaultDutyId, role, now);
  const capacityKw = unit.rectifiers * unit.rectifierKw;

  return {
    id: summary.site.id,
    siteId: summary.site.id,
    siteName: summary.site.name,
    locationLabel: summary.site.locationLabel,
    deviceName: unit.deviceName,
    slaveId: unit.slaveId,
    rectifiers: unit.rectifiers,
    rectifierKw: unit.rectifierKw,
    ssus: unit.ssus,
    capacityKw,
    loadKw,
    busVolts: bus?.volts ?? null,
    busAmps: bus?.amps ?? null,
    carrying,
    /**
     * The subrack's own salt, so it does not read the battery cabinet's ambient.
     * Duty is against the shelf's ceiling and only while the shelf is the thing
     * working — a rectifier shelf sitting idle behind a generating array is not
     * warming itself, however much the tower is drawing.
     */
    tempC: enclosureTempC(
      summary.site.id,
      'cabinet/subrack-temp',
      carrying === 'RECTIFIERS' && loadKw !== null && capacityKw > 0
        ? loadKw / capacityKw
        : 0,
    ),
  };
};

/** One cabinet, or `undefined` — which is twenty-four of the twenty-five sites. */
export const subrackCabinet = (
  cabinetId: string,
  role: SitePowerRole,
  now: number = Date.now(),
): SubrackCabinet | undefined => {
  const summary = siteSummary(cabinetId);
  return summary === undefined ? undefined : cabinetFrom(summary, role, now);
};

/**
 * The loader's reader — the store's own function rather than the hook, because a
 * loader is not a component. Mirrors `bankForLoader` and `solarSystem`'s use in
 * their routes.
 */
export const cabinetForLoader = (
  cabinetId: string,
  now: number,
): SubrackCabinet | undefined =>
  subrackCabinet(cabinetId, sitePowerRole(cabinetId), now);

/**
 * `now` is required, for the reason both other asset hooks give: a default of
 * `Date.now()` is re-evaluated every render, which busts the memo and lets one page
 * read two clocks. Every caller holds one `const [now] = useState(() => Date.now())`
 * for the whole section and passes it in.
 *
 * Subscribed to the power-role store like `useBatteryBank` is, so flipping this
 * site's configuration on its settings tab is reflected here without a reload. It
 * matters more than it looks: the role decides what `siteFeed` says is carrying, so
 * turning a solar hybrid into a diesel yard moves this cabinet's work from its SSUs
 * to its rectifiers while the page is open.
 */
export const useSubrackCabinet = (
  cabinetId: string,
  now: number,
): SubrackCabinet | undefined => {
  const summary = useSiteSummary(cabinetId);
  const role = useSitePowerRole(cabinetId);
  return summary === undefined ? undefined : cabinetFrom(summary, role, now);
};
