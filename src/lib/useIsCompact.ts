import {useSyncExternalStore} from 'react';

/**
 * Is the viewport phone-width — Tailwind's `md` breakpoint, read in JavaScript.
 *
 * Almost every responsive decision in this app is made in CSS with an `md:`
 * prefix, and should be: a class is cheaper than a re-render and it cannot get out
 * of step with the stylesheet. This exists for the handful that CSS cannot make,
 * where the *tree* differs rather than its layout —
 *
 *  - the fleet and sites lists render a table on a desktop and cards on a phone.
 *    `hidden md:table` on one and `md:hidden` on the other would mount both, which
 *    means every row's links and tooltips exist twice in the accessibility tree.
 *  - the preview panel is not shown on a phone at all, and the page's map inset
 *    arithmetic is a number, not a class.
 *
 * 767px, not 768, because `md:` applies at `min-width: 768px` — the two have to
 * meet exactly or one pixel of width belongs to both layouts or to neither.
 *
 * The server snapshot is `false`. There is no `matchMedia` during a render on the
 * server, and the desktop layout is the honest default for a prototype whose
 * designed frames are all desktop.
 */
const QUERY = '(max-width: 767px)';

const subscribe = (listener: () => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
};

export const useIsCompact = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
