/**
 * Color tokens — the single source of truth for theme colors.
 *
 * Lifted from `rooftopiq-frontend-v3/src/styles/colors.ts` so the two apps stay
 * token-compatible: every token below that also exists there is byte-identical,
 * including its `figma` field. Read that file's header for the full explanation
 * of the `figma` field and the design-token bridge — the short version:
 *
 *   Every token names the Figma variable it *is*, in the "3. Mode" collection of
 *   the **Rooftop Energy UI kit** (file `rUFkr9RqPksfojpUY1wK98`, swatch
 *   documentation page node `24173-23459`). Figma prefixes by property
 *   (`bg-` / `text-` / `bd-` / `tr-`); this file names the role and lets
 *   Tailwind supply the prefix. So Figma `text-strong` is token `primary` is
 *   utility `text-primary`. Never infer the counterpart from the name — read it
 *   off the `figma` field.
 *
 * The full table both ways, the overlay/surface rule, the alpha conversion, and
 * a drift check that diffs this file against the live Figma variables live in the
 * **`figma-tokens`** org skill —
 * `personal-tristan/shared-knowledge/org-skills/.claude/skills/figma-tokens/`.
 * Read it before moving a colour in either direction.
 *
 * What GensetIQ changes:
 *   - `brand` is teal `#21B0B0` (the IQ mark's accent + the login CTA) rather
 *     than Rooftop Energy's gold `#D1AA51`. This is a deliberate product-level
 *     override of `bg-brand`, recorded in the token's `divergent` field so the
 *     drift check reports it as intended rather than as a defect.
 *   - a `SOLAR` and a `BATTERY` group are added for the hybrid plant this
 *     white-label's estate carries. Diesel already had its own hue; solar and
 *     storage need theirs for the same reason. See each group's own comment.
 *   - a `STATUS` group is added for genset run states — this product needs
 *     state colour in a way the CRM never did. None of it is in the design
 *     system's semantic collection; see the group's own comment.
 *
 * Values live here in TS; `styles/styles.css` only *maps* them to Tailwind
 * utilities via its `@theme inline` block. The actual `:root` / `.dark` custom
 * properties are produced by `colorThemeCss()` and injected as a <style> in
 * `main.tsx`, so there is no flash of unthemed content.
 *
 * Guide rule carried over from the design file: a `tr-*` token is a
 * *translucent overlay*, not a surface. Paint the base colour first, then layer
 * the overlay on top — never substitute one for the other.
 */

import {BRAND} from '@/brands/identity';

export type ColorMode = 'light' | 'dark';

export type ColorToken = {
  light: string;
  dark: string;
  /**
   * Name of the Figma variable in the UI kit's "3. Mode" collection that this
   * token corresponds to, or `''` when the token is code-only.
   */
  figma: string;
  /**
   * Set when a Figma counterpart exists but this app intentionally ships a
   * different value. The string is the reason, and it tells the drift check to
   * skip this token rather than report it.
   */
  divergent?: string;
};

export type ColorMap = Record<string, ColorToken>;

