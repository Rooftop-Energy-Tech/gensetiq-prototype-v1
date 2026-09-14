import {MoonIcon, SunIcon} from 'lucide-react';
import {useEffect, useState} from 'react';

import {ACTIVE_BRAND_ID, BRAND, brandIdentity, INCLUDED_BRAND_IDS} from '@/brands';
import {setStoredBrandId} from '@/brands/selection';
import type {BrandId} from '@/brands';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {GlobalsSection} from '@/modules/gallery/globals';
import {PrimitivesSection} from '@/modules/gallery/primitives';
import {TokensSection} from '@/modules/gallery/tokens';

/**
 * **The component gallery — every shared piece, every state, one page.**
 *
 * ## Why this and not Storybook
 *
 * Storybook's job is to stage a component away from the app, because in most
 * codebases a component cannot be rendered without a server, a store and a
 * session. None of that is true here: this prototype has no backend, every module
 * ships static fixtures in its own `data/` folder, and all forty-two routes render
 * the real screens against real-looking data with no setup at all. Buying a second
 * build, a second dev server and ~175 story files to re-stage what the app already
 * stages would be paying Storybook's price for a problem this repo does not have.
 *
 * What the running app genuinely *cannot* show is **every state at once**. A
 * battery glyph at five charge levels, an alarm pill at all three severities, a
 * filter card active and inactive, a button in seven variants — those are spread
 * across screens and conditions you would have to manufacture. So the gallery
 * covers the shared tiers, where that matters, and the ~140 page-shaped components
 * under `src/modules/*` stay browsable at their own URLs, which is a better bench
 * than anything staged here.
 *
 * It also does two things Storybook would need extra wiring for, because both are
 * build-level concerns here rather than component ones:
 *
 * - **The brand switcher.** Five brands recolour the whole app through the token
 *   layer. On this page you can watch every component change at once, which is the
 *   fastest way to catch a hardcoded colour.
 * - **The token table.** `styles/colors.ts` is the real design system and had no
 *   viewer. `tokens.tsx` draws all of it, both modes, with each token's Figma
 *   variable beside it.
 *
 * ## Dev only
 *
 * The route throws `notFound()` outside `vite dev` — see `routes/gallery.tsx`. The
 * four `dist-*` builds go in front of customers, and an internal bench reachable
 * at a guessable URL in one of those is a liability, not a feature.
 *
 * ## The dark switch
 *
 * `main.tsx` ships this build light-only and never adds the `dark` class, but
 * `colors.ts` carries a complete dark palette and `colorThemeCss()` already emits
 * the `.dark` block. The switch here adds the class to `<html>`, so the palette
 * that has never been exercised can at least be looked at. Expect to find things
 * wrong with it — that is the point of having somewhere to look.
 */

type SectionLink = {id: string; label: string};

const SECTIONS: ReadonlyArray<SectionLink> = [
  {id: 'primitives', label: 'Primitives'},
  {id: 'globals', label: 'Shared components'},
  {id: 'tokens', label: 'Colour tokens'},
];

/**
 * The brand picker, borrowed in spirit from Settings but drawn as a compact row —
 * the gallery's header has no room for that page's tiles, and here the swatch is
 * doing the work anyway.
 *
 * Switching writes `localStorage` and reloads, exactly as Settings does, because
 * `ACTIVE_BRAND_ID` is resolved once at module load. See `brands/active.ts` for
 * why that is the honest design rather than a shortcut.
 */
const BrandSwitch = () => {
  if (INCLUDED_BRAND_IDS.length < 2) return null;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Brand">
      {INCLUDED_BRAND_IDS.map((id: BrandId) => {
        const brand = brandIdentity(id);
        const active = id === ACTIVE_BRAND_ID;

        return (
          <button
            key={id}
            type="button"
            title={brand.name}
            aria-pressed={active}
            onClick={() => {
              if (!active) setStoredBrandId(id);
            }}
            className={cn(
              'flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-outline',
              active ? 'border-teal' : 'border-subtle opacity-60 hover:opacity-100',
            )}
            style={{backgroundColor: brand.theme.sidebar}}
          >
            <img src={brand.mark} alt={brand.name} className="max-h-4 max-w-4 object-contain" />
          </button>
        );
      })}
    </div>
  );
};

/**
 * Light/dark, by toggling the class `styles.css`'s `dark` variant keys off.
 *
 * Not persisted. A stored theme would outlive the gallery session and leave the
 * rest of the app in a mode it was never built for — and unlike the brand choice,
 * nothing here needs it to survive a reload.
 */
const ThemeSwitch = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  return (
    <Button variant="outline" size="sm" onClick={() => setDark((on) => !on)}>
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
      {dark ? 'Light' : 'Dark'}
    </Button>
  );
};

export const GalleryPage = () => (
  <div className="min-h-screen bg-canvas">
    <header className="sticky top-0 z-20 border-b border-subtle bg-element/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-sm font-semibold text-primary">Component gallery</h1>
          <p className="truncate text-xs text-secondary">
            telcoiq-frontend · running as {BRAND.name}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <BrandSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </header>

    <div className="mx-auto flex max-w-[1400px] gap-8 px-6 py-6">
      {/* The rail is `lg:` and up only. Below that the sections simply run on —
          three anchors are not worth a drawer, and the page is short enough to
          scroll. */}
      <nav aria-label="Sections" className="hidden w-40 shrink-0 lg:block">
        <ul className="sticky top-20 flex flex-col gap-0.5">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block rounded-md px-2.5 py-1.5 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-10 pb-24">
        <PrimitivesSection />
        <GlobalsSection />
        <TokensSection />
      </main>
    </div>
  </div>
);
