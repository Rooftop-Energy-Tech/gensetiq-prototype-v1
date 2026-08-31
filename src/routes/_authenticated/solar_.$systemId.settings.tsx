import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * The assumptions this system is judged against.
 *
 * Every figure on the home page and the analysis tab is measured against a design
 * — the P50, the P90 band at 0.9 of it, and the performance ratio behind both —
 * and all three are constants in `hybrid.ts` today. A page that reports a
 * shortfall against a number nobody can inspect is asking to be taken on trust,
 * which is the one thing the rest of this section refuses to do.
 *
 * The thresholds the health band fires on belong here beside them, and so does
 * the answer to a question this model has not had to face yet: when a site has a
 * generation meter *and* inverter telemetry, the two will not agree — AC losses,
 * auxiliary draw, one box out of contact — and whichever is made the truth, the
 * other becomes a reconciliation.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="The design this system is judged against — its P50 yield, the P90 band, and the performance ratio behind them — as editable figures rather than constants in hybrid.ts. Empty."
    />
  ),
});
