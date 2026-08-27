import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Alarms"
      description="String and inverter faults — a string offline, an earth fault, an inverter tripped or curtailing. None of these exist in the model yet; the estate has no array alarms at all. Empty."
    />
  ),
});
