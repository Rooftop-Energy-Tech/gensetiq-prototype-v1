import {createFileRoute, useParams} from '@tanstack/react-router';

import {SiteSettings} from '@/modules/site/components/SiteSettings';
import {useSiteSummary} from '@/modules/site/data/sites';

/**
 * The site's Settings tab.
 *
 * Same shape as the Home route beside it: the parent has already resolved and 404'd
 * the id, so the lookup here cannot fail, and it is repeated rather than threaded
 * down because the parent renders only the header.
 *
 * No `key` on the component, unlike Home. Home needs one because it holds a
 * changeover selection that must not follow a reader to another yard; this page holds
 * no state of its own — the role lives in the config store, keyed by site id.
 */
const SiteSettingsRoute = () => {
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});
  const summary = useSiteSummary(siteId);
  if (summary === undefined) return null;

  return <SiteSettings summary={summary} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/settings')({
  component: SiteSettingsRoute,
});
