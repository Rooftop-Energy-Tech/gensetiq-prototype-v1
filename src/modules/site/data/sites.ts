import type {GensetCondition} from '@/modules/genset/types/alert.type';
import {RUN_STATES} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import {GENSETS} from '@/modules/genset/data/fleet';
import {gensetDetail} from '@/modules/genset/data/detail';
import type {GensetDetail} from '@/modules/genset/data/detail';
import type {Site, SiteKind} from '../types/site.type';

/**
 * The sites the fleet stands on, and everything the site pages report.
 *
 * Same rule as `genset/data/detail.ts`: **nothing is stated twice.** A site's
 * identity is seeded here — its display name and what kind of load it carries,
 * neither of which can be inferred from a diesel engine — and every *number* is
 * summed or ranked from the gensets that name it in `fleet.ts`. There is no
 * stored site load, site fuel figure or site condition to drift out of step with
 * the machines.
 *
 * The membership direction matters too. Sites do not list their gensets; gensets
 * name their site, and this file groups them. A site cannot therefore claim a unit
 * that doesn't exist, and a unit cannot be missing from the site it stands at —
 * both of which a hand-maintained member list eventually gets wrong.
 */

/** Identity only. Everything else about a site is derived from its gensets. */
type SiteSeed = {id: string; name: string; kind: SiteKind};

const SITE_SEED: Array<SiteSeed> = [
  {id: 'telco-001', name: 'Telco-001', kind: 'TELCO'},
  {id: 'data-002', name: 'Data-002', kind: 'DATA'},
  {id: 'telco-003', name: 'Telco-003', kind: 'TELCO'},
  {id: 'mfg-004', name: 'Mfg-004', kind: 'MANUFACTURING'},
  {id: 'tower-005', name: 'Tower-005', kind: 'TOWER'},
  {id: 'hosp-006', name: 'Hosp-006', kind: 'HOSPITAL'},
  {id: 'mfg-007', name: 'Mfg-007', kind: 'MANUFACTURING'},
  {id: 'airport-008', name: 'Airport-008', kind: 'AIRPORT'},
  {id: 'mfg-009', name: 'Mfg-009', kind: 'MANUFACTURING'},
  {id: 'telco-010', name: 'Telco-010', kind: 'TELCO'},
  {id: 'retail-011', name: 'Retail-011', kind: 'RETAIL'},
  {id: 'telco-012', name: 'Telco-012', kind: 'TELCO'},
  {id: 'data-013', name: 'Data-013', kind: 'DATA'},
  {id: 'retail-014', name: 'Retail-014', kind: 'RETAIL'},
  {id: 'mfg-015', name: 'Mfg-015', kind: 'MANUFACTURING'},
  {id: 'port-016', name: 'Port-016', kind: 'PORT'},
  {id: 'telco-017', name: 'Telco-017', kind: 'TELCO'},
];

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  TELCO: 'Telecoms exchange',
  DATA: 'Data centre',
  HOSPITAL: 'Hospital',
  MANUFACTURING: 'Manufacturing plant',
  RETAIL: 'Retail',
  PORT: 'Port terminal',
  AIRPORT: 'Airport',
  TOWER: 'Commercial tower',
};

/**
 * One genset at a site, with the half of its detail the site page needs.
 *
 * The full `GensetDetail` is carried rather than a reduction of it, because the
 * site page draws the genset's real run card and real control pad — the same
 * components its own home page uses. A summary struct here would mean maintaining
 * a second, thinner version of every figure those components already know how to
 * render.
 */
export type SiteGenset = {genset: Genset; detail: GensetDetail};

export type SiteSummary = {
  site: Site;
  /** Attention-ordered, so a faulted set leads the page. */
  gensets: Array<SiteGenset>;
  /**
   * Which set the changeover starts on — the one carrying the load, or the one
   * that would if the grid dropped now.
   *
   * A *default*, not a stored setting: the site page lets an operator transfer the
   * load, and that selection is component state. `undefined` at a site where
   * nothing here can take the load at all.
   */
  defaultDutyId: string | undefined;
  /** Nameplate across every set here, running or not. */
  ratedKw: number;
  runningCount: number;
  /** Sets we are hearing from. Not the same as running. */
  onlineCount: number;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /** Worst condition among the sets — a site is as healthy as its sickest unit. */
  condition: GensetCondition;
};

/** The set the changeover currently has on the bus, if any. */
export const dutyMember = (
  summary: SiteSummary,
  dutyId: string | undefined,
): SiteGenset | undefined => summary.gensets.find(({genset}) => genset.id === dutyId);

/**
 * What the site is drawing, or `null` when nothing is feeding the load.
 *
 * The duty set's output, **not** the sum of every running set's. Only one set is
 * connected to the bus at a time, so a second set that happens to be turning is
 * off-load and contributes nothing to what the customer is drawing. Summing them
 * would report a figure no meter at this site could ever read.
 */
export const siteDrawKw = (
  summary: SiteSummary,
  dutyId: string | undefined,
): number | null => {
  const duty = dutyMember(summary, dutyId);
  return duty?.genset.runState === 'RUNNING' ? duty.detail.loadKw : null;
};

/**
 * Is the site's load actually covered?
 *
 * A site is `COVERED` while something is feeding it, `STANDBY` while every set is
 * stopped but at least one is fit to start, and `EXPOSED` when nothing here can
 * pick the load up — every set faulted or unreachable. The third state is the
 * reason this exists: it is invisible on any individual genset's page, and it is
 * the thing somebody gets called at night about.
 */
