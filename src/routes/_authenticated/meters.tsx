import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {MetersPage} from '@/modules/meter';
import {meterSearchSchema} from '@/modules/meter/types/view.type';
import type {MeterSearch} from '@/modules/meter/types/view.type';

const Meters = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<MeterSearch>) => {
    void navigate({
      search: (previous) => ({...previous, ...next}),
      // Typing would otherwise push one history entry per keystroke — the same call
      // the sites and fleet screens make about their own search boxes.
      replace: true,
    });
  };

  return <MetersPage search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/meters')({
  validateSearch: (search: Record<string, unknown>): MeterSearch =>
    meterSearchSchema.parse(search),
  staticData: {crumb: 'Meters'},
  component: Meters,
});
