import {useSyncExternalStore} from 'react';

import {SITE_SEED} from '@/modules/site/data/siteSeed';
import type {MeterFitting, MeterPoint, PowerMeter} from '../types/meter.type';

/**
 * The metering estate, and where each device is fitted.
 *
 * ## Why some sites have none
 *
 * Because that is the truth of a real estate, and it is the case this module exists
 * to make visible. Metering is capital equipment fitted circuit by circuit, usually
 * to the sites somebody is billing or benchmarking; the rest have a genset controller
 * and nothing else. The app used to quote a grid figure at all seventeen sites, which
 * quietly claimed instrumentation that was never installed.
 *
 * The seed below is deliberately uneven, and each shape is on the map for a reason:
 *
 *  - **both circuits** (`ppu-001`, `ppu-002`, `pe-006`, `ppu-013`) — the sites
 *    somebody watches closely;
 *  - **mains only** (`ppu-005`, `ppu-008`) — billing metering, which goes blind
 *    the moment the site transfers to diesel;
 *  - **load only** (`pe-004`, `pmu-016`, `mg-017`) — consumption metering, which
 *    never does;
 *  - **nothing at all** (`pe-003`, `pe-007`, `ppu-009`, `ppu-010`, `pe-011`,
 *    `mg-012`, `pe-014`, `pe-015`) — eight of seventeen, so the unmetered case
 *    is the one a reader meets first rather than a corner;
 *  - **in stores** (`PM-0114`, `PM-0115`) — so a site's Metering section has something
 *    to fit without robbing another yard.
 *
 * Two sites are placed deliberately, because only two in this fleet have the **grid
 * actually carrying** — which is the one condition under which a missing meter is
 * visible on the diagram at all. `pe-014` has nothing fitted, so both its nodes
 * read `unmetered`; `mg-017`'s load meter is fitted and **offline**, so it reads
 * `no reading` beside an `unmetered` mains. A device that has gone quiet is a different
 * problem from one that was never bought — different words, different owner, different
 * fix — and putting the two a few pixels apart is the clearest way to say so.
 *
 * ## Same store shape as everything else configurable here
 *
 * `localStorage`, overrides only, keyed by meter id — see `genset/data/deployment.ts`,
 * whose reasoning applies unchanged. A fresh browser gets the seeded estate.
 *
 * This file imports `siteSeed.ts` and never `sites.ts`: site summaries read *meters*
 * to build their figures, so the dependency has to point this way or the two form a
 * cycle. Which is the same reason `siteSeed.ts` has no imports of its own.
 */

type MeterSeed = {
  serial: string;
  model: string;
  siteId: string | null;
  point: MeterPoint | null;
  online?: boolean;
};

// prettier-ignore
const METER_SEED: Array<MeterSeed> = [
  {serial: 'PM-0101', model: 'Schneider PM2200',   siteId: 'ppu-001',   point: 'MAINS'},
  {serial: 'PM-0102', model: 'Schneider PM2200',   siteId: 'ppu-001',   point: 'LOAD'},
  {serial: 'PM-0103', model: 'Socomec Countis E43',siteId: 'ppu-002',    point: 'MAINS'},
  {serial: 'PM-0104', model: 'Socomec Countis E43',siteId: 'ppu-002',    point: 'LOAD'},
  {serial: 'PM-0105', model: 'Schneider PM2200',   siteId: 'pe-006',    point: 'MAINS'},
  {serial: 'PM-0106', model: 'Schneider PM2200',   siteId: 'pe-006',    point: 'LOAD'},
  {serial: 'PM-0107', model: 'Socomec Countis E43',siteId: 'ppu-013',    point: 'MAINS'},
  {serial: 'PM-0108', model: 'Socomec Countis E43',siteId: 'ppu-013',    point: 'LOAD'},
  {serial: 'PM-0109', model: 'Acrel ADW300',       siteId: 'ppu-005',   point: 'MAINS'},
  {serial: 'PM-0110', model: 'Acrel ADW300',       siteId: 'ppu-008', point: 'MAINS'},
  {serial: 'PM-0111', model: 'Schneider PM2200',   siteId: 'pe-004',     point: 'LOAD'},
  {serial: 'PM-0112', model: 'Acrel ADW300',       siteId: 'pmu-016',    point: 'LOAD'},
  // Fitted and silent, at one of only two sites where the grid is actually carrying —
  // so `no reading` lands on screen beside `pe-014`'s `unmetered`.
  {serial: 'PM-0113', model: 'Socomec Countis E43',siteId: 'mg-017',   point: 'LOAD', online: false},
  {serial: 'PM-0114', model: 'Schneider PM2200',   siteId: null,          point: null},
  {serial: 'PM-0115', model: 'Acrel ADW300',       siteId: null,          point: null},
];

