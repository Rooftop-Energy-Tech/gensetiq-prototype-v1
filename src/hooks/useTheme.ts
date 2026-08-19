import {useSyncExternalStore} from 'react';

import {background} from '@/styles/colors';
import type {ColorMode} from '@/styles/colors';

/**
 * Light/dark mode, shared across the app.
 *
 * Ported from `rooftopiq-frontend-v3/src/hooks/useTheme.tsx`, keeping that file's
 * three decisions:
 *
 *   - **One writer.** The DOM class, the storage write and the status-bar tint
 *     all happen in `apply`, never in a consumer effect, so reading the mode
 *     stays a pure subscription however many components do it. In the library
 *     this was a real bug: per-component `useState` meant toggling from the
 *     header flipped `.dark` but left the sidebar's copy stale, so it went on
 *     rendering the dark-on-dark logo (RIQ-2263 / RIQ-2293).
 *   - **Applied at module load**, not from a mount effect — earlier than React
 *     can run, so the first paint is already the right theme.
 *   - **A manual choice, not `prefers-color-scheme`.** The OS preference is
 *     deliberately not consulted; the user's last explicit choice wins, and the
 *     `theme-color` meta tag is written imperatively for the same reason (a
 *     `media` variant on the tag would be wrong half the time).
 *
 * Where it differs: the library backs this with zustand, which this prototype
 * doesn't depend on, so it uses the same `useSyncExternalStore` shape as
 * `modules/auth/session.ts`. And the mode is a `ColorMode` rather than a
 * boolean, because that's the type `colors.ts` already indexes both palettes by.
 */

const STORAGE_KEY = 'gensetiq.theme';

/** GensetIQ is designed dark-first, so an unset preference means dark. */
const DEFAULT_MODE: ColorMode = 'dark';

/**
 * The installed app's status-bar tint. Read from the token source rather than
 * copied, so it cannot drift from the palette the first paint actually uses.
 */
const THEME_COLOR = background().canvas;

const listeners = new Set<() => void>();

const read = (): ColorMode => {
  // Guard the whole read: Safari in private mode throws on localStorage access
  // rather than returning null, which would take the app down at import time.
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

let mode: ColorMode = read();

/** The only writer of the mode to <html> and to the status bar. */
const apply = (next: ColorMode) => {
  document.documentElement.classList.toggle('dark', next === 'dark');
  // Keep the browser/PWA chrome on the actual theme. `index.html` ships the dark
  // value as a static tag; this is what moves it.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[next]);
};

export const setTheme = (next: ColorMode) => {
  if (next === mode) return;
  mode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Private mode — the choice just won't survive a reload. */
  }
  apply(mode);
  for (const listener of listeners) listener();
};

export const toggleTheme = () => {
  setTheme(mode === 'dark' ? 'light' : 'dark');
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Subscribe to the current mode. Call `toggleTheme` / `setTheme` to change it. */
export const useTheme = (): ColorMode =>
  useSyncExternalStore(
    subscribe,
    () => mode,
    () => DEFAULT_MODE,
  );

// Apply the persisted choice once at load, before React renders anything.
apply(mode);
