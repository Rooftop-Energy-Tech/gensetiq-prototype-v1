import {createFileRoute, useParams} from '@tanstack/react-router';

import {SiteDeployments} from '@/modules/site/components/SiteDeployments';

/**
 * Every job this yard has held.
 *
 * The site's own answer to "have we had a set here before", which the register can
 * also answer and which a reader standing on the site should not have to leave the
 * site to ask. See `SiteDeployments`.
 */
const SiteDeploymentsRoute = () => {
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});

  return <SiteDeployments key={siteId} siteId={siteId} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/deployments')({
  component: SiteDeploymentsRoute,
});
