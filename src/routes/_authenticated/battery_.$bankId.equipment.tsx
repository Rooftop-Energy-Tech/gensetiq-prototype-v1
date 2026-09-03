import {createFileRoute} from '@tanstack/react-router';
import {CircuitBoardIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * The module count and converter rating on the home page are derived from the bank's energy at one standard module and one standard C-rate — see `banks.ts`. This is where the real layout would be recorded, and where those two derived figures would stop being derived.
 */
export const Route = createFileRoute('/_authenticated/battery_/$bankId/equipment')({
  component: () => (
    <ComingSoon
      icon={CircuitBoardIcon}
      title="Devices"
      description="Nameplate: chemistry, rack and module layout, the BMS and converter fitted, and the commissioning record. Empty."
    />
  ),
});
