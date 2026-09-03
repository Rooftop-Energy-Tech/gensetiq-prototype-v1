import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * The autonomy this page quotes is `hybridPlant`'s, spread across the estate from the site id and the hybrid configuration. Making it a setting is what would let a reader ask the question the number is really for: what would it take to hold this tower for another four hours.
 */
export const Route = createFileRoute('/_authenticated/battery_/$bankId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The bank's operating envelope — autonomy target, depth-of-discharge limit, and the round-trip efficiency the energy model assumes. Today constants in hybrid.ts; this is where they would become per-bank figures. Empty."
    />
  ),
});
