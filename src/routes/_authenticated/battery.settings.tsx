import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/battery/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The bank's operating envelope — autonomy target, depth-of-discharge limit, and the round-trip efficiency the energy model assumes. Today a constant in hybrid.ts; this is where it would become a per-site figure. Empty."
    />
  ),
});
