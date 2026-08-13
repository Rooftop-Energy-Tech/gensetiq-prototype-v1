import {ShieldAlertIcon, ShieldCheckIcon, ShieldIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {SiteCoverage} from '../data/sites';

/**
 * How a site's coverage is written and coloured.
 *
 * Deliberately a *different* vocabulary from run state and from alert severity,
 * because it answers a different question and the page has to keep the three
 * apart. Run state is what a machine is doing; severity is what is wrong with it;
 * coverage is whether the customer has power. A site can be `COVERED` with a
 * critical alert on the set that is carrying it, and `EXPOSED` with no alerts at
 * all — a yard of cleanly stopped sets nobody can reach.
 *
 * `STANDBY` takes the neutral idle colour rather than a warning one on purpose:
 * a site sitting on standby with the grid up is the normal, correct state of every
 * genset installation, and colouring it amber would mean seventeen sites shouting
 * at a reader on a day when nothing is wrong.
 */
export const COVERAGE_META: Record<
  SiteCoverage,
  {label: string; icon: LucideIcon; textClassName: string; hint: string}
> = {
  COVERED: {
    label: 'Covered',
    icon: ShieldCheckIcon,
    textClassName: 'text-teal',
    hint: 'A genset here is feeding the load right now.',
  },
  STANDBY: {
    label: 'Standby',
    icon: ShieldIcon,
    textClassName: 'text-status-idle',
    hint: 'Nothing is running, and at least one set is fit to start on a mains failure.',
  },
  EXPOSED: {
    label: 'Exposed',
    icon: ShieldAlertIcon,
    textClassName: 'text-severity-critical',
    hint: 'No genset here can pick up the load — every set is faulted or unreachable.',
  },
};
