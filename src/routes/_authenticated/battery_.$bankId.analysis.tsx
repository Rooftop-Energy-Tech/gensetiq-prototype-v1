import {createFileRoute} from '@tanstack/react-router';
import {ChartLineIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * The chart on the home page walks `hybridState` through a day, a month or a year and reads its charge cycle back. What it cannot do is say how many times the bank has been round that cycle, how deep each swing went, or how much energy has passed through it — because nothing in the model accumulates. This is where that history would go, and it is the section the bank's remaining service and health questions all wait on.
 */
export const Route = createFileRoute('/_authenticated/battery_/$bankId/analysis')({
  component: () => (
    <ComingSoon
      icon={ChartLineIcon}
      title="Analysis"
      description="State of charge over time, cycles and throughput, and depth of discharge. The history behind the single figure the gauge on this bank's home page reads — the largest gap in the model as it stands. Empty."
    />
  ),
});
