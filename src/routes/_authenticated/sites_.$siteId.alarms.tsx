import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/sites_/$siteId/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Site alarms"
      description="Every active threshold across this site's gensets, pooled into one list. Named in the design's tab strip but not drawn — each genset's own alarms are on its home page."
    />
  ),
});
