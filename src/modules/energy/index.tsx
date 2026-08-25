import {Link} from '@tanstack/react-router';
import {useMemo, useState} from 'react';

import {cn} from '@/lib/utils';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {estateEnergy, hybridPlant, siteEnergy} from '@/modules/site/data/hybrid';
import type {SiteEnergy} from '@/modules/site/data/hybrid';
import {
  deliveredDieselRm,
  estateEconomics,
  payback,
  ringgit,
  siteEconomics,
} from '@/modules/site/data/economics';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {SITE_KIND_LABEL} from '@/modules/site/data/siteSeed';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {SITE_POWER_ROLE_LABEL, hasBattery} from '@/modules/site/types/site.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import {siteSearch} from '@/modules/site/types/view.type';

/**
 * `/energy` — what carried the load, site by site.
 *
 * ## Why this screen exists on this build and not the mobile one
 *
 * On a fleet of hire sets there is one source and the question is whether it is
 * turning. Here three of the four configurations have something else on the bus,
 * and the estate is mid-programme: sites are being converted from diesel prime to
 * hybrid one at a time. That programme has exactly one question — **is it
 * working** — and no screen in the app could answer it, because the answer is a
 * comparison between what a site burns now and what the same site burned before.
 *
 * ## What the numbers are
 *
 * Thirty days, and every figure derived from the site's own load, its region's
 * sun hours and the genset's own fuel curve. `hybrid.ts` holds the chain and the
 * argument for each link; this screen is its table.
 *
 * **The grid-backed sites are not here.** They burn nothing worth counting and
 * generate nothing, and including them would divide a real saving across a pile
 * of towers in towns the programme was never about.
 *
 * ## Why the money is on the same page as the litres
 *
 * Because nobody converts a site to save litres. SolarIQ established the
 * vocabulary this group's customers already read a plant's performance in —
 * savings to date, payback, ROI to date, against a stated rate — and the only
 * substitution here is what is being displaced: a burned litre rather than a
 * bought kilowatt-hour.
 *
 * The rate is stated on the page rather than assumed, for SolarIQ's own reason. A
 * litre does not cost what it costs at the depot; it costs that plus getting it
 * to the site, and at Belaga the second term is most of the first. A case built on
 * the pump price understates a remote site by half, which is exactly the mistake
 * SolarIQ's tariff build-up exists to prevent one rung down.
 *
 * `economics.ts` holds the prices, all of them mock benchmarks in one labelled
 * block, and says so.
 *
 * ## The two bands are deliberately not one
 *
 * **Built** reports the plant that is running. **Still on diesel** prices the
 * plant that is not. A blended payback across the two answers a question nobody
 * asked: the reader is either reporting on what was spent or asking for more, and
 * one number serves neither.
 */

const COLUMNS = [
  {label: 'Site', width: '17%'},
  {label: 'Configuration', width: '12%'},
  {label: 'Plant', width: '13%'},
  {label: 'Solar share', width: '14%'},
  {label: 'Genset hours', width: '10%'},
  {label: 'Diesel', width: '10%'},
  {label: 'Saving / yr', width: '12%'},
  {label: 'Payback', width: '12%'},
] as const;

/**
 * The two ends of the delivered-diesel spread, for the rate line under the
 * investment band.
 *
 * Named sites rather than a min and a max over the estate: the point of the line
 * is that *where* a site is decides what its diesel costs, and a bare range hides
 * the geography that is the whole argument for converting the far ones first.
 */
const CENTRAL_SEED = siteSeed('wpkl-0142');
const SARAWAK_SEED = siteSeed('swk-0851');

/** Is the plant on this row actually built, or is the row a quotation. */
const isBuilt = (role: SitePowerRole): boolean => hasBattery(role);

/** A number the reader is meant to compare, so it never carries a decimal place. */
const litres = (value: number): string => `${Math.round(value).toLocaleString('en-MY')} L`;

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/**
 * One estate figure, in the tile grammar the overview already uses.
 *
 * No status colour on any of them: these are quantities, not verdicts, and a
 * coloured number would rank what is only a tally.
 */
const Tile = ({label, value, detail}: {label: string; value: string; detail: string}) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5">
    <span className="truncate text-xs font-medium text-secondary">{label}</span>
    <span className="text-2xl leading-none font-semibold text-primary tabular-nums">{value}</span>
    <span className="truncate text-xs text-secondary">{detail}</span>
  </div>
);

