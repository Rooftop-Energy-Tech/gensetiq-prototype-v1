import {createFileRoute, useParams} from '@tanstack/react-router';

import {CabinetAlarms} from '@/modules/cabinet/components/detail/CabinetAlarms';

/**
 * The cabinet's Alarms tab.
 *
 * **No gate**, the same as the bank's and the array's and now for the same reason.
 * While the cabinet existed only at the instrumented site this route could not have
 * an empty state — the parent had already 404'd every site without a unit. Extending
 * the cabinet to every solar hybrid ended that: three of the four have no unit, so
 * this tab now has the two-zeros problem the other assets have, and `CabinetAlarms`
 * answers it there rather than here — **nothing standing** where a unit is watching,
 * **nothing watching** where none is.
 */
const CabinetAlarmsRoute = () => {
  const {cabinetId} = useParams({from: '/_authenticated/cabinet_/$cabinetId'});

  return <CabinetAlarms key={cabinetId} cabinetId={cabinetId} />;
};

export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId/alarms')({
  component: CabinetAlarmsRoute,
});