/** Background surfaces — `bg-canvas`, `bg-element`, `bg-overlay`, … */
const BACKGROUND: ColorMap = {
  // App / page background. Base layer everything sits on.
  canvas: {light: '#EEEFF2', dark: '#070E1D', figma: 'bg-canvas'},
  // The white/black fill (switch, slider, input selection). No Figma
  // counterpart — the design system never replaced it.
  fill: {light: '#000000', dark: '#FFFFFF', figma: ''},
  // Cards, panels, table surfaces, text fields — raised elements.
  element: {light: '#F6F7F8', dark: '#151C28', figma: 'bg-element'},
  // Modals, popovers, the genset detail panel — anything floating above the page.
  overlay: {light: '#F9FAFB', dark: '#121826', figma: 'bg-overlay'},
  // Secondary elevated tier nested inside `element` (e.g. run-state badges).
  inset: {light: '#EAEBED', dark: '#202632', figma: 'bg-inset'},
  // Hover state on table rows, cards, list items. Overlay — layer, don't replace.
  hover: {
    light: 'rgba(0, 0, 0, 0.04)',
    dark: 'rgba(255, 255, 255, 0.03)',
    figma: 'tr-hover',
  },
  // Focus / active state. Overlay — layer, don't replace.
  highlight: {
    light: 'rgba(0, 0, 0, 0.07)',
    dark: 'rgba(255, 255, 255, 0.08)',
    figma: 'tr-highlight',
  },
  // GensetIQ teal — primary accents, brand moments. The IQ mark's accent stroke
  // and the login CTA both use this exact value.
  brand: {
    // The active brand's own control colour — see `brands/identity.ts`, where each
    // customer's value is recorded with the variable name their own stylesheet
    // uses. The product's teal stays in dark mode, which these light-only
    // white-label builds never show.
    light: BRAND.theme.brand,
    dark: '#21B0B0',
    figma: 'bg-brand',
    divergent:
      "GensetIQ's brand is teal, not Rooftop Energy's gold #D1AA51. Product-level override — do not sync this value from Figma's bg-brand.",
  },
  // The slightly greener teal Figma uses for the sidebar avatar
  // (`tailwind colors/teal/500` — a primitive, not a semantic variable, so it
  // has no counterpart in the "3. Mode" collection). Kept distinct from `brand`
  // because the design genuinely uses both.
  teal: {light: '#14B8A6', dark: '#14B8A6', figma: ''},
  // Faint tint for map areas / empty regions / section backgrounds.
  //
  // Figma documents this as black 30% in BOTH modes, and the dark swatch renders
  // exactly that. It is a much heavier tint than the white 5% this token carried
  // before. Corrected 2026-08-12 — Figma is authoritative on values.
  indent: {
    light: 'rgba(0, 0, 0, 0.30)',
    dark: 'rgba(0, 0, 0, 0.30)',
    figma: 'tr-indent',
  },
  // Navy/off-white primary button fill.
  'primary-button': {light: '#151C28', dark: '#F6F7F8', figma: 'bg-primary-button'},
  // Translucent overlay layered on the *primary* button on hover. The polarity
  // is inverted relative to `hover` on purpose: the primary button is light in
  // dark mode, so it darkens; dark in light mode, so it lightens.
  'button-hover': {
    light: 'rgba(255, 255, 255, 0.03)',
    dark: 'rgba(0, 0, 0, 0.04)',
    figma: 'tr-primary-button-hover',
  },
  // Translucent overlay layered on the *brand* button on hover. White in both
  // modes, because `brand` itself does not change between modes — so this is
  // NOT the same value as `button-hover`, which is why the design system
  // carries two variables.
  'brand-button-hover': {
    light: 'rgba(255, 255, 255, 0.03)',
    dark: 'rgba(255, 255, 255, 0.03)',
    figma: 'tr-brand-button-hover',
  },
  // Destructive button background on hover — a full colour swap, not an overlay.
  'destructive-hover': {
    light: '#E34F4F',
    dark: '#E06769',
    figma: 'bg-destructive-hover',
  },
};

/** Text scale — `text-primary`, `text-secondary`, `text-tertiary`. */
const TEXT: ColorMap = {
  // Headings, primary content, high-emphasis labels.
  primary: {light: '#050915', dark: '#F0F2F5', figma: 'text-strong'},
  // Supporting text, secondary labels, table headers, metadata.
  secondary: {
    light: 'rgba(5, 9, 21, 0.60)',
    dark: 'rgba(240, 242, 245, 0.60)',
    figma: 'text-default',
  },
  // Placeholders, disabled, lowest-emphasis hints.
  tertiary: {
    light: 'rgba(5, 9, 21, 0.40)',
    dark: 'rgba(240, 242, 245, 0.40)',
    figma: 'text-subtle',
  },
  // Text on the navy/off-white primary button.
  'primary-button-text': {
    light: '#F6F7F8',
    dark: '#151C28',
    figma: 'text-primary-button',
  },
  // Muted labels / section headings. Opaque gray, deliberately NOT translucent,
  // which is what distinguishes it from `secondary`/`tertiary`. A shadcn
  // holdover with no Figma counterpart — design expresses this tier with the
  // translucent `text-default` / `text-subtle` instead. Prefer those in new work.
  'muted-foreground': {light: '#6B7280', dark: '#9CA3AF', figma: ''},
};

