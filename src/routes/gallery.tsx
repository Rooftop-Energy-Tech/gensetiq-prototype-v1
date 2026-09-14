import {createFileRoute, notFound} from '@tanstack/react-router';

import {GalleryPage} from '@/modules/gallery';

/**
 * `/gallery` — the component bench. Outside `_authenticated` on purpose: it is a
 * developer tool, and making somebody sign in to look at a button bench would be
 * the kind of friction that stops it being used.
 *
 * ## Dev only
 *
 * `import.meta.env.DEV` is `true` under `vite dev` and `false` in every `vite
 * build`, so the route 404s in the four `dist-*` bundles. Those go in front of
 * customers and an internal page at a guessable URL in one of them is a
 * liability.
 *
 * It costs the shipped app nothing at runtime. `autoCodeSplitting` puts the
 * component in its own chunk (~24 kB, verified against `dist-telcoiq`) and
 * `beforeLoad` runs before that chunk is requested, so a build never fetches it —
 * the file sits on disk unread. Not worth a build-time route filter for that; if
 * it ever matters, drop the file from `tanstackRouter`'s scan rather than
 * complicating this.
 *
 * Flip the constant to ship the gallery in a build — the one line is deliberate,
 * so it is a decision rather than a discovery.
 */
const AVAILABLE = import.meta.env.DEV;

export const Route = createFileRoute('/gallery')({
  beforeLoad: () => {
    if (!AVAILABLE) throw notFound();
  },
  component: GalleryPage,
});
