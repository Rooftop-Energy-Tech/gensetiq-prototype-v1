import {createFileRoute} from '@tanstack/react-router';

import {SolarRoute} from '@/modules/solar';
import {solarSearchSchema} from '@/modules/solar/types/view.type';

/**
 * Generation against each array's design P50 — what used to live at `/solar`.
 *
 * It moved here when `/solar` became the array register, and the two are
 * deliberately separate destinations rather than tabs of one screen. This page is
 * a question about *yield*: is the estate's generation what the arrays were bought
 * on. The register next door is a question about *plant*: what is fitted, and how
 * is each unit. A reader arrives with one of those questions, never both.
 *
 * The module is still `@/modules/solar`; only the route moved. Renaming the module
 * would have touched a 30 kB file to change nothing a reader sees.
 */
export const Route = createFileRoute('/_authenticated/solar-report')({
  staticData: {crumb: 'Solar report'},
  validateSearch: solarSearchSchema,
  component: () => <SolarRoute search={Route.useSearch()} />,
});