/** Borders — `border-subtle`, `border-default`, `border-strong`. */
const BORDER: ColorMap = {
  // Lightest divider — internal separators, subtle splits.
  subtle: {
    light: 'rgba(0, 0, 0, 0.10)',
    dark: 'rgba(255, 255, 255, 0.10)',
    figma: 'bd-subtle',
  },
  // Standard border for inputs, cards, containers.
  default: {
    light: 'rgba(0, 0, 0, 0.15)',
    dark: 'rgba(255, 255, 255, 0.15)',
    figma: 'bd-default',
  },
  // Emphasis border — active outlines, strong separation.
  strong: {
    light: 'rgba(0, 0, 0, 0.20)',
    dark: 'rgba(255, 255, 255, 0.20)',
    figma: 'bd-strong',
  },
};

/**
 * Sidebar surfaces and text — `bg-sidebar`, `text-sidebar-primary`, …
 *
 * The rail is the one surface in these builds that does not follow the app's
 * light/dark polarity: it is painted in the active brand's own colour in both
 * modes, so everything layered on it is light-on-dark either way. That is why the
 * four foreground tokens below carry the same value in both columns while the rest
 * of the palette still flips.
 *
 * Every brand's rail colour is therefore required to be dark enough to carry white
 * foregrounds. That is a real constraint on adding a customer, and the reason the
 * unbranded build uses the design system's own near-black rather than the teal.
 */
const SIDEBAR: ColorMap = {
  // The active brand's rail colour, from `brands/identity.ts`. A dark surface in
  // the light mode this app actually ships, hence the mode-invariant foregrounds.
  //
  // On CelcomDigi that is navy rather than the bright blue beside it,
  // deliberately: the rail carries the brand mark, whose own gradient runs
  // #009BDF → #0064DC, and a rail painted the mark's own blue would swallow it.
  // Navy is the ground that
  // gradient was drawn to sit on.
  sidebar: {
    light: BRAND.theme.sidebar,
    dark: BRAND.theme.sidebar,
    figma: 'bg-sidebar',
    divergent:
      "The rail is the active brand's own colour in both modes, not the design system's #E2E4E9 / #040710. Customer-level override, set per brand in brands/identity.ts — do not sync this value from Figma's bg-sidebar.",
  },
  // Active / hovered nav item. Overlay — layer over the sidebar background.
  'sidebar-highlight': {
    light: 'rgba(255, 255, 255, 0.10)',
    dark: 'rgba(255, 255, 255, 0.10)',
    figma: 'tr-sidebar-highlight',
    divergent: 'Light-on-dark in both modes — the rail is blue in both. See the group comment.',
  },
  // Outline on the active nav item. Code-only: the design system has no sidebar
  // border, and the global `strong` border is black-alpha in light mode, which
  // disappears against the blue.
  'sidebar-border': {
    light: 'rgba(255, 255, 255, 0.25)',
    dark: 'rgba(255, 255, 255, 0.25)',
    figma: '',
  },
  // Active / primary nav label.
  'sidebar-primary': {
    light: '#F0F2F5',
    dark: '#F0F2F5',
    figma: 'text-sidebar-strong',
    divergent: 'Light-on-dark in both modes — the rail is blue in both. See the group comment.',
  },
  // Inactive / secondary nav label.
  'sidebar-secondary': {
    light: 'rgba(240, 242, 245, 0.70)',
    dark: 'rgba(240, 242, 245, 0.60)',
    figma: 'text-sidebar-default',
    divergent: 'Light-on-dark in both modes — the rail is blue in both. See the group comment.',
  },
};

