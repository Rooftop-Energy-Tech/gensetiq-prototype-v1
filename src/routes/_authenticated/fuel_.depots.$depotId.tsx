import {createFileRoute, notFound, useLoaderData} from '@tanstack/react-router';

import {DepotPage} from '@/modules/fuel/DepotPage';
import {DEPOTS} from '@/modules/fuel/data/depotTank';
import type {Depot} from '@/modules/fuel/data/depotTank';

/** Annotated for the same reason as the genset detail route's: the loop through `component`. */
type DepotLoaderData = {depot: Depot; crumb: string};

/**
 * One yard's page: `/fuel/depots/klang`.
 *
 * `fuel_` un-nests it from `/fuel`, as `gensets_` does for a genset — `FuelPage`
 * has no `<Outlet />`. So the match chain has no Fuel page in it, and the trail's
 * `Fuel / Depots` comes from `crumbParent`.
 */
const DepotRoute = () => {
  const {depot} = useLoaderData({from: '/_authenticated/fuel_/depots/$depotId'});
  return <DepotPage depot={depot} />;
};

export const Route = createFileRoute('/_authenticated/fuel_/depots/$depotId')({
  loader: ({params}): DepotLoaderData => {
    const depot = DEPOTS.find((entry) => entry.id === params.depotId);
    if (depot === undefined) throw notFound();
    return {depot, crumb: `${depot.name} depot`};
  },
  staticData: {
    crumbParent: [
      {label: 'Fuel', to: '/fuel'},
      {label: 'Depots', to: '/fuel'},
    ],
  },
  component: DepotRoute,
});
