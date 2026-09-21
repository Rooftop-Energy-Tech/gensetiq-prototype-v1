import {useMemo} from 'react';

import {useFleet} from '@/modules/genset/data/deployment';
import {deploymentRow} from './feed';
import type {DeploymentRow} from './feed';
import {useDeployments} from './store';

/**
 * One job, live, for its own pages.
 *
 * Both stores are read rather than one: the record says what the job *is* and the
 * fleet says what its machines are called and what state they are in, and a page
 * that subscribed only to the record would keep a collected set's old run state on
 * screen. `useFleet` is a subscription rather than an input, which is why it is a
 * dependency the exhaustive-deps rule cannot see.
 *
 * `now` is the caller's, the rule every clock reading in this app follows: the page
 * takes one and hands it down, so the header, the strip and the bars cannot straddle
 * a minute boundary and disagree about whether a job has started.
 */
export const useDeploymentRow = (
  deploymentId: string,
  now: number,
): DeploymentRow | undefined => {
  const {deployments, memberships} = useDeployments();
  const fleet = useFleet();

  return useMemo(() => {
    const deployment = deployments.find((job) => job.id === deploymentId);
    if (deployment === undefined) return undefined;

    return deploymentRow(
      deployment,
      memberships.filter((member) => member.deploymentId === deploymentId),
      now,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments, memberships, fleet, deploymentId, now]);
};
