import {createFileRoute, useParams} from '@tanstack/react-router';

import {SiteHome} from '@/modules/site/components/SiteHome';
import {siteSummary} from '@/modules/site/data/sites';

/**
 * The site home page — the tab a click from the sites list lands on, and the one
 * the Figma frame draws.
 *
 * The parent route has already resolved and 404'd the id, so the lookup here
 * cannot fail. It is repeated rather than threaded down as loader data for the same
 * reason the genset home page repeats its own: the parent renders only the header,
 * and a route boundary should not carry an object it doesn't use.
 */
const SiteHomeRoute = () => {
  // Read off the parent explicitly: `$siteId` belongs to the layout route, and
  // this index route's own params are empty.
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});
  const summary = siteSummary(siteId);
  if (summary === undefined) return null;

  /**
   * `key` so a different site is a different component instance.
   *
   * `SiteHome` holds the changeover selection in `useState`, and moving between two
   * sites — Back and Forward between them, say — reuses this instance, so the
   * initialiser does not re-run and the new site inherits the old one's duty set.
   * Since no genset there matches, every isolator draws open and the page reports a
   * running site as unserved.
   *
   * Keying it rather than reconciling the state is the right fix: a changeover
   * selection is a fact about *this* yard's plant, and it should no more survive
   * moving to another site than it should survive a reload.
   */
  return <SiteHome key={siteId} summary={summary} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/')({
  component: SiteHomeRoute,
});
