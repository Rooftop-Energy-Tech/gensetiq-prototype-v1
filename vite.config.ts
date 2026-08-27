import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import type {PluginOption} from 'vite';

import {tanstackRouter} from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import {brandTab} from './src/brands/tab';

/**
 * Fill `index.html`'s `%BRAND_*%` placeholders from the active brand.
 *
 * The `<head>` is the one place a brand shows up outside the React tree — the tab
 * title, the description and the favicon are read by the browser before any of our
 * code runs — so they cannot come from `brands/identity.ts` the way every other
 * brand value does. This plugin is the bridge, and `src/brands/tab.ts` is the
 * module both sides share so neither has to restate the strings.
 *
 * ## Why the brand is read in `configResolved` and not from `process.env`
 *
 * Because `.env.local` exists. Vite loads `.env` files into `import.meta.env` for
 * client code, and **not** into `process.env` — so a plugin reading
 * `process.env.VITE_BRAND` sees a shell variable and misses a file. Setting
 * `VITE_BRAND=sesb` in `.env.local` would then render the whole app as SESB while
 * leaving "CelcomDigi Site Power" in the tab: one customer's name over another
 * customer's estate, which is precisely the failure `brands/active.ts` throws to
 * prevent.
 *
 * `config.env` is the resolved client env, so it agrees with what
 * `import.meta.env.VITE_BRAND` will be at runtime by construction. Both sources
 * work, and they cannot disagree.
 *
 * `brandTab` throws on an unknown brand, which fails the dev server and the
 * production build rather than shipping a tab that says the wrong customer's name.
 * Unset is fine and matches `brands/active.ts`'s fallback — keep the two in step.
 */
const FALLBACK_BRAND = 'celcomdigi';

const brandHtml = (): PluginOption => {
  let brandId = FALLBACK_BRAND;

  return {
    name: 'brand-html',
    configResolved: (config) => {
      const requested = config.env.VITE_BRAND;
      brandId =
        typeof requested === 'string' && requested !== '' ? requested : FALLBACK_BRAND;
    },
    transformIndexHtml: (html: string) => {
      const tab = brandTab(brandId);

      return html
        .replace(/%BRAND_TITLE%/g, tab.title)
        .replace(/%BRAND_DESCRIPTION%/g, tab.description)
        .replace(/%BRAND_FAVICON%/g, `/${tab.faviconPath}`);
    },
  };
};

// Port 3100 rather than 3000: rooftopiq-frontend-v3 pins :3000 with
// `strictPort`, and the two prototypes should be runnable side by side.
export default defineConfig({
  server: {
    port: 3100,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    // Must precede the React plugin — it generates routeTree.gen.ts from
    // src/routes before React transforms the modules that import it.
    tanstackRouter({target: 'react', autoCodeSplitting: true}),
    tailwindcss(),
    viteReact(),
    brandHtml(),
  ],
});
