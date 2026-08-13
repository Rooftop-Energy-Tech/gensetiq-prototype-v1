import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/sites_/$siteId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Site settings"
      description="Which gensets are installed here, how the changeover is configured, and who gets called out. Named in the design's tab strip but not drawn."
    />
  ),
});
