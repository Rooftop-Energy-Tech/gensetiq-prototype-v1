import {createFileRoute} from '@tanstack/react-router';
import {ChartLineIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/analysis')({
  component: () => (
    <ComingSoon
      icon={ChartLineIcon}
      title="Analysis"
      description="State of charge over time, cycles and throughput, and depth of discharge. The history behind the single SoC figure the site diagram shows — the largest gap in the model as it stands. Empty."
    />
  ),
});
