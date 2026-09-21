import {createFileRoute, useParams} from '@tanstack/react-router';

import {GensetAlarms} from '@/modules/genset/components/alarms/GensetAlarms';
import {gensetById} from '@/modules/genset/data/deployment';
import {fromSearchSchema} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * The alarms tab — what this genset is carrying, and what has been done about it.
 *
 * It carried the alerts band above the two tables until 2026-09-14, and with it the
 * chip selection that had been the home page's search state. Both are gone — see
 * `GensetAlarms` for why the band went — so this route has no state of its own left.
 * What it still has to do is let `from` through: a reader who walked in from a site
 * keeps that trail, and a zod schema that did not name the key would strip it and the
 * router would rewrite the URL without it.
 */
const GensetAlarmsRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});

  const genset = gensetById(gensetId);
  if (genset === undefined) return null;

  return <GensetAlarms key={gensetId} genset={genset} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/alarms')({
  validateSearch: (search: Record<string, unknown>): FromSearch =>
    fromSearchSchema.parse(search),
  component: GensetAlarmsRoute,
});