/**
 * Genset run states — `text-status-running`, `text-status-idle`, …
 *
 * None of these are semantic variables in the design system's "3. Mode"
 * collection, so every `figma` field here is `''`. Only `running` is pinned by
 * the design at all, and it is pinned to a *primitive*
 * (`tailwind colors/blue/500` on the badge's circle glyph) rather than a named
 * role. The other two follow the same Tailwind-500 family so the set reads as
 * one scale, and they are deliberately distinct in *lightness* as well as hue so
 * the badges survive a monochrome screenshot.
 *
 * If the design system ever grows real status roles, these become the first
 * candidates to map — the semantic collection already declares `text-success`
 * and `text-destructive` as names with no values attached.
 */
const STATUS: ColorMap = {
  'status-running': {light: '#3B82F6', dark: '#3B82F6', figma: ''},
  'status-idle': {light: '#94A3B8', dark: '#94A3B8', figma: ''},
  'status-offline': {light: '#64748B', dark: '#64748B', figma: ''},
};

/**
 * Fuel — `bg-fuel`, `bg-fuel-tip`.
 *
 * The genset home page draws fuel in violet, not the teal it gives everything
 * electrical: `tailwind colors/violet/500` fills the tank and tints the runway
 * badge's hourglass, and `violet/400` caps it. Both are primitives rather than
 * semantic roles, so both `figma` fields are `''`.
 *
 * Keeping fuel on its own hue is what lets "how much diesel is left" and "how
 * hard the engine is working" sit side by side in one row without reading as the
 * same measure.
 */
const FUEL: ColorMap = {
  fuel: {light: '#8B5CF6', dark: '#8B5CF6', figma: ''},
  // The topmost filled segment of the tank — a meniscus, one step lighter.
  'fuel-tip': {light: '#A78BFA', dark: '#A78BFA', figma: ''},
};

/**
 * Solar — `bg-solar`, `bg-solar-tip`.
 *
 * A deep amber, and **not** CelcomDigi's own `#FFE000`, which is what this token
 * started as. Their yellow is a brand colour and it is superb at brand jobs: it
 * is one of the two halves of the mark, it sits on navy, it fills a hero. It is
 * unusable as a data mark on a light ground. Against the `element` surface every
 * chart in this app draws on, `#FFE000` measures **1.2:1** — below the 3:1 floor
 * a graphic element needs to be seen at all — so a bar in it reads as an absence
 * where a reader is trying to compare heights.
 *
 * `#C2660C` measures 3.8:1 on that surface and 3.5:1 on the canvas, holds the
 * warm gold a reader expects daylight generation in, and stays 1.9:1 clear of
 * `severity-warning` so the two are still separable when they appear together.
 * The brand yellow keeps every job it was good at; it just stops being asked to
 * be a bar.
 *
 * Distinct in lightness as well as hue from `fuel` and `battery`, because the
 * energy-mix bar stacks all three and a monochrome screenshot of it still has to
 * be readable.
 *
 * The dark value is the inverse problem and takes the inverse answer: on
 * `#151C28` the deep amber is the one that disappears, so dark mode keeps a
 * bright one.
 */
const SOLAR: ColorMap = {
  solar: {light: '#C2660C', dark: '#FBBF24', figma: ''},
  // A step lighter, for the topmost segment of a stacked bar.
  'solar-tip': {light: '#E08A2E', dark: '#FCD34D', figma: ''},
};

