import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {SystemHome} from '@/modules/solar/components/detail/SystemHome';
import {systemDetail} from '@/modules/solar/data/systemDetail';
import {useSolarSystem} from '@/modules/solar/data/systems';

/**
 * The system's home page — `/solar/kdh-0431`.
 *
 * The system is resolved here as well as in the parent shell, the way each genset
 * tab re-resolves its own machine. The parent has already 404'd an unknown id, so
 * this lookup cannot fail on a first render; it can only come back empty if the
 * site's power role is changed away from `SOLAR_HYBRID` while the page is open,
 * which is what the `NotFound` below is for.
 *
 * `now` is held here rather than inside `SystemHome`, because the detail is built
 * outside the component and the page's two halves must be measured from one
 * instant: a header saying the system was heard from four minutes ago over a
 * curve drawn to a different "now" is a page arguing with itself.
 */
const SystemHomeRoute = () => {
  const {systemId} = Route.useParams();
  const [now] = useState(() => Date.now());
  const system = useSolarSystem(systemId, now);
  const detail = system === undefined ? undefined : systemDetail(system, now);

  if (system === undefined || detail === undefined) return <NotFound />;

  // `key` for the reason the genset home route uses one: this page holds a note
  // draft in state, and moving between two systems must not carry the first
  // one's over to the second.
  return <SystemHome key={systemId} system={system} detail={detail} now={now} />;
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/')({
  component: SystemHomeRoute,
});
