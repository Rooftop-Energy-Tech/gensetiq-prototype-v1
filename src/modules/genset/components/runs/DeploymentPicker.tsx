import {useState} from 'react';
import {CheckIcon, ChevronDownIcon, TruckIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {dayMonth} from '@/lib/format';
import {cn} from '@/lib/utils';
import {siteLabel} from '@/modules/site/data/siteSeed';
import type {DeploymentSession} from '../../types/deployment.type';

/**
 * The third way of choosing a window: **by posting**.
 *
 * The presets and the calendar name a stretch of *time*; this names a stretch of
 * *work* — one deployment, from the lorry dropping the set to the lorry
 * collecting it. It is the window the questions are actually asked of ("what did
 * the Ranau posting burn?"), and it is exact where the calendar is day-granular,
 * so the totals under it reconcile with the same posting's row on the dispatch
 * feed rather than approximately agreeing with it.
 *
 * A popover of rows rather than a native select, in the range calendar's
 * pattern: each posting needs two lines — where, and when — and an option
 * element holds one.
 */
export const DeploymentPicker = ({
  deployments,
  selectedId,
  onSelect,
}: {
  /** This genset's postings, newest first — the open one at the head. */
  deployments: Array<DeploymentSession>;
  selectedId: string | undefined;
  onSelect: (deploymentId: string | undefined) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = deployments.find((deployment) => deployment.id === selectedId);

  if (deployments.length === 0) return null;

  const label = (deployment: DeploymentSession): string =>
    deployment.endedAt === null
      ? `${dayMonth(deployment.startedAt)} – ongoing`
      : `${dayMonth(deployment.startedAt)} – ${dayMonth(deployment.endedAt)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={selected !== undefined}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            selected !== undefined
              ? 'border-subtle bg-highlight text-primary'
              : 'border-transparent bg-element text-secondary hover:text-primary',
          )}
        >
          <TruckIcon className="size-3.5" aria-hidden="true" />
          {selected === undefined
            ? 'By deployment'
            : `${siteLabel(selected.siteId)} · ${label(selected)}`}
          <ChevronDownIcon className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-1">
        {/* "All" first, because it is the way back out of the scope. */}
        <button
          type="button"
          onClick={() => {
            onSelect(undefined);
            setOpen(false);
          }}
          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-hover"
        >
          All deployments
          {selected === undefined && (
            <CheckIcon className="size-3.5 text-secondary" aria-hidden="true" />
          )}
        </button>

        {deployments.map((deployment) => (
          <button
            key={deployment.id}
            type="button"
            onClick={() => {
              onSelect(deployment.id);
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
          >
            <span className="min-w-0">
              <span className="block truncate text-primary">
                {siteLabel(deployment.siteId)}
                {deployment.endedAt === null && (
                  <span className="text-secondary"> · ongoing</span>
                )}
              </span>
              <span className="block truncate text-xs text-tertiary">
                {label(deployment)} · {deployment.locationLabel}
              </span>
            </span>
            {deployment.id === selectedId && (
              <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
