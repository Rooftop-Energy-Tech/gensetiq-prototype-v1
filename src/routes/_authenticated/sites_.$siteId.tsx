import {createFileRoute, notFound, useParams} from '@tanstack/react-router';

import {SiteDetailShell} from '@/modules/site/components/SiteDetailShell';
import {useSiteSummary} from '@/modules/site/data/sites';
import {siteSeed} from '@/modules/site/data/siteSeed';

/**
 * Annotated rather than inferred, for the same reason the genset detail route's
 * loader data is: `Route`'s type depends on its component, the component reads the
 * loader's data, and inferring that data from the loader body closes the loop.
 */
type SiteLoaderData = {crumb: string};

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
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});
  // Live from the store, not from loader data. Gensets can be attached and detached
  // on the Settings tab, and a loader runs on navigation — so the header's genset
  // count and capacity would still be describing the yard as it was on arrival.
  const summary = useSiteSummary(siteId);
  if (summary === undefined) return null;

  return <SiteDetailShell summary={summary} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId')({
  loader: ({params}): SiteLoaderData => {
    // The **seed**, not a summary. Whether a site exists and what it is called are
    // the two things membership cannot change, so the guard and the breadcrumb are
    // exactly the parts that belong in a loader — and reading them here keeps the
    // route out of the derived layer entirely.
    const seed = siteSeed(params.siteId);
    if (seed === undefined) throw notFound();

    // `crumb` is read off loader data by <TopNav />: the breadcrumb has to say
    // `Telco-001`, and `staticData` cannot hold a value that depends on params.
    return {crumb: seed.name};
  },
  staticData: {crumbParent: {label: 'Sites', to: '/sites'}},
  component: SiteDetailRoute,
});
