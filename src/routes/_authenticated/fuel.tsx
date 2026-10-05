import {createFileRoute, redirect, useNavigate} from '@tanstack/react-router';

import {FuelPage, fuelTabLabel} from '@/modules/fuel';
import {DEPOTS} from '@/modules/fuel/data/depots';
import type {FuelView} from '@/modules/fuel';

/**
 * `depot` is the History table's depot filter (Jeff, 2026-10-05), in the URL so a
 * depot page's `See all … in History` opens the tab already filtered to that yard.
 * Kept only on History, and only for a depot this estate has.
 */
type FuelSearch = {view?: FuelView; depot?: string};

const isDepot = (value: unknown): value is string =>
  typeof value === 'string' && DEPOTS.some((depot) => depot.id === value);

const Fuel = () => {
  const {view, depot} = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  return (
    <FuelPage
      view={view ?? 'depots'}
      depotId={depot}
      onDepotChange={(next) => void navigate({search: (prev) => ({...prev, depot: next}), replace: true})}
      // `Depots` is the default and leaves the URL bare, so the page's plain address
      // is still `/fuel`.
      onViewChange={(next) =>
        void navigate({search: {view: next === 'depots' ? undefined : next}, replace: true})
      }
    />
  );
};

export const Route = createFileRoute('/_authenticated/fuel')({
  // Anything but `history` is the depot tab — including an old `view=trucks` or
  // `view=truck-log` link, whose tabs went with the trucks (Jeff, 2026-10-05).
  validateSearch: (search: Record<string, unknown>): FuelSearch =>
    search.view === 'history' ? {view: 'history', ...(isDepot(search.depot) ? {depot: search.depot} : {})} : {},
  // And the address says so: a `view` that resolves to Depots — `?view=depots`, or
  // a truck tab's — is dropped from the URL, so the rail's *Depot tanks*, which
  // matches a bare `/fuel`, is lit on it (Jeff, 2026-10-05). `validateSearch` alone
  // only cleans what the page reads; the URL keeps the raw query. An old
  // `?view=deliveries` link, the tab's address until it became History
  // (Jeff, 2026-10-05), goes to History.
  beforeLoad: ({location}) => {
    const {view, depot} = location.search as {view?: unknown; depot?: unknown};
    if (view === 'deliveries') throw redirect({to: '/fuel', search: {view: 'history'}, replace: true});
    if (view !== undefined && view !== 'history') throw redirect({to: '/fuel', search: {}, replace: true});
    // A depot filter off History, or for a yard this estate does not have, is dropped.
    if (depot !== undefined && (view !== 'history' || !isDepot(depot))) {
      throw redirect({to: '/fuel', search: view === 'history' ? {view: 'history'} : {}, replace: true});
    }
  },
  // `Fuel / History`: the tab is the query string, so the crumb reads it there.
  staticData: {crumb: 'Fuel', crumbTab: (search) => fuelTabLabel(search.view)},
  component: Fuel,
});
