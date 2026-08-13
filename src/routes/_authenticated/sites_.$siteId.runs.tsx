import {createFileRoute} from '@tanstack/react-router';
import {ListIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/sites_/$siteId/runs')({
  component: () => (
    <ComingSoon
      icon={ListIcon}
      title="Site runs"
      description="Every outage this site has ridden through, and which of its gensets carried it. Named in the design's tab strip but not drawn."
    />
  ),
});
