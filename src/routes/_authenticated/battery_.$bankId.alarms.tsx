import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * This is why the alarm column on the home page reads zero at every bank on the estate: not because they are all healthy, but because no rule has ever been written. A genset has fifty thresholds off its controller and a solar system has five of this app's own arithmetic; storage has none, and it is the component whose failure takes the site down.
 */
export const Route = createFileRoute('/_authenticated/battery_/$bankId/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Alarms"
      description="Cell imbalance, over-temperature, low state of charge, BMS faults. A bank is the component that decides whether a tower stays up overnight and it currently raises no alarms at all. Empty."
    />
  ),
});
