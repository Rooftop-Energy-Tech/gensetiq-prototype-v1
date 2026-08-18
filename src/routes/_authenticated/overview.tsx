import {createFileRoute} from '@tanstack/react-router';

import {OverviewPage} from '@/modules/overview';

export const Route = createFileRoute('/_authenticated/overview')({
  staticData: {crumb: 'Overview'},
  component: OverviewPage,
});
