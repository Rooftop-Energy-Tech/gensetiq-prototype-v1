import {createFileRoute} from '@tanstack/react-router';
import {SunMediumIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

export const Route = createFileRoute('/_authenticated/solar/')({
  component: () => (
    <ComingSoon
      icon={SunMediumIcon}
      title="Solar"
      description="The array register — a row per array, the way /gensets is a row per machine. Site, nameplate kWp, what it is generating now, and how it is doing against its own design P50. Empty until the columns are decided."
    />
  ),
});
