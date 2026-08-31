import {createFileRoute} from '@tanstack/react-router';

import {SolarReportRoute} from '@/modules/report/solar';
import {solarSearchSchema} from '@/modules/report/solar/types/view.type';

/**
 * `/report/solar` — generation against each array's design P50.
 *
 * It was `/solar-report`, and the qualifier is gone with the move: under a
 * section where everything is a report, `Solar` cannot be mistaken for the plant
 * register at `/solar` — which, now that the register has real systems and
 * inverters under it, is a collision worth more than it was when the old name was
 * chosen to avoid it.
 *
 * Still a separate screen from `Overall` rather than a band on it, for the reason
 * that split them in the first place: this page asks about *yield* — is the
 * portfolio making what it was bought on — and that figure moves for reasons that
 * have nothing to do with the diesel saving next door.
 */
export const Route = createFileRoute('/_authenticated/report/solar')({
  staticData: {crumb: 'Solar'},
  validateSearch: solarSearchSchema,
  component: () => <SolarReportRoute search={Route.useSearch()} />,
});
