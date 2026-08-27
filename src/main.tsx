import {RouterProvider} from '@tanstack/react-router';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {BRAND} from './brands';
import {createRouter} from './router';
import {colorThemeCss} from './styles/colors';
import './styles/styles.css';

/**
 * Token values are injected before the first paint rather than shipped in the
 * stylesheet, mirroring rooftopiq-frontend-v3 — it's what lets `colors.ts` stay
 * the single source of truth for both themes without a build step.
 *
 * This white-label build ships light-only — the customer's own colour scheme —
 * so the `dark` class is never added and `:root`'s light values carry the app.
 * The dark palette still exists in `colors.ts`, so turning this into a real
 * toggle later is a matter of flipping the class, not re-authoring the palette.
 */
const style = document.createElement('style');
style.id = 'theme-colors';
style.textContent = colorThemeCss();
document.head.append(style);

/**
 * Reconcile the tab to the brand actually running.
 *
 * `index.html` is stamped at build time by the `brandHtml` plugin, which is what
 * makes the title correct before any JavaScript loads — no flash of the wrong
 * customer's name. But the Settings picker can switch brand for a session, and a
 * build-time title cannot know that: an SESB session would sit in a tab reading
 * "CelcomDigi Site Power", which is exactly the mismatch `brands/active.ts` throws
 * on a bad `VITE_BRAND` to prevent.
 *
 * So the plugin gets the first paint right and this gets the session right. Both
 * read `brands/tab.ts`, so they agree by construction and this is a no-op whenever
 * nobody has picked anything.
 */
document.title = BRAND.documentTitle;

for (const link of document.querySelectorAll<HTMLLinkElement>(
  'link[rel="icon"], link[rel="apple-touch-icon"]',
)) {
  link.href = `/${BRAND.faviconPath}`;
}

const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
if (description !== null) description.content = BRAND.documentDescription;

const router = createRouter();

const container = document.getElementById('app');
if (container === null) throw new Error('#app is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
