import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {SitesPage} from '@/modules/site';
import {siteSearchSchema} from '@/modules/site/types/view.type';
import type {SiteSearch} from '@/modules/site/types/view.type';

const Sites = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<SiteSearch>) => {
    void navigate({
      search: (previous) => ({...previous, ...next}),
      // Typing would otherwise push one history entry per keystroke — the same
      // call the fleet screen makes about its own search box.
      replace: true,
    });
  };

  return <SitesPage search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/sites')({
  validateSearch: (search: Record<string, unknown>): SiteSearch => siteSearchSchema.parse(search),
  staticData: {crumb: 'Sites'},
  component: Sites,
});
