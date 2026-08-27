import {createFileRoute} from '@tanstack/react-router';
import {BatteryChargingIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/')({
  component: () => (
    <ComingSoon
      icon={BatteryChargingIcon}
      title="Battery"
      description="The bank register — a row per bank across both hybrid configurations. Site, usable kWh, hours of autonomy, and the state of charge now. Empty until the columns are decided."
    />
  ),
});
