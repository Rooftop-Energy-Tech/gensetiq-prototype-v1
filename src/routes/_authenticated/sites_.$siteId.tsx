import {createFileRoute, notFound, useLoaderData} from '@tanstack/react-router';

import {SiteDetailShell} from '@/modules/site/components/SiteDetailShell';
import {siteSummary} from '@/modules/site/data/sites';
import type {SiteSummary} from '@/modules/site/data/sites';

/**
 * Annotated rather than inferred, for the same reason the genset detail route's
 * loader data is: `Route`'s type depends on its component, the component reads the
 * loader's data, and inferring that data from the loader body closes the loop.
 */
type SiteLoaderData = {summary: SiteSummary; crumb: string};

/**
 * One site's pages: `/sites/telco-001`, `/sites/telco-001/runs`, …
 *
 * The trailing underscore on `sites_` un-nests this from `/sites`, exactly as
 * `gensets_` does. Without it TanStack treats the sites list as this route's
 * parent and renders the site page inside it — and `SitesPage` has no `<Outlet />`,
 * so nothing would appear at all.
 *
 * The site is resolved here rather than in each tab, so an unknown id 404s once for
 * the whole section instead of five children repeating the check.
 */
const SiteDetailRoute = () => {
  const {summary} = useLoaderData({from: '/_authenticated/sites_/$siteId'});

  return <SiteDetailShell summary={summary} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId')({
  loader: ({params}): SiteLoaderData => {
    const summary = siteSummary(params.siteId);
    if (summary === undefined) throw notFound();

    // `crumb` is read off loader data by <TopNav />: the breadcrumb has to say
    // `Telco-001`, and `staticData` cannot hold a value that depends on params.
    return {summary, crumb: summary.site.name};
  },
  staticData: {crumbParent: {label: 'Sites', to: '/sites'}},
  component: SiteDetailRoute,
});
