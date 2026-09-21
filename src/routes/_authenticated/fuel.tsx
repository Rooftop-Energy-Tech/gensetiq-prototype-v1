import {createFileRoute} from '@tanstack/react-router';

import {FuelPage} from '@/modules/fuel';

export const Route = createFileRoute('/_authenticated/fuel')({
  staticData: {crumb: 'Fuel'},
  component: FuelPage,
});
