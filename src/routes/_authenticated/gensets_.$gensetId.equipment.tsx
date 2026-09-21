import {createFileRoute} from '@tanstack/react-router';
import {WrenchIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/equipment')({
  component: () => (
    <ComingSoon
      icon={WrenchIcon}
      title="Equipment"
      description="Nameplate data, the controller and ATS fitted, and the service schedule. Named `Devices` in the design's rail but not drawn."
    />
  ),
});
