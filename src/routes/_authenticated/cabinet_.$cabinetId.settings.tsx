import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * Every threshold this cabinet's alarms fire against lives in a configuration
 * register the poll set does not read — the DC over/undervoltage pair at `0x2108`
 * and `0x2109`, the four load-shed stages' enables and modes, the door sensor's
 * enable at `0x2251`. That is the gap the source document calls the highest-value
 * firmware change outstanding: a one-time boot read of about twenty registers, which
 * would turn most of these alarms from "a 1 is real, a 0 means nothing" into signals
 * trustworthy in both directions. This is where they would be shown, and read-only —
 * section 16 of the register map is emphatic that this device must never be written
 * to, because `0x3004` deliberately runs the bank down and `0x3005` turns off the
 * tower.
 */
export const Route = createFileRoute('/_authenticated/cabinet_/$cabinetId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The plant's own setpoints, read from the device and never written to it: the DC bus alarm window, the load-shed ladder's thresholds and modes, and which sensor ports on the expansion board are populated. Seventeen alarms cannot be trusted in both directions until these are read. Empty."
    />
  ),
});
