import {createFileRoute, useNavigate, useParams} from '@tanstack/react-router';

import {GensetAnalysis} from '@/modules/genset/components/detail/analysis/GensetAnalysis';
import {gensetById} from '@/modules/genset/data/deployment';
import {gensetDetail} from '@/modules/genset/data/detail';
import {analysisSearchSchema} from '@/modules/genset/types/analysisView.type';
import type {AnalysisSearch} from '@/modules/genset/types/analysisView.type';
import {fromSearchSchema, keepFrom} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * The analysis tab — the genset's readings over time.
 *
 * Same shape as the home route next door: the parent has already resolved and
 * 404'd the id, and the whole selection lives in the query string so a chart
 * showing a specific pair of readings over a specific run is a link.
 */
const GensetAnalysisRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const genset = gensetById(gensetId);
  const detail = gensetDetail(gensetId);
  if (genset === undefined || detail === undefined) return null;

  return (
    // `key` for the same reason the home route uses one: the page holds a `now`
    // in state, and moving between two units must not reuse the first one's
    // clock reading for the second one's window.
    <GensetAnalysis
      key={gensetId}
      genset={genset}
      detail={detail}
      search={search}
      onSearchChange={(next: AnalysisSearch) => {
        // Worth a Back. Swapping a reading or stepping into a run is how the
        // reader navigates this screen, and the browser's own back button is the
        // one control they will reach for to undo it.
        void navigate({search: (previous: FromSearch) => ({...next, ...keepFrom(previous)}), replace: false});
      }}
    />
  );
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/analysis')({
  // The tab's own params, plus `from` passed straight through. Without the second
  // half a zod schema strips it as an unknown key and the router rewrites the URL
  // without it, so a reader who walked in from a site loses that trail on the one
  // tab that happens to filter — see `fromSearch.type.ts`.
  validateSearch: (search: Record<string, unknown>): AnalysisSearch & FromSearch => ({
    ...analysisSearchSchema.parse(search),
    ...fromSearchSchema.parse(search),
  }),
  component: GensetAnalysisRoute,
});
