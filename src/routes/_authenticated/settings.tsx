import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/settings')({
  staticData: {crumb: 'Settings'},
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="Account, fleet and alerting preferences. Not designed yet."
    />
  ),
});
