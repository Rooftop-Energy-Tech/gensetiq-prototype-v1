import {createFileRoute, notFound} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {SystemDetailShell} from '@/modules/solar/components/detail/SystemDetailShell';
import {solarSystem, useSolarSystem} from '@/modules/solar/data/systems';
import {systemName} from '@/modules/solar/types/system.type';
import {sitePowerRole} from '@/modules/site/data/siteConfig';

/**
 * Annotated rather than inferred, for the reason the genset route gives: `Route`'s
 * type depends on its `component`, the component reads loader data, and inferring
 * that data from the loader body closes the loop.
 */
type SystemLoaderData = {crumb: string};

/**
 * One solar system's pages: `/solar/kdh-0431` and the five sections beside it.
 *
 * The trailing underscore on `solar_` un-nests this from `/solar`, which is the
 * register. Without it TanStack renders the detail page inside the register, and
 * the register has no `<Outlet />`, so nothing appears at all.
 *
 * ## Why the system is resolved twice, and why that is not a mistake
 *
 * The **loader** resolves it once to 404 an unknown or non-solar id for the whole
 * section, so seven children do not repeat the check, and to name the breadcrumb
 * — which `staticData` cannot do because the label depends on the params.
 *
 * The **component** resolves it again through `useSolarSystem`, which reads the
 * live power-role store. That is the half that matters while the page is open: a
 * reader can flip this site away from `SOLAR_HYBRID` on its settings tab, and a
 * page that went on drawing a system which no longer exists — because a loader
 * ran before the change — would be the most confusing state in the app. The
 * loader's copy is the door; the hook's is the page.
 */
const SystemDetailRoute = () => {
  const {systemId} = Route.useParams();
  // One clock for the whole section. See `useSolarSystems` for why it is held
  // rather than defaulted.
  const [now] = useState(() => Date.now());
  const system = useSolarSystem(systemId, now);

  // The role was changed out from under the page. `notFound()` cannot be thrown
  // from a render, so the not-found body is rendered directly.
  if (system === undefined) return <NotFound />;

  return <SystemDetailShell system={system} />;
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId')({
  loader: ({params}): SystemLoaderData => {
    // The store's own reader rather than the hook: a loader is not a component.
    const role = sitePowerRole(params.systemId);
    const system = solarSystem(params.systemId, {[params.systemId]: role});
    if (system === undefined) throw notFound();

    return {crumb: systemName(system)};
  },
  staticData: {crumbParent: {label: 'Solar', to: '/solar'}},
  component: SystemDetailRoute,
});
