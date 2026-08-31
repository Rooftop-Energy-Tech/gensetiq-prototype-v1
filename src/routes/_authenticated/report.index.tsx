import {createFileRoute} from '@tanstack/react-router';

import {OverallReport} from '@/modules/report/overall';

/**
 * `/report` — what carried the load and what the plant saved, site by site.
 *
 * The page that used to be `/energy`, unchanged but for where it hangs. It is the
 * section's landing tab because it is the only one of the three that counts the
 * whole estate: solar and genset are that answer taken apart by plant.
 */
export const Route = createFileRoute('/_authenticated/report/')({
  staticData: {crumb: 'Overall'},
  component: OverallReport,
});
