import {createFileRoute} from '@tanstack/react-router';
import {FuelIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/refuel')({
  staticData: {crumb: 'Refuel'},
  component: () => (
    <ComingSoon
      icon={FuelIcon}
      title="Refuel"
      description="Scheduling and logging refuels against fuel-level telemetry. Not designed yet."
    />
  ),
});
