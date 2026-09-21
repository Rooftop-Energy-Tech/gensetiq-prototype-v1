import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {DeploymentPage} from '@/modules/deployment';
import {deploymentSearchSchema} from '@/modules/deployment/types/view.type';
import type {DeploymentSearch} from '@/modules/deployment/types/view.type';

const Deployment = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<DeploymentSearch>) => {
    void navigate({
      search: (previous) => ({...previous, ...next}),
      // Typing would otherwise push one history entry per keystroke — the call the
      // registers make about their own search boxes.
      replace: true,
    });
  };

  return <DeploymentPage search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/deployment')({
  validateSearch: (search: Record<string, unknown>): DeploymentSearch =>
    deploymentSearchSchema.parse(search),
  staticData: {crumb: 'Deployment'},
  component: Deployment,
});
