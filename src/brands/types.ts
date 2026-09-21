/**
 * What a brand is, and what a brand is allowed to change.
 *
 * This file exists because the prototype spent three branches learning the wrong
 * lesson. `feat/fleet-cards-split-map`, `feat/sesb-demo` and
 * `feat/celcomdigi-demo` are one straight line of history, and two of those three
 * forks happened for no reason other than **a different customer's colours and a
 * different customer's estate**. Every feature built after a fork was then only
 * available on that fork, and the branch name stopped describing its contents:
 * `celcomdigi-demo` was really "everything anyone built since 17 August".
 *
 * A branch is for work in progress. A brand is not work in progress — it is a
 * thing that permanently exists, alongside the others, and every one of them has
 * to keep working after the next feature lands. That makes it configuration.
 *
 * ## The line this file draws
 *
 * A brand owns **whose app this is**: the name on the door, the mark on the rail,
 * the four colours that are the customer's rather than the product's, and the
 * estate the demo walks through.
 *
 * A brand does **not** own the product model. `SitePowerRole` is the clearest
 * case: it is two entries, `GRID_BACKUP` and `DIESEL_PRIME`, and every dataset is
 * expressed in them. A brand reviving its own vocabulary would fork the model in
 * config instead of in git. The vocabulary is the product's; which sites use which
 * entry is the dataset's.
 *
 * The same rule settles anything else that comes up: if two brands disagreeing
 * about it would mean two versions of a *feature*, it does not belong here.
 *
 * ## Identity and dataset are separate axes
 *
 * A brand names a dataset rather than containing one. Datasets are the expensive
 * half — twenty-five sites and thirty-odd machines each — and the pairing is not
 * one-to-one: the unbranded `gensetiq` build shows the carrier estate under
 * product colours, because what it is for is showing the product without a
 * customer's name on it, not inventing a third estate. Keeping the axes apart also
 * means the next customer in a sector we already have data for is an identity file
 * and nothing else.
 *
 * Splitting the registry in two (`identity.ts`, `dataset.ts`) is deliberate for a
 * second reason: `styles/colors.ts` runs before first paint and needs the theme.
 * It should not drag forty-five kilobytes of site seed along with it.
 *
 * ## One brand per file, and the registry is generated
 *
 * Each brand is its own module under `catalog/`, each estate its own under
 * `datasets/`, and the thing that collects them is a **virtual module built per
 * build** by the `brands` plugin in `vite.config.ts`.
 *
 * That is not tidiness. A hand-written `Record` of every brand ships every one
 * of them: a customer's deployment would carry the other customers' names, marks and
 * twenty-five site names each, hidden behind a UI flag and one devtools tab away
 * from being read. Hiding the picker is a product decision; leaving the data out
 * of the bundle is the one that makes it true.
 *
 * So a build includes every brand only when it is allowed to show them — in dev,
 * and on the unbranded `gensetiq` build, which has no customer to leak. Otherwise
 * it includes exactly one. `INCLUDED_BRAND_IDS` is what the app reads, and the
 * Settings picker appears precisely when that list has more than one entry, so the
 * gate and the bundle cannot drift apart.
 */

/** The brands this build can be compiled as. Add a customer by adding an entry. */
export const BRAND_IDS = ['redtone', 'celcomdigi', 'sesb', 'gensetiq', 'telcoiq'] as const;

export type BrandId = (typeof BRAND_IDS)[number];

export const DATASET_IDS = ['carrier', 'utility'] as const;

export type DatasetId = (typeof DATASET_IDS)[number];

