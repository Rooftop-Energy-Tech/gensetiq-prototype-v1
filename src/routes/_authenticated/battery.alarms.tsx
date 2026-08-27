import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Alarms"
      description="Cell imbalance, over-temperature, low state of charge, BMS faults. A bank is the component that decides whether a tower stays up overnight and it currently raises no alarms at all. Empty."
    />
  ),
});
