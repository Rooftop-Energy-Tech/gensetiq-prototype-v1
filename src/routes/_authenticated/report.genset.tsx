import {createFileRoute} from '@tanstack/react-router';

import {GensetReport} from '@/modules/report/genset';

/**
 * `/report/genset` — the engines, over the same thirty days.
 *
 * The tab this section was missing. `Overall` costs diesel as a *saving* and
 * `Solar` reports the arrays against their design, and between them the engines
 * appeared only as a litre count in somebody else's argument. What a fleet is
 * actually read down — hours, what each set burns per kilowatt-hour at the
 * loading it holds, diesel that left the tank without reaching an engine, and
 * what is falling due — was legible one machine at a time and nowhere in
 * aggregate.
 */
export const Route = createFileRoute('/_authenticated/report/genset')({
  staticData: {crumb: 'Genset'},
  component: GensetReport,
});
