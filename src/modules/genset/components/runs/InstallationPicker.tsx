import {useState} from 'react';
import {CheckIcon, ChevronDownIcon, MapPinIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {dayMonth} from '@/lib/format';
import {cn} from '@/lib/utils';
import {siteLabel} from '@/modules/site/data/siteSeed';
import type {Installation} from '../../types/installation.type';

/**
 * The third way of choosing a window: **by installation**.
 *
 * The presets and the calendar name a stretch of *time*; this names a stretch of
 * *service* — one fitting, from the day the set was commissioned onto a plinth to
 * the day it came off. It is exact where the calendar is day-granular, so the
 * totals under it reconcile with the installation record rather than
 * approximately agreeing with it.
 *
 * ## Why it usually is not on screen
 *
 * It hides below two entries, and on this estate almost every set has one — see
 * `installations.ts`. A picker offering a single choice that is also the default
 * is a control that cannot do anything, and the honest treatment of one is not to
 * draw it. It returns the moment a set has been swapped out and back, which is
 * exactly when "which fitting was that under" becomes a real question.
 *
 * A popover of rows rather than a native select, in the range calendar's pattern:
 * each entry needs two lines — where, and when — and an option element holds one.
 */
export const InstallationPicker = ({
  deployments,
  selectedId,
  onSelect,
}: {
  /** This genset's postings, newest first — the open one at the head. */
  deployments: Array<Installation>;
  selectedId: string | undefined;
  onSelect: (deploymentId: string | undefined) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = deployments.find((deployment) => deployment.id === selectedId);

  if (deployments.length < 2) return null;

  const label = (deployment: Installation): string =>
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
          <MapPinIcon className="size-3.5" aria-hidden="true" />
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