/**
 * Battery — `bg-battery`, `bg-battery-tip`.
 *
 * `--colour--celcom-blue` from the same stylesheet, the lighter blue their mark's
 * gradient starts at. Storage sits between generation and load in the diagram, and
 * it sits between solar and diesel here.
 *
 * It is *not* `brand`: the brand blue is a control colour on this build — the
 * login CTA, the primary button — and a battery drawn in it would read as
 * something to click.
 */
const PRODUCT_BATTERY = {base: '#009BDF', tip: '#4FBCEA'};

/**
 * Optional per brand, unlike the three above.
 *
 * A brand that has a storage colour of its own gets it; a brand that does not
 * keeps the product's. CelcomDigi is the first case — `--colour--celcom-blue`
 * happens to be a good storage hue — and SESB is the second, which is the normal
 * one. Storage is a *data* colour, and a customer with no opinion about it should
 * not be made to invent one.
 */
const BATTERY_COLORS = BRAND.theme.battery ?? PRODUCT_BATTERY;

const BATTERY: ColorMap = {
  battery: {light: BATTERY_COLORS.base, dark: BATTERY_COLORS.base, figma: ''},
  'battery-tip': {light: BATTERY_COLORS.tip, dark: BATTERY_COLORS.tip, figma: ''},
};

/**
 * Alert severities — `text-severity-critical`, `text-severity-ok`, …
 *
 * Pinned by the design: the bell and gauge glyphs in the alerts section are
 * exported at exactly these values (`red/500`, `amber/500`, `green/500`). All
 * primitives, so `figma` is `''` throughout.
 *
 * `ok` is the member with no alert behind it — a reading inside its thresholds.
 * It is green rather than neutral-grey because the design uses it as a positive
 * signal, not an absence.
 *
 * There is deliberately no `severity-neutral`: the design paints a neutral bell
 * `#F0F2F5`, which *is* `text-strong`, so neutral severity uses the existing
 * `text-primary`. Adding a fourth token would have duplicated that variable and
 * given `figmaMap()` two token keys claiming one Figma name.
 *
 * `severity-critical` is the only red in the app. Run state answers "is it
 * turning" and stays on the blue-grey scale; severity answers "is a threshold
 * crossed" and owns red on its own, so the two are legible next to each other
 * rather than collapsing into one.
 */
const SEVERITY: ColorMap = {
  'severity-critical': {light: '#EF4444', dark: '#EF4444', figma: ''},
  'severity-warning': {light: '#F59E0B', dark: '#F59E0B', figma: ''},
  'severity-ok': {light: '#22C55E', dark: '#22C55E', figma: ''},
};

/** Everything else — brand text, scrollbar, focus outline, destructive. */
const MISC: ColorMap = {
  // Foreground that sits on `bg-brand`.
  'brand-text': {
    // Moves with `brand`, and has to: the near-black that reads on the product's
    // teal disappears on a mid-blue, so each brand states the foreground its own
    // control colour can actually carry. See `BrandTheme` for why it is declared
    // rather than derived.
    light: BRAND.theme.brandForeground,
    dark: '#161D27',
    figma: 'text-brand',
    divergent:
      "Text on the brand button is the active brand's declared foreground, paired with its own brand colour in brands/identity.ts — do not sync from Figma's text-brand.",
  },
  'scroll-bar': {light: '#9EA6B2', dark: '#4D5561', figma: 'scroll-bar'},
  // Focus ring. Figma carries a single translucent value for both modes —
  // Tailwind gray-500 at 50% — consumed by its `focus/default` effect variable
  // (a 3px spread drop shadow, which is why `button.tsx` pairs this with
  // `ring-[3px]`). The documentation swatch's caption still reads
  // #EAEBED / #202632; that caption is stale, the variable is authoritative.
  outline: {light: '#6B728080', dark: '#6B728080', figma: 'outline'},
  // Destructive button background.
  destructive: {light: '#DC2626', dark: '#B54F57', figma: 'bg-destructive'},
  // Off-white text on the destructive button (NOT pure #FFFFFF).
  white: {light: '#F0F2F5', dark: '#F0F2F5', figma: 'text-white'},
  // Foreground for content sitting on `bg-fill` (inverse of the text scale).
  // Code-only, like `fill` itself.
  'fill-text': {light: '#FFFFFF', dark: '#050915', figma: ''},
};

