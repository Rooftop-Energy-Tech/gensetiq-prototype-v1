import {createFileRoute, useParams} from '@tanstack/react-router';

import {GensetHome} from '@/modules/genset/components/detail/GensetHome';
import {gensetById} from '@/modules/genset/data/deployment';
import {gensetDetail} from '@/modules/genset/data/detail';

/**
 * The genset home page — the tab a click from the fleet list lands on.
 *
 * The parent route has already resolved and 404'd the id, so the lookups here
 * cannot fail; they are repeated rather than threaded down through loader data
 * because the parent only needs the fleet row for its header, and the whole
 * `GensetDetail` is a much larger object to carry through a route boundary that
 * doesn't use it.
 *
 * No search params of its own. It had two — `severity` and `tag`, the alerts
 * section's chip selection — and they went to the Alarms tab with the band they
 * filtered. `from` is still accepted, on the section route above, so a set opened
 * at a site crumbs back to that site.
 */
const GensetHomeRoute = () => {
  // Read off the parent explicitly: `$gensetId` belongs to the layout route, and
  // this index route's own params are empty.
  const {gensetId} = useParams({from: '/_authenticated/gensets_/$gensetId'});

  const genset = gensetById(gensetId);
  const detail = gensetDetail(gensetId);
  if (genset === undefined || detail === undefined) return null;

  // `key` so a different genset is a different component instance. `GensetHome`
  // holds the control mode in `useState`, and moving between two units' pages reuses
  // this instance — so without it, unit B's page opens showing unit A's mode. A
  // control mode is a fact about one machine's controller; it must not follow the
  // reader to the next machine.
  return <GensetHome key={gensetId} genset={genset} detail={detail} />;
};

export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/')({
  component: GensetHomeRoute,
});
