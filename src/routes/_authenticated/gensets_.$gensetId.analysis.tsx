import {createFileRoute} from '@tanstack/react-router';
import {ChartLineIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/analysis')({
  component: () => (
    <ComingSoon
      icon={ChartLineIcon}
      title="Analysis"
      description="Trends across a genset's runs — load profile, fuel efficiency, availability over time. Named in the design's tab strip but not drawn."
    />
  ),
});
