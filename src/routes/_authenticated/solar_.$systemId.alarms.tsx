import {createFileRoute, useParams} from '@tanstack/react-router';

import {SystemAlarms} from '@/modules/solar/components/detail/SystemAlarms';

/**
 * The array's alarms — the device's where there is a device, and this app's own
 * arithmetic everywhere.
 *
 * ## Why the `isMonitored` gate went
 *
 * It sent the three uninstrumented solar hybrids to a placeholder whose own copy
 * admitted the problem: "the live conditions on the home page are this app's own
 * arithmetic; no device is reporting here". Those conditions are **rows**. They have
 * a name, a rule, a severity and a raised time, they are counted in the system's
 * metric strip, and `systemAlerts` needs no register to fire — nothing on a roof can
 * see that output stepped down in March or that a wash is 176 days overdue.
 *
 * So SBH-1495 and SWK-0559 carried one standing condition each and SWK-1163 two,
 * every one of them printed on the home page, while this tab said the feature was
 * coming. The gate was not protecting a reader from an empty page; it was hiding the
 * page's contents.
 *
 * What the three still lack is a **poll table**, and that is said where it belongs —
 * `SystemAlarms` prints the register denominator only when there is one, so an
 * uninstrumented array simply does not claim any.
 */
const SystemAlarmsRoute = () => {
  const {systemId} = useParams({from: '/_authenticated/solar_/$systemId'});

  return <SystemAlarms key={systemId} systemId={systemId} />;
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/alarms')({
  component: SystemAlarmsRoute,
});
