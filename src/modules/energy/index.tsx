import {Link} from '@tanstack/react-router';
import {InfoIcon, SearchIcon, SearchXIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import type {ReactNode} from 'react';

import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';

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
 *
 * ## Nothing on this page grows with the estate
 *
 * This demo has four arrays and the carrier has thousands of sites, so every band
 * here is built to draw the same at either end. That ruled out the obvious first
 * version, which was **one chart per array in a grid**: at four it is a page, at
 * forty it is a wall of thumbnails nobody compares, and at four hundred it does
 * not render. The page is fixed-size by construction instead:
 *
 *  - the **tiles** are nine, always;
 *  - the **table** is the only unbounded thing, and it is a table — sorted,
 *    searchable, and scrolled. That is what a list of four hundred sites should
 *    be.
 *
 * Generation used to be drawn here too, one chart per array in a grid, and it is
 * the reason `/solar` exists. At four arrays that grid was a page; at forty it
 * was a wall of thumbnails nobody compares. It also put two headline figures on
 * one screen — the saving and the yield — that move for unrelated reasons, which
 * is the reliable way to make a reader distrust both. The **Solar yield** tile
 * below is what remains of it, and it links to the screen that shows its working.
 */

const COLUMNS: Array<{label: string; width: string; note?: ReactNode}> = [
  {label: 'Site', width: '17%'},
  {label: 'Configuration', width: '12%'},
  {
    label: 'Plant',
    width: '13%',
    note: 'Array size and usable storage. The array is sized to cover about two thirds to three quarters of the annual energy, which is why the genset stays; the bank is sized in hours of autonomy at the tower load, 10 to 14 on a diesel hybrid and 16 to 20 on a solar one.',
  },
  {
    label: 'Solar share',
    width: '14%',
    note: 'Solar as a share of generation, not of the load. A battery is a delay rather than a source, so it appears in neither half: yellow is what the array made, violet is what the genset made. The line underneath is that generation against the design yield the array was bought on.',
  },
  {
    label: 'Genset hours',
    width: '10%',
    note: 'Engine hours over the same thirty days, from the energy the genset had to raise and the loading it holds while raising it. A diesel-prime site reads 720 because the engine never stops.',
  },
  {
    label: 'Diesel',
    width: '10%',
    note: 'Litres burned over thirty days, costed on the same fuel curve the run log and the tank chart use. A lightly loaded engine pays more per kilowatt-hour, which is most of what a hybrid fixes.',
  },
  {
    label: 'Saving / yr',
    width: '12%',
    note: 'Diesel at the delivered price for this region, plus the service visits an engine running a third as many hours no longer needs. Against running the same site on diesel alone.',
  },
  {
    label: 'Payback',
    width: '12%',
    note: 'Plant cost divided by the annual saving. A site still on diesel shows what converting it would cost and how long it would take to pay back. A converted one shows what it has returned since commissioning, or, where its array is short of its design yield, the payback it would have hit at P50.',
  },
];

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
 *
 * ## Every figure explains itself
 *
 * `note` is not optional and there is no tile without one. This page is the only
 * screen in the app whose numbers are **modelled** rather than read off an
 * instrument, and a modelled number a reader cannot interrogate is one they will
 * either believe too readily or dismiss. The glyph carries what it was derived
 * from, in the one place somebody wondering will look.
 */
const Tile = ({
  label,
  value,
  detail,
  note,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  /** How this figure was arrived at, for the info glyph beside its label. */
  note: ReactNode;
  /** Where the figure's working lives, when it is not on this page. */
  to?: '/solar';
}) => (
  <TileShell to={to}>
    <span className="flex items-center gap-1.5">
      <span className="truncate text-xs font-medium text-secondary">{label}</span>
      <Tooltip>
        <TooltipTrigger className="shrink-0 cursor-help text-tertiary hover:text-primary">
          <InfoIcon className="size-3" aria-hidden="true" />
          <span className="sr-only">How {label} is worked out</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          {note}
        </TooltipContent>
      </Tooltip>
    </span>
    <span className="text-2xl leading-none font-semibold text-primary tabular-nums">{value}</span>
    <span className="truncate text-xs text-secondary">{detail}</span>
  </TileShell>
);

/**
 * The tile's box, as a link where the figure has a screen behind it and a plain
 * div where it does not.
 *
 * Split out rather than branched inline because the two have to be visually
 * identical: a tile that grew a border or a shade because it happened to be
 * clickable would say the figure was more important than its neighbours, which is
 * not what a link means.
 */
const TileShell = ({to, children}: {to?: '/solar'; children: ReactNode}) =>
  to === undefined ? (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5">
      {children}
    </div>
  ) : (
    <Link
      to={to}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5 transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline"
    >
      {children}
    </Link>
  );

/** A column heading with the same glyph, for the columns that are derived too. */
const ColumnHead = ({label, note}: {label: string; note?: ReactNode}) => (
  <span className="flex items-center gap-1.5">
    {label}
    {note !== undefined && (
      <Tooltip>
        <TooltipTrigger className="shrink-0 cursor-help text-tertiary hover:text-primary">
          <InfoIcon className="size-3" aria-hidden="true" />
          <span className="sr-only">How {label} is worked out</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          {note}
        </TooltipContent>
      </Tooltip>
    )}
  </span>
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
  const [q, setQ] = useState('');

  /** `26 Jul`, the day the thirty-day window opened. */
  const windowLabel = new Date(now - 30 * 24 * 3_600_000).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  });

  /**
   * The table's rows after the search box.
   *
   * Matches what the row actually shows — the site's name, its placename, its
   * configuration and its kind — which is the rule `searchSites` already follows
   * one module over, for the reason it gives there: a reader searching a table
   * expects to find the words they can see in it.
   */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle === '') return rows;
    return rows.filter(({summary, role}) =>
      [
        summary.site.name,
        summary.site.locationLabel,
        SITE_POWER_ROLE_LABEL[role],
        SITE_KIND_LABEL[summary.site.kind],
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {/* The one figure from `/solar` that belongs on a page about diesel:
              an array short of its number is a genset covering for it. The tile
              links across rather than restating the argument. */}
          <Tile
            to="/solar"
            label="Solar yield"
            value={percent(estate.solarYield)}
            detail={`of ${Math.round(estate.expectedSolarKwh).toLocaleString(
              'en-MY',
            )} kWh at P50`}
            note="What the arrays actually made against the design yield they were bought on, over the same thirty days. The P90 band sits at 90% of it. Solar has its own screen, where the twelve-month series says which arrays are short and since when."
          />
          <Tile
            label="Solar share"
            value={percent(estate.solarShare)}
            detail={`${Math.round(estate.solarKwh).toLocaleString('en-MY')} kWh generated`}
            note="Solar as a share of everything generated off-grid, including at the sites with no array. It is low because only four of the thirteen have one, and it is the figure that rises with every conversion."
          />
          <Tile
            label="Diesel burned"
            value={litres(estate.litres)}
            detail={`${Math.round(estate.gensetKwh).toLocaleString('en-MY')} kWh from the gensets`}
            note="What the gensets at every off-grid site actually burned over thirty days, costed on the loading each one holds while it runs."
          />
          <Tile
            label="Diesel displaced"
            value={litres(estate.displacedLitres)}
            detail={`against ${litres(estate.baselineLitres)} on diesel prime`}
            note="The difference between what these sites burned and what the same sites would have burned running on diesel alone. Two things make it up: less energy from the engine, and the engine running nearer its efficient point when it does."
          />
          <Tile
            label="Saving"
            value={percent(
              estate.baselineLitres > 0 ? estate.displacedLitres / estate.baselineLitres : 0,
            )}
            detail="of what the same sites would have burned"
            note="Displaced litres as a share of the diesel-only figure. It blends converted and unconverted sites, so it is the estate's position rather than any one plant's performance."
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
            note="Displaced diesel at the delivered price for each region, plus the service visits avoided. Built plant only: the sites still on diesel are counted in the fourth tile."
          />
          <Tile
            label="Payback"
            value={payback(money.paybackYears)}
            detail="across every converted site"
            note="Plant cost divided by the annual saving, across the converted sites together. Individual sites range either side of it, and the table below is sorted on that column."
          />
          <Tile
            label="ROI to date"
            value={`${Math.round(money.roiToDate * 100)}%`}
            detail={`${ringgit(money.savingToDateRm)} banked since commissioning`}
            note="Saving banked since each site was commissioned, as a share of what its plant cost. It passes 100% at the payback point, and the sites were converted at different times."
          />
          <Tile
            label="Still on diesel"
            value={ringgit(money.pipelineSavingRm)}
            detail={`a year, for ${ringgit(money.pipelineCapexRm)} across ${
              money.pipelineSites
            } ${money.pipelineSites === 1 ? 'site' : 'sites'}`}
            note="What converting the remaining diesel sites would save each year, and what the plant would cost. They are the remotest sites on the estate, which is why they pay back faster than the ones already built."
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

        {/* The one band on this page that grows with the estate, so it gets the
            control the other list screens have: the same search box, matching the
            same fields, with the count of what it left standing. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InputGroup className="w-full max-w-[373px]">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Site, place or configuration"
              aria-label="Search sites"
            />
          </InputGroup>

          <p className="text-sm text-secondary tabular-nums">
            {filtered.length} of {rows.length} {rows.length === 1 ? 'site' : 'sites'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">No sites match “{q}”.</p>
          </div>
        ) : (
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
                    <ColumnHead label={column.label} note={column.note} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({summary, role, energy, economics}) => {
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
                      {/* The benchmark under the share, because the two answer
                          different questions about the same array: the bar says how
                          much of the site it carried, this says whether it is doing
                          what it was bought to do. A site with no array gets neither
                          line, which is the honest blank. */}
                      {energy.expectedSolarKwh > 0 && (
                        <span
                          className={cn(
                            'block truncate pt-1 text-xs tabular-nums',
                            energy.solarKwh < energy.p90SolarKwh
                              ? 'text-severity-warning'
                              : 'text-tertiary',
                          )}
                        >
                          {percent(energy.solarKwh / energy.expectedSolarKwh)} of P50
                          {energy.solarKwh < energy.p90SolarKwh && ' · below P90'}
                        </span>
                      )}
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
                          : // At an array that is short of its design yield the two
                            // paybacks differ, and the target is the useful second
                            // figure: it says how much of the slip is the plant. A
                            // site on or above its number has one payback and says
                            // so, because printing "3.1 target" beside "3.1" would
                            // be a comparison with nothing in it.
                            economics.paybackYearsAtP50 !== null &&
                              economics.paybackYears !== null &&
                              economics.paybackYears - economics.paybackYearsAtP50 > 0.1
                            ? `${payback(economics.paybackYearsAtP50)} at P50`
                            : `${Math.round(economics.roiToDate * 100)}% ROI to date`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </div>
  );
};
