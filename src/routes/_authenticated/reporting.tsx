import {createFileRoute} from '@tanstack/react-router';

import {ReportingPage} from '@/modules/reporting';

export const Route = createFileRoute('/_authenticated/reporting')({
  staticData: {crumb: 'Reporting'},
  component: ReportingPage,
});
