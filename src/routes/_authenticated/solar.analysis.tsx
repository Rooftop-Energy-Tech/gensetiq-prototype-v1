import {createFileRoute} from '@tanstack/react-router';
import {ChartLineIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/analysis')({
  component: () => (
    <ComingSoon
      icon={ChartLineIcon}
      title="Analysis"
      description="Generation over time, and what it should have been. Where a shortfall gets attributed to a cause — soiling, shading, a string down, an inverter derating in the heat — rather than left as a single percentage. Empty."
    />
  ),
});
