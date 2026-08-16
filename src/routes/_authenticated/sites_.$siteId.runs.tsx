import {createFileRoute, useNavigate, useParams} from '@tanstack/react-router';

import {SiteRuns} from '@/modules/site/components/SiteRuns';
import {useSiteSummary} from '@/modules/site/data/sites';
import {runsSearchSchema} from '@/modules/genset/types/runsView.type';
import type {RunsSearch} from '@/modules/genset/types/runsView.type';

/**
 * The site's runs tab — every set standing here, merged into one log.
 *
 * The summary comes live from the store rather than from loader data, matching the
 * parent route: sets can be attached and detached, and a loader runs once on
 * navigation, so a log built from it would keep listing a machine after the yard
 * had let it go.
 */
const SiteRunsRoute = () => {
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const summary = useSiteSummary(siteId);
  if (summary === undefined) return null;

  return (
    <SiteRuns
      key={siteId}
      summary={summary}
      search={search}
      onSearchChange={(next: RunsSearch) => {
        void navigate({search: () => next, replace: false});
      }}
    />
  );
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/runs')({
  validateSearch: (search: Record<string, unknown>): RunsSearch =>
    runsSearchSchema.parse(search),
  component: SiteRunsRoute,
});
