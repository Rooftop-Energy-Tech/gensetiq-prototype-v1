import {siteSeeds} from '@/modules/site/data/siteSeed';
import type {Installation} from '../types/installation.type';
import {GENSETS} from './fleet';
import {fuelAt, historyStart, meteredBurn, runsInWindow} from './history';
import {spread, spreadBetween} from './spread';

/**
 * Installation records, in place of the asset API this prototype doesn't have.
 *
 * The production data model (Helios `DeploymentSession`) is the shape being
 * demonstrated, and this estate exercises the *stationary* end of it: a genset
 * is commissioned onto a plinth beside a tower and stays there, so it carries
 * **one open record** rather than a chain of postings. Where the mobile-fleet
 * build deals a machine four sites in sixty days, this one states the single
 * fact a permanent estate has: fitted here, since then, by them.
 *
 * Three rules, the same as `history.ts`:
 *
 *  1. **The present is a given.** The open record is at the site the fleet seed
 *     already places the machine at. The site page and the fleet list cannot
 *     disagree about where a machine stands, because both read the same fact.
 *  2. **Fuel figures come off the ladder.** `startFuelLitres` is a `fuelAt()`
 *     reading — the same curve every chart draws — taken at the run log's own
 *     horizon rather than at commissioning, because the tank ladder does not
 *     extend back years and a figure invented for a date nothing else covers
 *     would be the one number on the page that reconciles against nothing.
 *  3. **Same generator as everything else.** `spread()` on the genset's id, so
 *     a reload deals the identical record.
 *
 * Prototype caveat, deliberately accepted: attaching or detaching a set in the
 * UI moves the machine (see `./deployment.ts`) but does not close this record —
 * a real backend closes one and opens another on a swap-out, and that write
 * path is exactly what the production model adds.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CLOCK = Date.now();

/**
 * The contractor who commissioned the set, stable per installation.
 *
 * The mobile build quoted a lorry plate here, because dispatch is a lorry and a
 * driver and the plate is what the operations room asks for mid-move. Nothing
 * on this estate is mid-move. The equivalent fact is **who put it there**: the
 * party a commissioning question, a warranty claim or a plinth defect goes back
 * to, years after the day itself.
 */
const installer = (gensetId: string): string => {
  const contractors = [
    'Sarana Teknik',
    'Perintis Kuasa',
    'Metrotel Engineering',
    'Bina Janakuasa',
    'Rangkaian Bayu',
    'Teras Elektrik',
  ];
  return contractors[Math.floor(spread(gensetId, 'install/contractor') * contractors.length)];
};

const locationOf = (siteId: string): string =>
  siteSeeds().find((site) => site.id === siteId)?.locationLabel ?? 'Unknown';

/**
 * The one open record for a genset: fitted at its current site, commissioned
 * somewhere between one and six years ago.
 *
 * `startFuelLitres` is read at the run log's horizon rather than at the
 * commissioning date, and that is the one place this seed knowingly declines to
 * answer the question literally. The tank ladder covers sixty days; a level
 * dealt for a date three years back would be a figure with nothing behind it,
 * and every other number in this app is checkable against the curve beside it.
 * The horizon reading is the earliest one that is.
 */
const dealInstallation = (gensetId: string, siteId: string): Installation => {
  const ageYears = spreadBetween(gensetId, 'install/age-years', 1.1, 6.2);
  const startedAt = CLOCK - ageYears * 365 * DAY;

  return {
    id: `${gensetId}-inst-0`,
    gensetId,
    siteId,
    locationLabel: locationOf(siteId),
    installer: installer(gensetId),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: null,
    startFuelLitres: Math.round(fuelAt(gensetId, historyStart())),
    endFuelLitres: null,
  };
};

const INSTALLATIONS: Record<string, Array<Installation>> = Object.fromEntries(
  GENSETS.map((genset) => [
    genset.id,
    genset.siteId === null ? [] : [dealInstallation(genset.id, genset.siteId)],
  ]),
);

/** One genset's installations, newest first — one entry, or none if unfitted. */
export const gensetInstallations = (gensetId: string): Array<Installation> =>
  INSTALLATIONS[gensetId] ?? [];

/** Where a genset is fitted right now, or `undefined` if it is not fitted. */
export const currentInstallation = (gensetId: string): Installation | undefined => {
  const head = gensetInstallations(gensetId)[0];
  return head !== undefined && head.endedAt === null ? head : undefined;
};

/** Every installation in the estate, longest-standing first. */
export const allInstallations = (): Array<Installation> =>
  Object.values(INSTALLATIONS)
    .flat()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

export type InstallationTotals = {
  /** Hours the engine actually turned inside the window. */
  runtimeHours: number;
  /** Energy delivered across the window, kWh. */
  energyKwh: number;
  /** Diesel burned across the window, litres. */
  fuelBurnedLitres: number;
  /** Starts inside the window. */
  starts: number;
};

/**
 * What an installation has cost, read off the run log — not stored, so the
 * figures here are the same runs the Runs tab lists, clipped to its window.
 *
 * An open installation on this estate reaches back years and the run log covers
 * sixty days, so in practice this reports the log's whole span. That is the
 * honest answer rather than a shortfall: it is every run the app has.
 */
export const installationTotals = (installation: Installation): InstallationTotals => {
  const from = new Date(installation.startedAt).getTime();
  const to = installation.endedAt === null ? CLOCK : new Date(installation.endedAt).getTime();

  const runs = runsInWindow(installation.gensetId, from, to);
  let runtimeMs = 0;
  // Energy is the runs' own figures, prorated by how much of each run the
  // window actually contains — not derived back from fuel, which would undo the
  // load-dependent SFC and make the total disagree with the very runs it is
  // made of.
  let energyKwh = 0;
  for (const run of runs) {
    const startMs = new Date(run.startedAt).getTime();
    const endMs = run.endedAt === null ? CLOCK : new Date(run.endedAt).getTime();
    const clippedMs = Math.max(0, Math.min(endMs, to) - Math.max(startMs, from));
    runtimeMs += clippedMs;
    if (endMs > startMs) energyKwh += run.energyProducedKwh * (clippedMs / (endMs - startMs));
  }

  const fuelBurnedLitres = meteredBurn(installation.gensetId, from, to);

  return {
    runtimeHours: runtimeMs / HOUR,
    energyKwh,
    fuelBurnedLitres,
    starts: runs.length,
  };
};
