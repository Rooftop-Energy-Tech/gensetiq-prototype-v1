import {createFileRoute, useParams} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';
import {SystemAlarms} from '@/modules/solar/components/detail/SystemAlarms';
import {isMonitored} from '@/modules/site/data/monitoringUnit';

/**
 * The array's alarms where a device is reporting them, and a placeholder where none
 * is.
 *
 * What this tab's earlier placeholder asked for was history, acknowledgement, who
 * saw it and when, and thresholds as editable lines. The first three are here now
 * at the site that has a monitoring unit; the fourth is not, and cannot be, because
 * these rows have no thresholds — the setpoints live in configuration registers the
 * poll set does not read. See `SystemAlarms` on why that makes this page a
 * different claim from the health band on the system's home page.
 */
const SystemAlarmsRoute = () => {
  const {systemId} = useParams({from: '/_authenticated/solar_/$systemId'});

  if (!isMonitored(systemId)) {
    return (
      <ComingSoon
        icon={BellIcon}
        title="Alarms"
        description="This system's alarm history — raised, acknowledged, cleared and by whom. The live conditions on the home page are this app's own arithmetic; no device is reporting here. SBH-1336 has a monitoring unit, and four of its registers watch that array's strings."
      />
    );
  }

  return <SystemAlarms key={systemId} systemId={systemId} />;
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/alarms')({
  component: SystemAlarmsRoute,
});
