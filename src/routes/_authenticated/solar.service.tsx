import {createFileRoute} from '@tanstack/react-router';
import {BrushCleaningIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/service')({
  component: () => (
    <ComingSoon
      icon={BrushCleaningIcon}
      title="Service"
      description="Washing and inspection: when each array was last cleaned, when it is next due, and what the soiling loss between visits is costing in diesel. Empty."
    />
  ),
});
