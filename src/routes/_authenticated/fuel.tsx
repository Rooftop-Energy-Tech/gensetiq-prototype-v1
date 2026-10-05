import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {FuelPage, fuelTabLabel} from '@/modules/fuel';
import type {FuelView} from '@/modules/fuel';

type FuelSearch = {view?: FuelView; truck?: string};

const Fuel = () => {
  const {view, truck} = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  return (
    <FuelPage
      view={view ?? 'depots'}
      // `Depots` is the default and leaves the URL bare, so the page's plain address
      // is still `/fuel`.
      onViewChange={(next) =>
        void navigate({search: {view: next === 'depots' ? undefined : next}, replace: true})
      }
      truckId={truck}
      // Opening a truck pushes, so Back closes its panel; closing it replaces, so
      // Back after closing does not reopen it.
      onTruckChange={(next) =>
        void navigate({search: (prev) => ({...prev, truck: next}), replace: next === undefined})
      }
    />
  );
};

export const Route = createFileRoute('/_authenticated/fuel')({
  // Anything but `deliveries`, `trucks` or `truck-log` is the depot tab — including `trucks` on
  // an estate with none, which `FuelPage` resolves, since only it knows whether
  // trucks exist. A `truck` only means something on the two truck tabs, and an
  // unknown one opens nothing: on Trucks it is the open panel, on Truck log the
  // truck the log opens searched to — the panel's `View in Truck log` link.
  validateSearch: (search: Record<string, unknown>): FuelSearch =>
    search.view === 'trucks' || search.view === 'truck-log'
      ? {view: search.view, ...(typeof search.truck === 'string' ? {truck: search.truck} : {})}
      : search.view === 'deliveries'
        ? {view: 'deliveries'}
        : {},
  // `Fuel / Genset fills`: the tab is the query string, so the crumb reads it there.
  staticData: {crumb: 'Fuel', crumbTab: (search) => fuelTabLabel(search.view)},
  component: Fuel,
});
