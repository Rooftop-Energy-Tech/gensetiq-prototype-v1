import {Link} from '@tanstack/react-router';
import {CircleCheckIcon, DropletIcon, DropletsIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import type {FuelIntegrityState} from '../../types/fuelIntegrity.type';

/**
 * The reconciliation verdict, in the fuel band, in one line.
 *
 * ## Why the three quiet states are drawn at all
 *
 * They could be nothing — no badge on a genset that cannot be checked — and that is
 * what an earlier pass did. It reads as a clean page and it is the failure this
 * whole feature is built to avoid: a tank showing a healthy level, a runway, a
 * refuel date and no leak badge is indistinguishable from a tank that has been
 * checked and found sound, and most of this fleet has never been checked at all.
 *
 * So `Not monitored` is drawn, quietly, and links to the tab that says which
 * instrument is missing. It is the smallest honest statement: this number is a
 * level, and nobody is watching where the level goes.
 *
 * ## Why the figures are not here
 *
 * The arithmetic is nine rows and it belongs next to the threshold it is measured
 * against. This band answers "how much is in there and when do I have to do
 * something"; a derivation in the middle of it would be answering a question the
 * reader has not asked yet.
 */
export const LeakBadge = ({gensetId, state}: {gensetId: string; state: FuelIntegrityState}) => {
  const content = (() => {
    switch (state.kind) {
      case 'unavailable':
        return {label: 'Not monitored', icon: DropletIcon, className: 'text-tertiary'};
      case 'off':
        return {label: 'Leak alarm off', icon: DropletIcon, className: 'text-tertiary'};
      case 'suspended':
        return {label: 'Leak check paused', icon: DropletIcon, className: 'text-tertiary'};
      case 'ok':
        // A shortfall the instruments cannot explain, sitting under the operator's
        // line, is not the same clean bill as a tank that reconciles — and a badge
        // reading "Fuel reconciles" over a real 79 L loss would be the page
        // covering for a threshold somebody set too wide.
        return state.figures.confirmedShortfallLitres > 0
          ? {
              label: `${amount(Math.round(state.figures.confirmedShortfallLitres), 'L')} under threshold`,
              icon: DropletIcon,
              className: 'text-severity-ok',
            }
          : {label: 'Fuel reconciles', icon: CircleCheckIcon, className: 'text-severity-ok'};
      case 'surplus':
        return {label: 'More fuel than expected', icon: DropletsIcon, className: 'text-severity-warning'};
      default:
        return {
          label: `${amount(Math.round(state.figures.confirmedShortfallLitres), 'L')} unaccounted for`,
          icon: DropletIcon,
          className:
            state.kind === 'critical' ? 'text-severity-critical' : 'text-severity-warning',
        };
    }
  })();

  const Icon = content.icon;

  return (
    <Badge
      asChild
      variant="element"
      className="border-subtle transition-colors hover:bg-highlight"
    >
      <Link to="/gensets/$gensetId/settings" params={{gensetId}}>
        <Icon className={content.className} aria-hidden="true" />
        {content.label}
      </Link>
    </Badge>
  );
};
