import {createFileRoute, notFound, useParams} from '@tanstack/react-router';
import {useState} from 'react';

import {DeploymentDetailShell} from '@/modules/deployment/components/detail/DeploymentDetailShell';
import {useDeploymentRow} from '@/modules/deployment/data/detail';
import {deploymentById} from '@/modules/deployment/data/store';

/**
 * Annotated rather than inferred, for the reason the site and genset detail routes
 * give: `Route`'s type depends on its component, the component reads the loader's
 * data, and inferring that data from the loader body closes the loop.
 */
type DeploymentLoaderData = {crumb: string};

/**
 * One job's pages: `/deployments/em-job-0`, `/deployments/em-job-0/gensets`, …
 *
 * The trailing underscore on `deployments_` un-nests this from `/deployments`,
 * exactly as `sites_` and `gensets_` do. Without it TanStack treats the register as
 * this route's parent and renders the job inside it — and `DeploymentPage` has no
 * `<Outlet />`, so nothing would appear at all.
 *
 * The job is resolved here rather than in each section, so an unknown id 404s once
 * for the whole thing instead of five children repeating the check.
 */
const DeploymentDetailRoute = () => {
  const {deploymentId} = useParams({from: '/_authenticated/deployments_/$deploymentId'});
  // One clock reading for as long as this section is mounted, and the rail reads the
  // job live from the store: a machine added on the Gensets section has to change the
  // header's own state without a reload.
  const [now] = useState(() => Date.now());
  const row = useDeploymentRow(deploymentId, now);
  if (row === undefined) return null;

  return <DeploymentDetailShell deployment={row.deployment} />;
};

export const Route = createFileRoute('/_authenticated/deployments_/$deploymentId')({
  loader: ({params}): DeploymentLoaderData => {
    // The record, not a row: whether a job exists and what it is called are the two
    // things its machines cannot change, so the guard and the breadcrumb are exactly
    // the parts that belong in a loader.
    const deployment = deploymentById(params.deploymentId);
    if (deployment === undefined) throw notFound();

    // `crumb` is read off loader data by <TopNav />: the breadcrumb has to say
    // `DEP-0042`, and `staticData` cannot hold a value that depends on params.
    return {crumb: deployment.reference};
  },
  staticData: {crumbParent: {label: 'Deployments', to: '/deployments'}},
  component: DeploymentDetailRoute,
});