/**
 * Generation split as one bar: solar, then diesel.
 *
 * A bar rather than two numbers because the question is a proportion, and a
 * proportion read off two figures is arithmetic the reader has to do. The
 * percentage is printed beside it anyway — the bar is how it is compared down the
 * column, the number is how it is quoted.
 *
 * A site with no array gets a full diesel bar rather than an empty track, which
 * is the honest drawing: nothing is missing there, it is all one source.
 */
const MixBar = ({energy}: {energy: SiteEnergy}) => {
  const generation = energy.solarKwh + energy.gensetKwh;
  const solar = generation > 0 ? energy.solarKwh / generation : 0;

  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-inset"
        aria-hidden="true"
      >
        <span className="h-full bg-solar" style={{width: `${solar * 100}%`}} />
        <span className="h-full bg-fuel" style={{width: `${(1 - solar) * 100}%`}} />
      </span>
      <span className="w-9 shrink-0 text-right tabular-nums text-primary">{percent(solar)}</span>
    </span>
  );
};

/** What is fitted, in one line: the array, the bank, or the word for neither. */
const plantLabel = (siteId: string, role: SitePowerRole): string => {
  const seed = siteSeed(siteId);
  if (seed === undefined) return '—';
  const plant = hybridPlant(seed, role);
  if (plant.batteryKwh === 0) return 'Genset only';
  const bank = `${plant.batteryKwh.toLocaleString('en-MY')} kWh`;
  return plant.pvKwp === 0 ? bank : `${plant.pvKwp} kWp · ${bank}`;
};

