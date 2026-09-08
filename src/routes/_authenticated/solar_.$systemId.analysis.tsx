import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {SystemAnalysis} from '@/modules/solar/components/detail/SystemAnalysis';
import {systemDetail} from '@/modules/solar/data/systemDetail';
import {useSolarSystem} from '@/modules/solar/data/systems';
import {systemAnalysisSearchSchema} from '@/modules/solar/types/analysisView.type';
import type {SystemAnalysisSearch} from '@/modules/solar/types/analysisView.type';
import {fromSearchSchema, keepFrom} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * The analysis tab — `/solar/kdh-0431/analysis`.
 *
 * Same shape as the home route next door, and the window lives in the query
 * string, so "look at the July dip" is a link:
 *
 * ```
 * /solar/kdh-0431/analysis?range=30d
 * /solar/kdh-0431/analysis?range=custom&from=2026-03-01&to=2026-06-30
 * ```
 */
const SystemAnalysisRoute = () => {
  const {systemId} = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});
  const [now] = useState(() => Date.now());

  const system = useSolarSystem(systemId, now);
  const detail = system === undefined ? undefined : systemDetail(system, now, false);

  if (system === undefined || detail === undefined) return <NotFound />;

  return (
    <SystemAnalysis
      // `key` for the reason the genset analysis route uses one: the page is
      // measured from a `now` held in state, and moving between two systems must
      // not reuse the first one's clock reading for the second one's window.
      key={systemId}
      system={system}
      detail={detail}
      search={search}
      now={now}
      onSearchChange={(next: SystemAnalysisSearch) => {
        // Worth a Back. Changing the window is how a reader navigates this screen,
        // and the browser's own back button is the control they will reach for to
        // undo it.
        void navigate({search: (previous: FromSearch) => ({...next, ...keepFrom(previous)}), replace: false});
      }}
    />
  );
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/analysis')({
  // The tab's own params, plus `from` passed straight through. Without the second
  // half a zod schema strips it as an unknown key and the router rewrites the URL
  // without it, so a reader who walked in from a site loses that trail on the one
  // tab that happens to filter — see `fromSearch.type.ts`.
  validateSearch: (search: Record<string, unknown>): SystemAnalysisSearch & FromSearch => ({
    ...systemAnalysisSearchSchema.parse(search),
    ...fromSearchSchema.parse(search),
  }),
  component: SystemAnalysisRoute,
});
