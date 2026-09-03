import {createFileRoute} from '@tanstack/react-router';
import {WrenchIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * A bank's service clock is not hours run, the way a genset's is — it is cycles and calendar age, and a capacity test is the only thing that says where a bank actually stands against the nameplate this app quotes everywhere. Until `Analysis` counts cycles there is nothing here to test against.
 */
export const Route = createFileRoute('/_authenticated/battery_/$bankId/service')({
  component: () => (
    <ComingSoon
      icon={WrenchIcon}
      title="Service"
      description="Capacity testing and replacement forecasting: measured capacity against nameplate, state of health, and when a bank is due to be swapped. Empty."
    />
  ),
});
