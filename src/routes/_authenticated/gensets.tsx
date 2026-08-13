import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {GensetsPage} from '@/modules/genset';
import {gensetSearchSchema} from '@/modules/genset/types/view.type';
import type {GensetSearch} from '@/modules/genset/types/view.type';

const Gensets = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<GensetSearch>) => {
    void navigate({
      search: (prev) => ({...prev, ...next}),
      // Typing in the search box would otherwise push one history entry per
      // keystroke. Every other change — switching view, picking a genset — is a
      // deliberate move worth a Back.
      replace: 'q' in next,
    });
  };

  return <GensetsPage search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/gensets')({
  validateSearch: (search: Record<string, unknown>): GensetSearch =>
    gensetSearchSchema.parse(search),
  staticData: {crumb: 'Gensets'},
  component: Gensets,
});
