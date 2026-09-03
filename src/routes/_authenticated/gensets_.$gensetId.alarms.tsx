import {createFileRoute, useParams} from '@tanstack/react-router';

import {GensetAlarms} from '@/modules/genset/components/alarms/GensetAlarms';
import {gensetById} from '@/modules/genset/data/detail';

/**
 * The alarms tab — what this genset is carrying, and what has been done about it.
 *
 * No search params, for the same reason the service route beside it has none:
 * there is nothing here to select. The page is already split into standing and
 * cleared, which is the one division a filter would have offered, and a query
 * string over two short tables would be furniture.
 */
const GensetAlarmsRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});

  const genset = gensetById(gensetId);
  if (genset === undefined) return null;

  return <GensetAlarms key={gensetId} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/alarms')({
  component: GensetAlarmsRoute,
});
