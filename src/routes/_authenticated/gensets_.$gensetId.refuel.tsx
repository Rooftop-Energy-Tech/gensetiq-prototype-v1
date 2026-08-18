import {createFileRoute, useLoaderData} from '@tanstack/react-router';

import {GensetRefuelLog} from '@/modules/genset/components/logs/GensetRefuelLog';

/**
 * The refuel tab — this genset's cut of the fleet-wide refuel order log.
 *
 * Same orders as the Refuel page, filtered to one machine, so the tanker's
 * paperwork reads identically whichever screen it is met on. The parent route
 * has already resolved and 404'd the id.
 */
const GensetRefuelRoute = () => {
  const {genset} = useLoaderData({from: '/_authenticated/gensets_/$gensetId'});

  return <GensetRefuelLog key={genset.id} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/refuel')({
  component: GensetRefuelRoute,
});
