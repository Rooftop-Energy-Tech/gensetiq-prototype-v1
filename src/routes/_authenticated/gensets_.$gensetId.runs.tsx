import {createFileRoute} from '@tanstack/react-router';
import {ListIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/runs')({
  component: () => (
    <ComingSoon
      icon={ListIcon}
      title="Runs"
      description="Every run this genset has completed, with its runtime, energy produced and fuel consumed. Named in the design's tab strip but not drawn."
    />
  ),
});
