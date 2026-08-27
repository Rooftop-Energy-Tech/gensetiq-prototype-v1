import {createFileRoute} from '@tanstack/react-router';
import {WrenchIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/service')({
  component: () => (
    <ComingSoon
      icon={WrenchIcon}
      title="Service"
      description="Capacity testing and replacement forecasting: measured capacity against nameplate, state of health, and when a bank is due to be swapped. Empty."
    />
  ),
});
