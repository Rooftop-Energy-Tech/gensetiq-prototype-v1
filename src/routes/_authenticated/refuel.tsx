import {createFileRoute} from '@tanstack/react-router';

import {RefuelPage} from '@/modules/refuel';

export const Route = createFileRoute('/_authenticated/refuel')({
  staticData: {crumb: 'Refuel'},
  component: RefuelPage,
});