const SEEDED: Array<PowerMeter> = METER_SEED.map((seed) => ({
  id: seed.serial.toLowerCase(),
  serial: seed.serial,
  model: seed.model,
  fitting:
    seed.siteId !== null && seed.point !== null ? {siteId: seed.siteId, point: seed.point} : null,
  online: seed.online ?? true,
}));

const STORAGE_KEY = 'gensetiq.metering';

/** `meterId → fitting`, or `null` for stores. Only moved devices appear. */
type Fittings = Record<string, MeterFitting | null>;

const listeners = new Set<() => void>();

const read = (): Fittings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Fittings);
  } catch {
    return {};
  }
};

let fittings: Fittings = read();

const sameFitting = (left: MeterFitting | null, right: MeterFitting | null): boolean =>
  left === null || right === null
    ? left === right
    : left.siteId === right.siteId && left.point === right.point;

/**
 * The estate with fittings applied.
 *
 * One meter per circuit is enforced **here**, at the point the list is built, rather
 * than trusted to the control that writes the store. Two meters claiming the same
 * feeder is not a state the rest of the app should have to reason about — every
 * consumer asks "what is on this circuit" and expects one answer — so a later fitting
 * displaces an earlier one and the displaced device goes back to stores.
 */
const applyFittings = (current: Fittings): Array<PowerMeter> => {
  const fitted = SEEDED.map((meter) =>
    meter.id in current ? {...meter, fitting: current[meter.id]} : meter,
  );

  const claimed = new Set<string>();
  // Last writer wins, so walk backwards and let anything already claimed fall out.
  return fitted
    .slice()
    .reverse()
    .map((meter) => {
      if (meter.fitting === null) return meter;
      const key = `${meter.fitting.siteId}:${meter.fitting.point}`;
      if (claimed.has(key)) return {...meter, fitting: null};
      claimed.add(key);
      return meter;
    })
    .reverse();
};

let snapshot: Array<PowerMeter> = applyFittings(fittings);

const emit = () => {
  fittings = read();
  snapshot = applyFittings(fittings);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Every meter, fittings applied. Identity-stable between changes. */
export const meters = (): Array<PowerMeter> => snapshot;

export const subscribeMeters = (listener: () => void) => subscribe(listener);

export const useMeters = (): Array<PowerMeter> =>
  useSyncExternalStore(
    subscribeMeters,
    () => snapshot,
    () => snapshot,
  );

/** The meter on one circuit, if any. */
export const meterAt = (
  all: Array<PowerMeter>,
  siteId: string,
  point: MeterPoint,
): PowerMeter | undefined =>
  all.find((meter) => meter.fitting?.siteId === siteId && meter.fitting.point === point);

/** Devices in stores — the pool a site's Metering section fits from. */
export const spareMeters = (all: Array<PowerMeter>): Array<PowerMeter> =>
  all.filter((meter) => meter.fitting === null);

/** Fit a meter to a circuit, or send it back to stores with `null`. */
export const fitMeter = (meterId: string, fitting: MeterFitting | null) => {
  const seeded = SEEDED.find((meter) => meter.id === meterId);
  if (seeded === undefined) return;

  const next: Fittings = {...fittings};
  // Back where it was seeded means no override, so the store holds only real changes.
  if (sameFitting(fitting, seeded.fitting)) delete next[meterId];
  else next[meterId] = fitting;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the change just won't survive a reload. */
  }
  emit();
};

/** `Telco-001`, for the meters list. Site names never change, so the seed is enough. */
export const meterSiteName = (siteId: string): string =>
  SITE_SEED.find((seed) => seed.id === siteId)?.name ?? 'Unknown site';
