import {createFileRoute, useParams} from '@tanstack/react-router';
import {useState} from 'react';

import {DeploymentGensets} from '@/modules/deployment/components/detail/DeploymentGensets';
import {useDeploymentRow} from '@/modules/deployment/data/detail';

/**
 * Which machines are on this job, and the controls that put one on and collect one. The one section here that writes.
 *
 * The parent route has already resolved and 404'd the id, so the lookup here cannot
 * fail. It is repeated rather than threaded down as loader data for the reason the
 * site's own sections repeat theirs: the parent renders only the rail, and a route
 * boundary should not carry an object it does not use.
 */
const SectionRoute = () => {
  const {deploymentId} = useParams({from: '/_authenticated/deployments_/$deploymentId'});
  // One clock reading for the whole section, the rule every `now` in this app
  // follows: two bands of one page must not straddle a minute boundary and disagree
  // about whether a job has started.
  const [now] = useState(() => Date.now());
  const row = useDeploymentRow(deploymentId, now);
  if (row === undefined) return null;

  return <DeploymentGensets key={deploymentId} row={row} />;
};

export const Route = createFileRoute('/_authenticated/deployments_/$deploymentId/gensets')({
  component: SectionRoute,
});