/**
 * The four colours that are the customer's and not the product's.
 *
 * Deliberately four, and not "the palette". Every other token in `colors.ts` is
 * the design system's and is shared by every brand — a customer who wanted their
 * own `bg-canvas` would be asking for a different product, and a customer whose
 * yellow fails contrast as a data mark does not get to make bars invisible (see
 * the `SOLAR` group's comment for the case where exactly that was refused).
 *
 * These four are the ones that carry an identity rather than a meaning:
 *
 * - `brand` — the login CTA and the primary button. A control colour.
 * - `brandForeground` — what stays legible *on* `brand`. It moves with it or the
 *   button loses its label, which is why it is here and not derived.
 * - `sidebar` — the rail, in both modes. The one surface that does not follow the
 *   app's light/dark polarity, because it carries the customer's mark.
 * - `battery` — the storage series in charts, as a base and a lighter tip.
 *   Optional: a brand that does not supply one gets the product's own.
 */
export type BrandTheme = {
  brand: string;
  brandForeground: string;
  sidebar: string;
  battery?: {base: string; tip: string};
};

/**
 * Whose app this is: the name, the marks, and the four colours.
 *
 * **No tab strings here.** The title, description and favicon live in `tab.ts`,
 * which is read by the Vite plugin in Node and inlined into the generated registry
 * as literals for only the brands a build includes. Putting them on this type
 * would mean the client importing a map of every brand's title — three short
 * strings, but every customer's name — which is the leak this whole structure
 * exists to close.
 */
export type BrandIdentity = {
  id: BrandId;
  /** The customer's name, as they write it. Used in `alt` text and copy. */
  name: string;
  /** One line for the Settings picker: what this brand is, in a phrase. */
  blurb: string;
  /** The wide lockup, for the login door. Imported asset URL. */
  logo: string;
  /** The square mark, for the rail. Imported asset URL. */
  mark: string;
  /** Pixel dimensions of `logo`, so the login screen reserves the right box. */
  logoSize: {width: number; height: number};
  /** Pixel dimensions of `mark`. */
  markSize: {width: number; height: number};
  theme: BrandTheme;
  /** Which estate this brand's demo walks through. */
  dataset: DatasetId;
};

/**
 * A region, zone, or account — whatever this dataset's estate is divided into.
 *
 * Was a per-brand string union (`'northern' | 'central' | …` on the carrier,
 * `'west-coast' | 'kudat' | …` on the utility), which is exactly the kind of type
 * that cannot survive a swappable dataset: the union was the reason the two
 * estates could not coexist in one build. It is a plain `string` now, checked at
 * load by `assertDatasetIntegrity` instead of by the compiler.
 *
 * That is a real loss and worth naming. A typo in a seed row's `customer` was a
 * red squiggle and is now a thrown error on boot. The trade is deliberate — the
 * error fires on every dev server start and names the row — but if this app ever
 * gains a *fixed* roster again, this is the line to narrow.
 */
export type CustomerId = string;

/** What kind of asset a site is — `MACRO` on a carrier, `PPU` on a utility. */
export type SiteKindId = string;

export type BrandCustomer = {
  id: CustomerId;
  /** Written in full, for a tooltip or a detail line. */
  name: string;
  /** The short form the chips and cards use. */
  shortName: string;
};

/**
 * A **programme** a site was built or converted under — a grouping the operator
 * draws, not a fact about the plant.
 *
 * Region and programme answer different questions and neither substitutes for the
 * other. A region is *where the site is*, and it is fixed by geography: Kapit is in
 * Sarawak whatever anybody decides. A programme is *what budget and rollout the
 * site belongs to*, and it is a line an operations team draws across the estate for
 * their own reasons — a funding round, a build wave, a conversion campaign. Two
 * sites in the same district can sit in different programmes, and one programme can
 * span districts.
 *
 * So it is a **grouping and nothing else**. Nothing derives from it: no figure, no
 * diagram, no default. It exists so a reader can say "show me the SWK build" and
 * get exactly the sites somebody assigned to it — which is why a site is allowed to
 * be in **no** programme at all. An estate that pre-dates its first programme, or a
 * site nobody has filed yet, is unassigned rather than forced into the nearest
 * plausible bucket.
 *
 * The roster is the dataset's, for the same reason the customer roster is: a
 * carrier's rollout waves and a utility's capital programmes are not the same
 * vocabulary, and there is no union that covers both without meaning nothing.
 */
export type ProgramId = string;

