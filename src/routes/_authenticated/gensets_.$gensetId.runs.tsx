import {createFileRoute, useNavigate, useParams} from '@tanstack/react-router';

import {GensetRuns} from '@/modules/genset/components/runs/GensetRuns';
import {gensetById} from '@/modules/genset/data/detail';
import {runsSearchSchema} from '@/modules/genset/types/runsView.type';
import type {RunsSearch} from '@/modules/genset/types/runsView.type';

/**
 * The runs tab — every run this genset has closed, and the open one at the head.
 *
 * Same shape as the analysis route beside it: the parent has already resolved and
 * 404'd the id, and the whole selection lives in the query string. That matters
 * more here than next door, because the range on this page is the range somebody
 * exports — so the link and the file describe the same period.
 *
 *   /gensets/brf9540/runs?window=all
 *   /gensets/brf9540/runs?from=2026-07-01&to=2026-07-31
 */
const GensetRunsRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const genset = gensetById(gensetId);
  if (genset === undefined) return null;

  return (
    // `key` for the reason the sibling routes use one: the page holds a `now` in
    // state, and moving between two units must not measure the second one's window
    // against the first one's clock reading.
    <GensetRuns
      key={gensetId}
      genset={genset}
      search={search}
      onSearchChange={(next: RunsSearch) => {
        // Worth a Back. Changing the window is how a reader works this screen, and
        // the browser's own back button is what they will reach for to undo it.
        void navigate({search: () => next, replace: false});
      }}
    />
  );
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/runs')({
  validateSearch: (search: Record<string, unknown>): RunsSearch =>
    runsSearchSchema.parse(search),
  component: GensetRunsRoute,
});
