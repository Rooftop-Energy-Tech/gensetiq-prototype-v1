import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The design assumptions this estate is judged against — the P50 yield, the P90 band, and the performance ratio. Today they are constants in hybrid.ts; this is where they would become editable. Empty."
    />
  ),
});
