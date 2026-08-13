import {createRouter as createTanStackRouter} from '@tanstack/react-router';

import {NotFound} from '@/components/global/NotFound';
import {routeTree} from './routeTree.gen';

export const createRouter = () =>
  createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
  });

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
  /** Per-route metadata read off matches in <TopNav />. */
  interface StaticDataRouteOption {
    /**
     * Fixed breadcrumb label. A route whose label depends on its params returns
     * `crumb` from its loader instead — see the comment on `useCrumbs()`.
     */
    crumb?: string;
    /**
     * One ancestor crumb rendered in front of this route's own, for a route that
     * is a *sibling* of its logical parent rather than a child of it.
     *
     * `to` is a plain `string`, not one of `Link`'s path literals: `staticData` is
     * declared here, above the generated route tree, so the union isn't available
     * to it. The trade is a breadcrumb path that isn't checked against the router —
     * acceptable for one link, and a typo shows up the first time anyone clicks it.
     */
    crumbParent?: {label: string; to: string};
  }
}
