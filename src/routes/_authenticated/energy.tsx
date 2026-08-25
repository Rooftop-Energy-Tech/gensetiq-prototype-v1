import {createFileRoute} from '@tanstack/react-router';

import {EnergyPage} from '@/modules/energy';

export const Route = createFileRoute('/_authenticated/energy')({
  staticData: {crumb: 'Energy'},
  component: EnergyPage,
});
