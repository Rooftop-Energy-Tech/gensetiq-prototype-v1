import {createFileRoute} from '@tanstack/react-router';

import {DeploymentPage} from '@/modules/deployment';

export const Route = createFileRoute('/_authenticated/deployment')({
  staticData: {crumb: 'Deployment'},
  component: DeploymentPage,
});
