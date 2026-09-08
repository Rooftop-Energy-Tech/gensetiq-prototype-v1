import {createFileRoute, useParams} from '@tanstack/react-router';
import {useState} from 'react';

import {SubrackRack} from '@/modules/cabinet/components/detail/SubrackRack';
import {useSubrackCabinet} from '@/modules/cabinet/data/cabinets';

/**
 * The Devices tab: the shelf, module by module.
 *
 * The one `Devices` tab in this app with content rather than a placeholder, and the
 * reason is that a cabinet's devices are the only ones the monitoring unit counts. A
 * bank's `Devices` tab would need a rack layout and a commissioning record, and an
 * array's a module make and a string map; neither is in the model. A shelf is
 * `rectifiers` and `ssus`, both read off the unit, so there is a real inventory to
 * draw.
 *
 * It is **the same rack the home page draws**, not a fuller version of it. Two
 * renderings of one shelf is the drift this app spends most of its comments avoiding,
 * and there is nothing a reader would want here that the cards do not already carry.
 * What this tab adds is a place to *look* for it: `Asset ▸ Cabinet ▸ Devices` is
 * where somebody goes to ask what is plugged in, and finding it there rather than
 * having to scroll a home page is the whole of the difference.
 */
const CabinetDevicesRoute = () => {
  const {cabinetId} = useParams({from: '/_authenticated/cabinet_/$cabinetId'});
  const [now] = useState(() => Date.now());
  const cabinet = useSubrackCabinet(cabinetId, now);
  if (cabinet === undefined) return null;

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <SubrackRack key={cabinetId} cabinet={cabinet} />
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId/equipment')({
  component: CabinetDevicesRoute,
});
