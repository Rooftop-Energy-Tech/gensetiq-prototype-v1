import {createFileRoute, notFound, useLoaderData} from '@tanstack/react-router';

import {GensetDetailShell} from '@/modules/genset/components/detail/GensetDetailShell';
import {gensetById, gensetDetail} from '@/modules/genset/data/detail';
import {gensetName} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';

/**
 * Annotated rather than inferred, and it has to be.
 *
 * `Route`'s type depends on its `component`, the component reads the loader's
 * data, and inferring that data from the loader body closes the loop —
 * TS2322, "'Route' implicitly has type 'any' because it is referenced in its own
 * initializer". Naming the shape here breaks the cycle.
 */
type GensetLoaderData = {genset: Genset; online: boolean; crumb: string};

/**
 * One genset's pages: `/gensets/brf9540`, `/gensets/brf9540/runs`, …
 *
 * The trailing underscore on `gensets_` un-nests this from the `/gensets` route.
 * Without it TanStack treats the fleet screen as this route's parent and renders
 * the detail page inside it — and `GensetsPage` has no `<Outlet />`, so nothing
 * would appear at all.
 *
 * The genset is resolved here rather than in each tab, so an unknown id 404s once
 * for the whole section instead of six children repeating the check.
 */
const GensetDetailRoute = () => {
  const {genset, online} = useLoaderData({from: '/_authenticated/gensets_/$gensetId'});

  return <GensetDetailShell genset={genset} online={online} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId')({
  loader: ({params}): GensetLoaderData => {
    const genset = gensetById(params.gensetId);
    const detail = gensetDetail(params.gensetId);
    if (genset === undefined || detail === undefined) throw notFound();

    // `crumb` is read off loader data by <TopNav />: the breadcrumb has to say
    // `BRF9540 | Cummins 1000 kVa`, and `staticData` cannot hold a value that
    // depends on the params.
    return {genset, online: detail.online, crumb: gensetName(genset)};
  },
  staticData: {crumbParent: {label: 'Gensets', to: '/gensets'}},
  component: GensetDetailRoute,
});
