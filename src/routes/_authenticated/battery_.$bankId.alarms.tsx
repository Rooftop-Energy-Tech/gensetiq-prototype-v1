import {createFileRoute, useParams} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';
import {BankAlarms} from '@/modules/battery/components/detail/BankAlarms';
import {isMonitored} from '@/modules/site/data/monitoringUnit';

/**
 * A bank raises alarms where something is watching it, and a placeholder where
 * nothing is.
 *
 * The split is the estate's own shape rather than an unfinished page: every other
 * figure here is derived from a load and a hash, which is honest for a site nobody
 * has visited, and a poll table is not derivable. So the twenty-four sites with no
 * monitoring unit keep the placeholder rather than being handed an invented alarm
 * list, and `BankAlarms` says what the one with a unit is carrying.
 */
const BankAlarmsRoute = () => {
  const {bankId} = useParams({from: '/_authenticated/battery_/$bankId'});

  if (!isMonitored(bankId)) {
    return (
      <ComingSoon
        icon={BellIcon}
        title="Alarms"
        description="Cell imbalance, over-temperature, low state of charge, BMS faults. A bank decides whether a tower stays up overnight and this one raises no alarms at all — nothing is watching it. SBH-1336 has a monitoring unit, and twenty-eight of its registers are about the battery."
      />
    );
  }

  return <BankAlarms key={bankId} bankId={bankId} />;
};

export const Route = createFileRoute('/_authenticated/battery_/$bankId/alarms')({
  component: BankAlarmsRoute,
});
