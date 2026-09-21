import {Link} from '@tanstack/react-router';
import {CheckIcon, ChevronsUpDownIcon} from 'lucide-react';
import {useState} from 'react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import type {Deployment} from '../../types/deployment.type';
import {deploymentSearch} from '../../types/view.type';
import {deploymentState} from '../../types/deployment.type';
import {useDeployments} from '../../data/store';
import {DEPLOYMENT_STATE_META} from '../stateMeta';

/**
 * The deployment rail's header: which job you are on, and a way to any live one.
 *
 * `SiteSwitcher`'s component and its argument — the design's `ChevronsUpDown` glyph
 * means one thing, and moving between two jobs otherwise means going back to the
 * register, finding the row and clicking it.
 *
 * ## Why the menu holds only what is live
 *
 * Standing jobs first, then what is booked. **The record is not in here**, and that is
 * the difference from the site switcher: an estate has twenty-five sites and they are
 * all equally real, while this record grows by four jobs a week and most of it is
 * closed. A menu listing seventy-three references would be a worse copy of the screen
 * it exists to save a trip to, so the closed ones are reached the way they should be:
 * through the register, where they can be searched and sorted.
 */
export const DeploymentSwitcher = ({deployment}: {deployment: Deployment}) => {
  const [open, setOpen] = useState(false);
  const {deployments} = useDeployments();
  // One reading for as long as the rail is mounted, the rule every `now` in this app
  // follows: a menu that re-read the clock on each render could reshuffle itself
  // under the pointer as a job crossed its start.
  const [now] = useState(() => Date.now());

  const live = deployments
    .filter((job) => deploymentState(job, now) !== 'completed')
    .sort((a, b) => {
      const rank = (job: Deployment) => (deploymentState(job, now) === 'active' ? 0 : 1);
      return rank(a) - rank(b) || a.startsAt.localeCompare(b.startsAt);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-primary">
            {deployment.reference}
          </span>
          <span className="truncate text-xs text-secondary">{deployment.locationLabel}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
      </PopoverTrigger>

      {/* Matched to the trigger's width so the menu reads as the header opening rather
          than as a panel landing on top of it, and capped in height for the reason the
          site switcher's is. */}
      <PopoverContent align="start" className="max-h-80 w-[224px] overflow-y-auto p-1">
        <ul className="flex flex-col">
          {live.map((job) => {
            const meta = DEPLOYMENT_STATE_META[deploymentState(job, now)];
            const Icon = meta.icon;
            const current = job.id === deployment.id;

            return (
              <li key={job.id}>
                <Link
                  to="/deployments/$deploymentId"
                  params={{deploymentId: job.id}}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 outline-none',
                    'transition-colors hover:bg-hover focus-visible:bg-hover',
                  )}
                >
                  <Icon className={cn('size-3.5 shrink-0', meta.iconClassName)} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-primary">{job.reference}</span>
                    <span className="truncate text-xs text-secondary">{job.locationLabel}</span>
                  </span>
                  {current && (
                    <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The way to everything this menu deliberately leaves out. */}
        <Link
          to="/deployments"
          search={deploymentSearch()}
          onClick={() => setOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-md border-t border-subtle px-2 py-1.5 text-xs text-secondary outline-none transition-colors hover:bg-hover hover:text-primary focus-visible:bg-hover"
        >
          All deployments, including the record
        </Link>
      </PopoverContent>
    </Popover>
  );
};
