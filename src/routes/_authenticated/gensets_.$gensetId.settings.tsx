import {createFileRoute, useParams} from '@tanstack/react-router';

import {GensetSettings} from '@/modules/genset/components/settings/GensetSettings';
import {gensetById} from '@/modules/genset/data/detail';

/**
 * The settings tab — what this genset's fuel leakage alarm is watching, and where
 * its line sits.
 *
 * No search params, for the reason the service route beside it gives: there is
 * nothing here to select. A setting is a decision, not a view, and putting one in a
 * query string would make it look shareable and reloadable when it is neither.
 */
const GensetSettingsRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});

  const genset = gensetById(gensetId);
  if (genset === undefined) return null;

  // `key` for the reason the sibling routes use one: the threshold field holds
  // draft state, and moving between two units must not carry one machine's
  // half-typed percentage onto the other's page.
  return <GensetSettings key={gensetId} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/settings')({
  component: GensetSettingsRoute,
});
