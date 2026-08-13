import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="Per-genset configuration — alert thresholds, tags, who gets notified. Named in the design's tab strip but not drawn."
    />
  ),
});
