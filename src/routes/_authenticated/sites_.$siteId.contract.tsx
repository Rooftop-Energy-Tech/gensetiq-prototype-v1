import {createFileRoute} from '@tanstack/react-router';
import {FileTextIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/sites_/$siteId/contract')({
  component: () => (
    <ComingSoon
      icon={FileTextIcon}
      title="Contract"
      description="The commercial side of the site: the SLA its availability is measured against, the rate its fuel is billed at, and the term. Not drawn in any frame — and the one section a genset has no counterpart for."
    />
  ),
});
