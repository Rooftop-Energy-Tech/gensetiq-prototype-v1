import {createFileRoute, notFound} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {CabinetDetailShell} from '@/modules/cabinet/components/detail/CabinetDetailShell';
import {cabinetForLoader, useSubrackCabinet} from '@/modules/cabinet/data/cabinets';
import {cabinetName} from '@/modules/cabinet/types/cabinet.type';
import {fromSearchSchema} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * Annotated rather than inferred, for the reason the other three detail routes give:
 * `Route`'s type depends on its `component`, the component reads loader data, and
 * inferring that data from the loader body closes the loop.
 */
type CabinetLoaderData = {crumb: string};

/**
 * One cabinet's pages: `/cabinet/sbh-1336`, `/cabinet/sbh-1336/alarms`, …
 *
 * ## Why there is no `/cabinet` register above this
 *
 * The other two singular sections — `/battery/$bankId` and `/solar/$systemId` —
 * carry a trailing underscore to un-nest from a register that exists at `/battery`
 * and `/solar`. This one keeps the underscore for consistency of naming and has no
 * such parent, because **one site on the estate has a cabinet worth a page**.
 *
 * A register of one row is not a register, and the alternative — sizing a rectifier
 * shelf from each site's load so all twenty-five could have one — is the guess
 * `monitoringUnit.ts` argues against at length: it would contradict the alarm rows
 * beside it, which are addresses on a device and not negotiable. So the section is
 * reached from a site's `Asset ▸ Cabinet` row, which is the only place a reader would
 * look for it, and the day a second gateway goes in the register becomes worth
 * building.
 *
 * ## Why the cabinet is resolved twice
 *
 * The **loader** resolves it once to 404 an uninstrumented site for the whole
 * section, so four children do not repeat the check, and to name the breadcrumb —
 * which `staticData` cannot do because the label depends on the params.
 *
 * The **component** resolves it again through `useSubrackCabinet`, which reads the
 * live power-role store. That is the half that matters while the page is open: the
 * role decides what `siteFeed` says is carrying, so flipping this site from a solar
 * hybrid to a diesel yard on its settings tab moves the work from the SSUs to the
 * rectifiers under the reader's eyes. The loader's copy is the door; the hook's is
 * the page.
 */
const CabinetDetailRoute = () => {
  const {cabinetId} = Route.useParams();
  // One clock for the whole section, so the dial, the badges and the module cards
  // cannot land either side of a minute boundary.
  const [now] = useState(() => Date.now());
  const cabinet = useSubrackCabinet(cabinetId, now);

  // `notFound()` cannot be thrown from a render, so the not-found body is rendered
  // directly. Reachable in one way: a site's monitoring unit going away under the
  // page, which no reader can do today but a fixture edit can.
  if (cabinet === undefined) return <NotFound />;

  return <CabinetDetailShell cabinet={cabinet} />;
};

export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId')({
  loader: ({params}): CabinetLoaderData => {
    const cabinet = cabinetForLoader(params.cabinetId, Date.now());
    if (cabinet === undefined) throw notFound();

    return {crumb: cabinetName(cabinet)};
  },
  // Accepts `from` so an asset opened at a site crumbs back to that site rather
  // than to its register — see `fromSearch.type.ts`. Declared on the section route
  // so every tab under it carries the param without repeating the schema.
  //
  // It changes least here of the four: this parent is already the site register, so
  // `from` only sharpens `Sites` into the one site the reader came from.
  validateSearch: (search: Record<string, unknown>): FromSearch =>
    fromSearchSchema.parse(search),
  // The site, not a register — there is none. This is the only detail section in the
  // app whose breadcrumb parent is the thing it stands on rather than a list of its
  // own kind, which is exactly what "one site has one" means.
  staticData: {crumbParent: {label: 'Sites', to: '/sites'}},
  component: CabinetDetailRoute,
});
