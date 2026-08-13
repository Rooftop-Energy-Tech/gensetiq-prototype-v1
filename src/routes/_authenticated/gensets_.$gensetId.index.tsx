import {createFileRoute, useNavigate, useParams} from '@tanstack/react-router';

import {GensetHome} from '@/modules/genset/components/detail/GensetHome';
import {gensetById, gensetDetail} from '@/modules/genset/data/detail';
import {
  alertFocus,
  alertFocusSearch,
  gensetHomeSearchSchema,
} from '@/modules/genset/types/detailView.type';
import type {AlertFocus, GensetHomeSearch} from '@/modules/genset/types/detailView.type';

/**
 * The genset home page — the tab a click from the fleet list lands on.
 *
 * The parent route has already resolved and 404'd the id, so the lookups here
 * cannot fail; they are repeated rather than threaded down through loader data
 * because the parent only needs the fleet row and the online flag, and the whole
 * `GensetDetail` is a much larger object to carry through a route boundary that
 * doesn't use it.
 */
const GensetHomeRoute = () => {
  // Read off the parent explicitly: `$gensetId` belongs to the layout route, and
  // this index route's own params are empty.
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const genset = gensetById(gensetId);
  const detail = gensetDetail(gensetId);
  if (genset === undefined || detail === undefined) return null;

  const handleFocusChange = (focus: AlertFocus) => {
    void navigate({
      search: (previous: GensetHomeSearch) => ({...previous, ...alertFocusSearch(focus)}),
      // Selecting a chip is a deliberate move and worth a Back — it is how a
      // reader steps out of a filter without leaving the genset.
      replace: false,
    });
  };

  return (
    <GensetHome
      genset={genset}
      detail={detail}
      focus={alertFocus(search)}
      onFocusChange={handleFocusChange}
    />
  );
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/')({
  validateSearch: (search: Record<string, unknown>): GensetHomeSearch =>
    gensetHomeSearchSchema.parse(search),
  component: GensetHomeRoute,
});
