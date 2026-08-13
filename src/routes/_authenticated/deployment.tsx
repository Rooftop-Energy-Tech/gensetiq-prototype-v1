import {createFileRoute} from '@tanstack/react-router';
import {TruckIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/deployment')({
  staticData: {crumb: 'Deployment'},
  component: () => (
    <ComingSoon
      icon={TruckIcon}
      title="Deployment"
      description="Moving gensets between sites — dispatch, transit and handover. Not designed yet."
    />
  ),
});
