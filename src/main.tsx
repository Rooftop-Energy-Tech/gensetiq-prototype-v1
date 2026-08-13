import {RouterProvider} from '@tanstack/react-router';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {createRouter} from './router';
import {colorThemeCss} from './styles/colors';
import './styles/styles.css';

/**
 * Token values are injected before the first paint rather than shipped in the
 * stylesheet, mirroring rooftopiq-frontend-v3 — it's what lets `colors.ts` stay
 * the single source of truth for both themes without a build step.
 *
 * GensetIQ is designed dark-only, so `dark` is set unconditionally. The light
 * values still exist in `colors.ts`, so turning this into a real toggle later is
 * a matter of flipping the class, not re-authoring the palette.
 */
const style = document.createElement('style');
style.id = 'theme-colors';
style.textContent = colorThemeCss();
document.head.append(style);
document.documentElement.classList.add('dark');

const router = createRouter();

const container = document.getElementById('app');
if (container === null) throw new Error('#app is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