/** Background color tokens. */
export const background = (): ColorMap => {
  return BACKGROUND;
};

/** Text color tokens. */
export const text = (): ColorMap => {
  return TEXT;
};

/** Border color tokens. */
export const border = (): ColorMap => {
  return BORDER;
};

/** Sidebar color tokens. */
export const sidebar = (): ColorMap => {
  return SIDEBAR;
};

/** Genset run-state color tokens. */
export const status = (): ColorMap => {
  return STATUS;
};

/** Fuel color tokens (the violet tank and its meniscus). */
export const fuel = (): ColorMap => {
  return FUEL;
};

/** Solar color tokens (the yellow the hybrid plant's PV is drawn in). */
export const solar = (): ColorMap => {
  return SOLAR;
};

/** Battery color tokens. */
export const battery = (): ColorMap => {
  return BATTERY;
};

/** Alert-severity color tokens. */
export const severity = (): ColorMap => {
  return SEVERITY;
};

/** Registry of every token group serialized into the theme. */
const GROUPS: Array<ColorMap> = [
  BACKGROUND,
  TEXT,
  BORDER,
  SIDEBAR,
  STATUS,
  FUEL,
  SOLAR,
  BATTERY,
  SEVERITY,
  MISC,
];

const declarations = (mode: ColorMode): string =>
  GROUPS.flatMap((group) =>
    Object.entries(group).map(([name, token]) => `  --${name}: ${token[mode]};`),
  ).join('\n');

/**
 * CSS for the light (`:root`) and dark (`.dark`) custom-property values.
 * Injected once in `main.tsx`; styles.css maps these vars to utilities.
 */
export const colorThemeCss = (): string =>
  `:root {\n${declarations('light')}\n}\n.dark {\n${declarations('dark')}\n}`;

/**
 * Resolved light-mode values, for the places that cannot read a CSS variable.
 *
 * MapLibre's paint properties are the reason this exists: they're evaluated in a
 * WebGL shader, not by the CSS engine, so `var(--status-running)` is meaningless
 * there and the literal has to be handed over. Anything that *can* use a
 * Tailwind utility should — reach for this only from map style code. This
 * white-label build ships light-only, which is why there is one table and not
 * two.
 */
export const lightToken = Object.fromEntries(
  GROUPS.flatMap((group) => Object.entries(group).map(([name, token]) => [name, token.light])),
) as Record<string, string>;

/**
 * Every token flattened to `{tokenKey, figmaVariable}`, both directions.
 *
 * This is the lookup the `figma-tokens` skill reads to translate between a
 * Figma variable and a Tailwind utility without guessing. Tokens with no
 * counterpart are omitted from `byFigma` but present in `byToken` with `''`.
 */
export const figmaMap = (): {
  byToken: Record<string, string>;
  byFigma: Record<string, string>;
} => {
  const byToken: Record<string, string> = {};
  const byFigma: Record<string, string> = {};

  for (const group of GROUPS) {
    for (const [name, token] of Object.entries(group)) {
      byToken[name] = token.figma;
      if (token.figma !== '') {
        byFigma[token.figma] = name;
      }
    }
  }

  return {byToken, byFigma};
};

/**
 * Every token in one flat map, values included.
 *
 * This is what `scripts/check-drift.ts` in the `figma-tokens` org skill imports
 * to diff this app's palette against the live Figma variables. Group membership
 * is an authoring convenience only — nothing downstream depends on it.
 */
export const tokens = (): ColorMap => Object.assign({}, ...GROUPS) as ColorMap;