export type SiteCoverage = 'COVERED' | 'STANDBY' | 'EXPOSED';

export const coverageOf = (summary: SiteSummary): SiteCoverage => {
  if (summary.runningCount > 0) return 'COVERED';
  const startable = summary.gensets.some(({genset}) => genset.runState === 'IDLE');
  return startable ? 'STANDBY' : 'EXPOSED';
};

const stateRank = (genset: Genset) => RUN_STATES.indexOf(genset.runState);

const buildSummary = (seed: SiteSeed): SiteSummary => {
  const members = GENSETS.filter((genset) => genset.siteId === seed.id)
    // `RUN_STATES` is declared worst-first, so a faulted set leads and the tag
    // breaks ties — the same order the fleet table uses, for the same reason.
    .sort((left, right) => stateRank(left) - stateRank(right) || left.tag.localeCompare(right.tag));

  const gensets: Array<SiteGenset> = members.flatMap((genset) => {
    const detail = gensetDetail(genset.id);
    return detail === undefined ? [] : [{genset, detail}];
  });

  // The yard's centre. Gensets at a site sit tens of metres apart, so the mean of
  // their positions is the site, and there is no separate site coordinate to keep
  // in step with them.
  const latitude = members.reduce((sum, g) => sum + g.latitude, 0) / (members.length || 1);
  const longitude = members.reduce((sum, g) => sum + g.longitude, 0) / (members.length || 1);

  return {
    site: {
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      // Every genset here reports the same placename by construction — see the
      // `siteId` note in `fleet.ts` — so the first one speaks for the site.
      locationLabel: members[0]?.locationLabel ?? 'Unknown',
      latitude,
      longitude,
    },
    gensets,
    // A running set if there is one — it is already carrying the load. Otherwise
    // the first set fit to pick it up, which is what "on standby" means. The
    // members are attention-ordered, so this is deterministic.
    defaultDutyId:
      members.find((genset) => genset.runState === 'RUNNING')?.id ??
      members.find((genset) => genset.runState === 'IDLE')?.id,
    ratedKw: gensets.reduce((sum, {detail}) => sum + detail.ratedKw, 0),
    runningCount: gensets.filter(({genset}) => genset.runState === 'RUNNING').length,
    onlineCount: gensets.filter(({detail}) => detail.online).length,
    fuelLitres: members.reduce((sum, g) => sum + g.fuelLitres, 0),
    fuelCapacityLitres: members.reduce((sum, g) => sum + g.fuelCapacityLitres, 0),
    // Worst wins, on the severity ordering the alert module already defines.
    condition: gensets.some(({detail}) => detail.condition === 'CRITICAL')
      ? 'CRITICAL'
      : gensets.some(({detail}) => detail.condition === 'ATTENTION')
        ? 'ATTENTION'
        : 'OPTIMUM',
  };
};

/**
 * Every site, built once at module load — the same reason `fleet.ts` and
 * `detail.ts` do: one clock reading and one pass, so two sites cannot report
 * figures derived from different moments.
 */
const SUMMARIES: Record<string, SiteSummary> = Object.fromEntries(
  SITE_SEED.map((seed) => [seed.id, buildSummary(seed)]),
);

export const SITE_SUMMARIES: Array<SiteSummary> = SITE_SEED.map((seed) => SUMMARIES[seed.id]);

export const siteSummary = (siteId: string): SiteSummary | undefined => SUMMARIES[siteId];

/** The site the design's frame opens on, and this section's default. */
export const DEFAULT_SITE_ID = 'telco-001';

/** `Telco-001`, for the breadcrumb and the document title. */
export const siteLabel = (siteId: string): string => SUMMARIES[siteId]?.site.name ?? 'Site';

/**
 * Sites in the order the list shows them: exposed first, then by how much is
 * wrong, then by name.
 *
 * Coverage leads rather than condition, because it is the more urgent question. A
 * site with a critical alert on a running set is still carrying its load; a site
 * with nothing able to start is not, even with a clean alert list.
 */
const COVERAGE_RANK: Record<SiteCoverage, number> = {EXPOSED: 0, STANDBY: 1, COVERED: 2};
const CONDITION_RANK: Record<GensetCondition, number> = {CRITICAL: 0, ATTENTION: 1, OPTIMUM: 2};

export const sortSites = (summaries: Array<SiteSummary>): Array<SiteSummary> =>
  [...summaries].sort(
    (left, right) =>
      COVERAGE_RANK[coverageOf(left)] - COVERAGE_RANK[coverageOf(right)] ||
      CONDITION_RANK[left.condition] - CONDITION_RANK[right.condition] ||
      left.site.name.localeCompare(right.site.name),
  );

/**
 * Free-text filter for the sites list.
 *
 * Matches what the row actually shows — the site's name, its placename and its
 * kind — plus the asset tags standing on it, because "where is BRF9540" is the
 * question a fleet operator arrives with and the tag is not otherwise on screen.
 */
export const searchSites = (
  summaries: Array<SiteSummary>,
  query: string,
): Array<SiteSummary> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return summaries;

  return summaries.filter((summary) =>
    [
      summary.site.name,
      summary.site.locationLabel,
      SITE_KIND_LABEL[summary.site.kind],
      ...summary.gensets.map(({genset}) => genset.tag),
    ].some((field) => field.toLowerCase().includes(needle)),
  );
};
