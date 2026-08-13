import {createFileRoute} from '@tanstack/react-router';
import {FileTextIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/sites_/$siteId/contract')({
  component: () => (
    <ComingSoon
      icon={FileTextIcon}
      title="Contract"
      description="The commercial side of the site: the SLA its availability is measured against, the rate its fuel is billed at, and the term. Named in the design's tab strip but not drawn — and the one tab a genset has no counterpart for."
    />
  ),
});
