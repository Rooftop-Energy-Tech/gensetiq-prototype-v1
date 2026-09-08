import {createFileRoute, useParams} from '@tanstack/react-router';

import {CabinetAlarms} from '@/modules/cabinet/components/detail/CabinetAlarms';

/**
 * The cabinet's Alarms tab.
 *
 * **No `isMonitored` gate**, unlike the bank's and the array's. Those two exist at
 * sites with no monitoring unit and have to say so; a cabinet only has a page where
 * the unit does, so the parent route has already 404'd every site that would have
 * needed the placeholder. There is no state in which this tab has nothing to show.
 */
const CabinetAlarmsRoute = () => {
  const {cabinetId} = useParams({from: '/_authenticated/cabinet_/$cabinetId'});

  return <CabinetAlarms key={cabinetId} cabinetId={cabinetId} />;
};

export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId/alarms')({
  component: CabinetAlarmsRoute,
});
