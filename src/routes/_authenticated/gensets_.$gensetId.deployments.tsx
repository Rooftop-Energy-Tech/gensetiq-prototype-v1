import {createFileRoute, useLoaderData} from '@tanstack/react-router';

import {GensetDeploymentLog} from '@/modules/genset/components/logs/GensetDeploymentLog';

/**
 * The deployments tab — this genset's posting log.
 *
 * The dispatch feed answers "what is out, fleet-wide"; this answers the same
 * question asked of one machine, with each posting's costs beside it. The
 * parent route has already resolved and 404'd the id.
 */
const GensetDeploymentsRoute = () => {
  const {genset} = useLoaderData({from: '/_authenticated/gensets_/$gensetId'});

  return <GensetDeploymentLog key={genset.id} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/deployments')({
  component: GensetDeploymentsRoute,
});
