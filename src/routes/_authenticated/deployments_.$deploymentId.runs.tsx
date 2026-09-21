import {createFileRoute, useParams} from '@tanstack/react-router';
import {useState} from 'react';

import {DeploymentRuns} from '@/modules/deployment/components/detail/DeploymentRuns';
import {useDeploymentRow} from '@/modules/deployment/data/detail';

/**
 * What the machines on this job ran inside its window. The window is the job, so there is no range picker.
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

  return <DeploymentRuns key={deploymentId} row={row} now={now} />;
};

export const Route = createFileRoute('/_authenticated/deployments_/$deploymentId/runs')({
  component: SectionRoute,
});
