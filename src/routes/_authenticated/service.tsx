import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {ServicePage} from '@/modules/service';
import {serviceSearchSchema} from '@/modules/service/types/view.type';
import type {ServiceSearch} from '@/modules/service/types/view.type';

const Service = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<ServiceSearch>) => {
    void navigate({
      search: (prev) => ({...prev, ...next}),
      // One history entry per keystroke otherwise — the gensets register's rule.
      replace: 'q' in next,
    });
  };

  return <ServicePage search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/service')({
  validateSearch: (search: Record<string, unknown>): ServiceSearch => serviceSearchSchema.parse(search),
  staticData: {crumb: 'Service'},
  component: Service,
});