export const EnergyPage = () => {
  const summaries = useSiteSummaries();
  const roles = useSitePowerRoles();

  /**
   * Nameplate by site, handed to the energy model.
   *
   * The model is about places and the fleet is about machines, so the one fact it
   * needs from the other side is passed in rather than reached for. It is also
   * what makes the loading — and therefore the fuel curve — real: a 20 kVA set
   * against a 4 kW tower is a third-loaded engine, and that is most of why a
   * diesel-prime site costs what it does.
   */
  const ratedKwBySite = useMemo(
    () =>
      Object.fromEntries(summaries.map((summary) => [summary.site.id, summary.ratedKw])) as Record<
        string,
        number
      >,
    [summaries],
  );

  const estate = useMemo(() => estateEnergy(roles, ratedKwBySite), [roles, ratedKwBySite]);
  const money = useMemo(() => estateEconomics(roles, ratedKwBySite), [roles, ratedKwBySite]);

  const rows = useMemo(
    () =>
      summaries
        .map((summary) => {
          const role = roles[summary.site.id] ?? 'GRID_BACKUP';
          const seed = siteSeed(summary.site.id);
          if (seed === undefined || role === 'GRID_BACKUP') return null;
          return {
            summary,
            role,
            seed,
            energy: siteEnergy(seed, role, summary.ratedKw),
            economics: siteEconomics(seed, role, summary.ratedKw),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        // Fastest payback first, and that is a change of question from "biggest
        // saving": a big site saving a lot on plant that cost a lot is a worse
        // investment than a small one that pays back in three years, and the
        // column this page is read down is the one it should be sorted by.
        .sort((left, right) => {
          const a = left.economics.paybackYears ?? Number.POSITIVE_INFINITY;
          const b = right.economics.paybackYears ?? Number.POSITIVE_INFINITY;
          return a - b;
        }),
    [summaries, roles],
  );

  const [now] = useState(() => Date.now());
  const windowLabel = new Date(now - 30 * 24 * 3_600_000).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-3 pb-24 md:pb-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-none font-semibold text-primary tabular-nums">
            {estate.hybridSites}
          </span>
          <span className="text-sm text-secondary">
            {estate.hybridSites === 1 ? 'hybrid site' : 'hybrid sites'}
          </span>
        </p>
        <p className="text-sm text-secondary">
          {estate.solarSites} with an array, {estate.hybridSites - estate.solarSites} on storage
          alone
        </p>
        <p className="text-sm text-secondary">
          {estate.dieselSites} still on diesel prime
        </p>
      </header>

      <section aria-label="Thirty days" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Thirty days</h2>
          <p className="text-xs text-tertiary">
            Since {windowLabel}, across every site with no grid connection
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Solar share"
            value={percent(estate.solarShare)}
            detail={`${Math.round(estate.solarKwh).toLocaleString('en-MY')} kWh generated`}
          />
          <Tile
            label="Diesel burned"
            value={litres(estate.litres)}
            detail={`${Math.round(estate.gensetKwh).toLocaleString('en-MY')} kWh from the gensets`}
          />
          <Tile
            label="Diesel displaced"
            value={litres(estate.displacedLitres)}
            detail={`against ${litres(estate.baselineLitres)} on diesel prime`}
          />
          <Tile
            label="Saving"
            value={percent(
              estate.baselineLitres > 0 ? estate.displacedLitres / estate.baselineLitres : 0,
            )}
            detail="of what the same sites would have burned"
          />
        </div>
      </section>

      <section aria-label="Investment" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Investment</h2>
          <p className="text-xs text-tertiary">
            Struck at the delivered diesel price:{' '}
            {CENTRAL_SEED === undefined
              ? ''
              : `RM ${deliveredDieselRm(CENTRAL_SEED).toFixed(2)} a litre in the Klang Valley`}{' '}
            {SARAWAK_SEED === undefined
              ? ''
              : `and RM ${deliveredDieselRm(SARAWAK_SEED).toFixed(2)} in the Sarawak interior`}.
            Servicing counts too: an engine that runs a third as many hours needs a third as many
            visits
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Saving a year"
            value={ringgit(money.annualSavingRm)}
            detail={`on ${ringgit(money.capexDeployedRm)} of plant built`}
          />
          <Tile
            label="Payback"
            value={payback(money.paybackYears)}
            detail="across every converted site"
          />
          <Tile
            label="ROI to date"
            value={`${Math.round(money.roiToDate * 100)}%`}
            detail={`${ringgit(money.savingToDateRm)} banked since commissioning`}
          />
          <Tile
            label="Still on diesel"
            value={ringgit(money.pipelineSavingRm)}
            detail={`a year, for ${ringgit(money.pipelineCapexRm)} across ${
              money.pipelineSites
            } ${money.pipelineSites === 1 ? 'site' : 'sites'}`}
          />
        </div>
      </section>

      <section aria-label="By site" className="flex min-h-0 min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">By site</h2>
          <p className="text-xs text-tertiary">
            Fastest payback first. A site still on diesel is priced as though the array and
            bank it would get were already there, so its row is the quotation
          </p>
        </header>

        <div className="min-h-0 overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Every off-grid site, its plant, what carried it over thirty days and the diesel
              the plant displaced
            </caption>
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.label} style={{width: column.width}} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({summary, role, energy, economics}) => {
                const proposed = !isBuilt(role);

                return (
                  <tr key={summary.site.id}>
                    <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                      <Link
                        to="/sites"
                        search={siteSearch({id: summary.site.id, panel: true})}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {summary.site.name}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {summary.site.locationLabel}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      <span className="block truncate">{SITE_POWER_ROLE_LABEL[role]}</span>
                      <span className="block truncate text-xs text-tertiary">
                        {SITE_KIND_LABEL[summary.site.kind]}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      <span className="block truncate">{plantLabel(summary.site.id, role)}</span>
                      <span className="block truncate text-xs text-tertiary">
                        {summary.site.loadKw} kW load
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2">
                      <MixBar energy={energy} />
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                      {energy.gensetHours.toLocaleString('en-MY')} h
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                      {litres(energy.litres)}
                    </td>

                    {/* A site still on diesel is quoted rather than reported, and
                        the two are set apart by weight rather than by a badge: the
                        figures are the same figures and one of them has not happened
                        yet. The `Proposed` line under the payback is what says which. */}
                    <td
                      className={cn(
                        'h-13 truncate border-b border-subtle p-2 tabular-nums',
                        proposed ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {ringgit(economics.annualSavingRm)}
                      <span className="block truncate text-xs text-tertiary tabular-nums">
                        {economics.litresPerYear.toLocaleString('en-MY')} L
                      </span>
                    </td>

                    <td
                      className={cn(
                        'h-13 truncate border-b border-subtle p-2 tabular-nums',
                        proposed ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {payback(economics.paybackYears)}
                      <span className="block truncate text-xs text-tertiary">
                        {proposed
                          ? `Proposed · ${ringgit(economics.capexRm)}`
                          : `${Math.round(economics.roiToDate * 100)}% ROI to date`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
