import {createFileRoute, useParams} from '@tanstack/react-router';

import {GensetService} from '@/modules/genset/components/service/GensetService';
import {gensetById} from '@/modules/genset/data/detail';

/**
 * The service tab — whether this genset is due, and every service on record.
 *
 * No search params, unlike the runs and analysis routes beside it. There is
 * nothing here to select: the tab shows one genset's whole history, and a filter
 * over a list that is usually three rows long would be furniture. If a fleet-wide
 * service view ever lands, *that* is the screen with state worth putting in a URL.
 */
const GensetServiceRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});

  const genset = gensetById(gensetId);
  if (genset === undefined) return null;

  // `key` for the reason the sibling routes use one: the log dialog holds form
  // state, and moving between two units must not carry one machine's half-typed
  // hour reading onto the other's page.
  return <GensetService key={gensetId} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/service')({
  component: GensetServiceRoute,
});
