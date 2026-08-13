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

  return <SiteHome summary={summary} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/')({
  component: SiteHomeRoute,
});
