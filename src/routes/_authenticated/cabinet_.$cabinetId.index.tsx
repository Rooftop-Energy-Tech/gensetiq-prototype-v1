import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

import {CabinetHome} from '@/modules/cabinet/components/detail/CabinetHome';
import {useSubrackCabinet} from '@/modules/cabinet/data/cabinets';

/**
 * The cabinet home page — what a click from `Asset ▸ Cabinet` lands on.
 *
 * The parent route has already resolved and 404'd the id, so the lookup here cannot
 * fail. It is repeated rather than threaded down as loader data for the reason the
 * other three home pages repeat theirs: the parent renders only the rail, and a
 * route boundary should not carry an object it does not use.
 */
const CabinetHomeRoute = () => {
  const {cabinetId} = Route.useParams();
  const [now] = useState(() => Date.now());
  const cabinet = useSubrackCabinet(cabinetId, now);
  if (cabinet === undefined) return null;

  return <CabinetHome key={cabinetId} cabinet={cabinet} />;
};

export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId/')({
  component: CabinetHomeRoute,
});
