import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * The design's rail names this section and draws nothing behind it; its placeholder
 * promised "alert thresholds, tags, who gets notified", and none of the three is
 * built.
 *
 * What belongs here is the short list of lines the *app* owns, as against the ones
 * the controller does. Every setpoint on this machine — the voltage at which it
 * drops the breaker, the temperature at which it shuts down — is a commissioning
 * value living in the panel, and a screen that let somebody type a different number
 * would be claiming a command this app cannot issue. The app's own rules are the
 * only editable things: what counts as an unexplained fuel loss, who is told when
 * one is found, and what this set is tagged as.
 */
export const Route = createFileRoute('/_authenticated/gensets_/$gensetId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The lines this genset's own rules fire on, as against the controller's — the fuel-loss threshold, its tags, and who gets notified. The panel's setpoints are not editable here and will not be. Empty."
    />
  ),
});
