import {createFileRoute} from '@tanstack/react-router';
import {WrenchIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/equipment')({
  component: () => (
    <ComingSoon
      icon={WrenchIcon}
      title="Equipment"
      description="Nameplate: modules and their count, the inverter fitted, tilt and azimuth, and the commissioning record. What is bolted to the site, and what it was rated at on the day. Empty."
    />
  ),
});
