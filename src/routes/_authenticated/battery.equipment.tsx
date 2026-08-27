import {createFileRoute} from '@tanstack/react-router';
import {BoxesIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/equipment')({
  component: () => (
    <ComingSoon
      icon={BoxesIcon}
      title="Equipment"
      description="Nameplate: chemistry, rack and module layout, the BMS and converter fitted, and the commissioning record. Empty."
    />
  ),
});
