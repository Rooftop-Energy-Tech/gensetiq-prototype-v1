import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Alarms"
      description="The full alarm history and the threshold rules behind it. The home page shows what is active now; this is the log and the configuration. Named in the design's tab strip but not drawn."
    />
  ),
});
