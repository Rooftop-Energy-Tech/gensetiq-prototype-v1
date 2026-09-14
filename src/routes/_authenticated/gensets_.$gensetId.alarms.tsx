import {createFileRoute, useNavigate, useParams} from '@tanstack/react-router';

import {GensetAlarms} from '@/modules/genset/components/alarms/GensetAlarms';
import {gensetById, gensetDetail} from '@/modules/genset/data/detail';
import {
  alertFocus,
  alertFocusSearch,
  gensetAlarmsSearchSchema,
} from '@/modules/genset/types/detailView.type';
import type {AlertFocus, GensetAlarmsSearch} from '@/modules/genset/types/detailView.type';
import {fromSearchSchema} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * The alarms tab — what this genset is carrying, and what has been done about it.
 *
 * It now carries the alerts band as well as the two tables, so the chip selection
 * that used to be the home page's search state is this route's. The reason it is in
 * the URL at all has not changed: a link to a genset with its coolant readings
 * already open is the useful thing to paste into a message, and Back should step
 * out of a filter rather than off the page.
 */
const GensetAlarmsRoute = () => {
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const genset = gensetById(gensetId);
  const detail = gensetDetail(gensetId);
  if (genset === undefined || detail === undefined) return null;

  const handleFocusChange = (focus: AlertFocus) => {
    void navigate({
      search: (previous: GensetAlarmsSearch) => ({...previous, ...alertFocusSearch(focus)}),
      // Selecting a chip is a deliberate move and worth a Back — it is how a
      // reader steps out of a filter without leaving the genset.
      replace: false,
    });
  };

  return (
    <GensetAlarms
      key={gensetId}
      genset={genset}
      detail={detail}
      focus={alertFocus(search)}
      onFocusChange={handleFocusChange}
    />
  );
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/alarms')({
  // The tab's own params, plus `from` passed straight through. Without the second
  // half a zod schema strips it as an unknown key and the router rewrites the URL
  // without it, so a reader who walked in from a site loses that trail on the one
  // tab that happens to filter — see `fromSearch.type.ts`.
  validateSearch: (search: Record<string, unknown>): GensetAlarmsSearch & FromSearch => ({
    ...gensetAlarmsSearchSchema.parse(search),
    ...fromSearchSchema.parse(search),
  }),
  component: GensetAlarmsRoute,
});
