import {useState} from 'react';
import {CheckIcon, ChevronDownIcon, TruckIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {dayMonth} from '@/lib/format';
import {cn} from '@/lib/utils';
import {siteLabel} from '@/modules/site/data/siteSeed';
import type {GensetPosting} from '@/modules/deployment/types/deployment.type';
import {postingEnd} from '@/modules/deployment/types/deployment.type';

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
 *
 * It takes **postings** rather than jobs: the window belongs to the job, and which
 * of its machines this is decides where the window ends, because a set collected on
 * day nine of a fortnight did not run the last five days. The reference leads each
 * row now that a job has one, since `DEP-0042` is what a reader will have heard the
 * job called.
 */
export const DeploymentPicker = ({
  postings,
  selectedId,
  onSelect,
}: {
  /** This genset's postings, newest first — the one it is standing on at the head. */
  postings: Array<GensetPosting>;
  selectedId: string | undefined;
  onSelect: (deploymentId: string | undefined) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = postings.find((posting) => posting.deployment.id === selectedId);

  if (postings.length === 0) return null;

  const label = (posting: GensetPosting): string => {
    const end = postingEnd(posting);
    return end === null
      ? `${dayMonth(posting.deployment.startsAt)} – ongoing`
      : `${dayMonth(posting.deployment.startsAt)} – ${dayMonth(end)}`;
  };

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
            : `${selected.deployment.reference} · ${label(selected)}`}
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

        {postings.map((posting) => (
          <button
            key={posting.membership.id}
            type="button"
            onClick={() => {
              onSelect(posting.deployment.id);
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
          >
            <span className="min-w-0">
              <span className="block truncate text-primary">
                {posting.deployment.reference} · {siteLabel(posting.deployment.siteId)}
                {postingEnd(posting) === null && (
                  <span className="text-secondary"> · ongoing</span>
                )}
              </span>
              <span className="block truncate text-xs text-tertiary">
                {label(posting)} · {posting.deployment.locationLabel}
              </span>
            </span>
            {posting.deployment.id === selectedId && (
              <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
