import {createFileRoute, notFound, useNavigate} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {InverterPage} from '@/modules/solar/components/detail/inverter/InverterPage';
import {systemDetail} from '@/modules/solar/data/systemDetail';
import {systemAlerts} from '@/modules/solar/data/systemHealth';
import {solarSystem, useSolarSystem} from '@/modules/solar/data/systems';
import {inverterById} from '@/modules/solar/types/system.type';
import {sitePowerRole} from '@/modules/site/data/siteConfig';
import {inverterTraceSearchSchema} from '@/modules/solar/types/analysisView.type';
import type {InverterTraceSearch} from '@/modules/solar/types/analysisView.type';

/**
 * One inverter — `/solar/kdh-0431/inverters/kdh-0431-inv-01`.
 *
 * ## Why a route rather than an expanding row
 *
 * Because a box is a place. This app's rule is stated on the genset shell — *"a
 * tab is a place, and `/gensets/brf9540/runs` should be linkable and survive a
 * reload"* — and it applies harder here: the useful thing to send a colleague is
 * not "the mini-grid", it is *Inverter 4, the one with nine dark strings*. An
 * accordion on the system page could not be sent.
 *
 * It renders inside the system's shell, so the rail and the title stay put and the
 * breadcrumb reads `Solar / MG-012 | 1333 kWp / Inverter 4`. No row in the rail is
 * lit while you are here, which is correct — this is not one of the six, and the
 * rail deliberately does not list the boxes (see `SystemDetailShell`).
 *
 * The alerts are built here from the **system's** set and handed down, rather than
 * derived on the box. A rule like `string-out` is the app's arithmetic over the
 * system's monthly series and only then attributed to a box; deriving it from one
 * inverter would mean a second derivation of the same claim, which is the shape
 * every disagreement in this app has had.
 */
const InverterRoute = () => {
  const {systemId, inverterId} = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});
  const [now] = useState(() => Date.now());

  const system = useSolarSystem(systemId, now);
  const inverter = system === undefined ? undefined : inverterById(system, inverterId);
  const detail = system === undefined ? undefined : systemDetail(system, now, false);

  if (system === undefined || inverter === undefined || detail === undefined) {
    return <NotFound />;
  }

  return (
    <InverterPage
      key={inverter.id}
      system={system}
      inverter={inverter}
      alerts={systemAlerts(system, detail, now)}
      search={search}
      now={now}
      onSearchChange={(next: InverterTraceSearch) => {
        // Worth a Back. Swapping a reading or changing a window is how a reader
        // navigates this screen.
        void navigate({search: () => next, replace: false});
      }}
    />
  );
};

export const Route = createFileRoute(
  '/_authenticated/solar_/$systemId/inverters/$inverterId',
)({
  validateSearch: (search: Record<string, unknown>): InverterTraceSearch =>
    inverterTraceSearchSchema.parse(search),
  loader: ({params}): {crumb: string} => {
    const role = sitePowerRole(params.systemId);
    const system = solarSystem(params.systemId, {[params.systemId]: role});
    const inverter = system === undefined ? undefined : inverterById(system, params.inverterId);
    if (inverter === undefined) throw notFound();

    return {crumb: inverter.label};
  },
  component: InverterRoute,
});