export type BrandProgram = {
  id: ProgramId;
  /** Written in full, for a detail line or a tooltip — `Jendela Sabah`. */
  name: string;
  /** The short form the chips and the settings picker use — `Jendela SBH`. */
  shortName: string;
  /** One line: what this programme is, for the settings picker. */
  blurb: string;
};

/**
 * An estate: the places, the machines standing on them, and what they are called.
 *
 * The seed rows are typed here rather than in the site and genset modules so a
 * dataset file can be read on its own. The shapes are unchanged from where they
 * used to live — this is a move, not a redesign.
 */
export type BrandSiteSeed = {
  id: string;
  /** e.g. `WPKL-0207` — the label the design puts in the header. */
  name: string;
  kind: SiteKindId;
  /** The yard's placename. Gensets deployed here take it as their own. */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /** What the injection point carries. A fact about the network, not the plant. */
  loadKw: number;
  customer: CustomerId;
  /**
   * The seeded power configuration. One of `SITE_POWER_ROLES` — the product's
   * vocabulary, not the brand's. `siteConfig.ts` lets a reader override it live.
   */
  powerRole: string;
  /**
   * The programme this site was filed under, or `undefined` for none.
   *
   * Optional rather than defaulted, because "not in a programme" is a real state
   * and the honest one for a site that pre-dates the estate's first rollout wave.
   * A reader can file it — or unfile it — from the site's settings.
   */
  program?: ProgramId;
};

export type BrandFleetSeed = {
  tag: string;
  model: string;
  runState: string;
  /**
   * Why this unit last cranked — `'OUTAGE'` when omitted, the ordinary reason on a
   * grid-backed site. Set `'TEST'` to seed the case that distinction exists for: a
   * set turning beside a healthy incomer. Both estates pin two units to it.
   */
  startReason?: string;
  /**
   * Road registration, for a set that arrived on a lorry and can leave on one —
   * `undefined` for a machine bolted to a plinth, which is most of them.
   *
   * Optional because absence is the ordinary case and it is not a gap: a
   * plinth-mounted set has no plate to record, and a blank row claiming otherwise
   * would be the asset register inventing a fact about the machine.
   */
  plateNumber?: string;
  /** Must match a `BrandSiteSeed.id` in the same dataset, or `undefined` for the workshop. */
  siteId: string | undefined;
  locationLabel: string;
  latitude: number;
  longitude: number;
  fuelLitres: number;
  fuelCapacityLitres: number;
  staleMinutes: number;
};

export type BrandDataset = {
  id: DatasetId;
  /** For error messages and the integrity check. */
  label: string;
  /**
   * How this estate's divisions are named in a card heading — "By region" on a
   * carrier's network, "By zone" on a utility's distribution area. Three summary
   * cards show it and they should not all have to know which brand is loaded.
   */
  groupingLabel: string;
  customers: ReadonlyArray<BrandCustomer>;
  /**
   * The rollout programmes sites can be filed under. May be empty: an estate with
   * no programmes is a legitimate estate, and every site is then unassigned.
   */
  programs: ReadonlyArray<BrandProgram>;
  /** The kind vocabulary, and how each entry is written in a chip. */
  siteKindLabels: Readonly<Record<SiteKindId, string>>;
  sites: ReadonlyArray<BrandSiteSeed>;
  gensets: ReadonlyArray<BrandFleetSeed>;
  /**
   * The site the app opens on.
   *
   * Pick the configuration the demo is *about*, not the first row: landing on a
   * grid-backed rooftop opens the app on the one page that shows none of what is
   * new.
   */
  defaultSiteId: string;
  /** The genset the app opens on, lowercased tag. */
  defaultGensetId: string;
};

/**
 * The browser tab, per brand.
 *
 * Defined here so both sides can name the shape: `tab.ts` states the values in a
 * module only Node reads, and the generated registry re-emits the included ones as
 * literals for the client.
 */
export type BrandTab = {
  title: string;
  description: string;
  /** Filename under `public/`, no leading slash. */
  faviconPath: string;
};
