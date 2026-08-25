import {createFileRoute} from '@tanstack/react-router';

import {SolarRoute} from '@/modules/solar';
import {solarSearchSchema} from '@/modules/solar/types/view.type';

export const Route = createFileRoute('/_authenticated/solar')({
  staticData: {crumb: 'Solar'},
  validateSearch: solarSearchSchema,
  component: () => <SolarRoute search={Route.useSearch()} />,
});
