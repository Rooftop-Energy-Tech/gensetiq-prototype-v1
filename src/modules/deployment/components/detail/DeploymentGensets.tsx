import {useState} from 'react';
import {BoomBoxIcon, PlusIcon, TruckIcon, XIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {dayMonth} from '@/lib/format';
import {cn} from '@/lib/utils';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {useFleet} from '@/modules/genset/data/deployment';
import type {Genset} from '@/modules/genset/types/genset.type';
import {siteLabel} from '@/modules/site/data/siteSeed';
import type {DeploymentRow} from '../../data/feed';
import {addGenset, collectGenset, conflictFor} from '../../data/store';

/**
 * Which machines are on this job — and the control that changes it.
 *
 * ## This is the write path, and it replaced attaching to a site
 *
 * The site page used to carry an `Attach genset` picker that moved a machine on
 * click. It was the only way a reader could place plant, and it wrote a membership
 * with no window: a machine was *at* a yard, with nothing recording since when or
 * for how long. That is the gap this whole change closes, so the control moved here,
 * where the window already exists.
 *
 * What a reader does here therefore depends on the job's state, and the page says
 * which before they commit to it:
 *
 *  - On an **active** job, adding a machine is a lorry. The set takes this yard's
 *    placename and a spot in it, and its pin moves on the fleet map.
 *  - On a **planned** job, adding a machine is a booking. Nothing moves, and the
 *    machine stays wherever it is standing until the job starts.
 *  - On a **completed** job, nothing can be added: the job is over, and a machine
 *    added to a closed window would be a claim that it stood somewhere it did not.
 *
 * ## Why other jobs' machines are not in the picker
 *
 * The site page's own picker offered them, on the argument that restricting it to
 * the depot would make every transfer a two-step errand. That argument does not
 * survive a window: a machine already on a job that overlaps this one cannot be on
 * both, and offering it would mean either refusing the click or silently ending
 * somebody else's job. So the list is the machines that are **free for this
 * window**, and the ones that are not are named underneath with the job in the way,
 * which is more use than hiding them: "KHL-928197 is on DEP-0031 until the 14th" is
 * a fact a dispatcher can act on.
 *
 * ## Collecting
 *
 * On an active job it closes the membership at now: the machine leaves the yard and
 * **does not move**, because it is standing there until somebody comes for it. On a
 * planned one it releases the booking outright, since there is nothing to collect.
 */

/** Tag, model and run state — the three facts every row here leads with. */
const GensetIdentity = ({genset, tag, model}: {genset: Genset | undefined; tag: string; model: string}) => {
  const meta = genset === undefined ? undefined : RUN_STATE_META[genset.runState];
  const Icon = meta?.icon;

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-highlight">
        <BoomBoxIcon className="size-[18px] text-secondary" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-primary">{tag}</span>
        <span className="truncate text-[13px] leading-[18px] text-secondary">{model}</span>
      </span>
      {Icon !== undefined && meta !== undefined && (
        <Badge variant="element" className="ml-1 shrink-0 border-subtle">
          <Icon className={cn('size-3', meta.iconClassName)} aria-hidden="true" />
          {meta.label}
        </Badge>
      )}
    </span>
  );
};

export const DeploymentGensets = ({row}: {row: DeploymentRow}) => {
  const fleet = useFleet();
  const [picking, setPicking] = useState(false);
  const [refused, setRefused] = useState<string | undefined>();

  const {deployment, state} = row;
  const onJob = new Set(row.members.map((member) => member.membership.gensetId));

  /**
   * Every machine not already on this job, split by whether it is free for the
   * window. Depot machines lead the free ones: taking a set from there changes one
   * job, and taking one from another yard changes two.
   */
  const candidates = fleet
    .filter((genset) => !onJob.has(genset.id))
    .map((genset) => ({genset, conflict: conflictFor(genset.id, deployment)}))
    .sort(
      (left, right) =>
        Number(left.conflict !== undefined) - Number(right.conflict !== undefined) ||
        Number(left.genset.siteId !== null) - Number(right.genset.siteId !== null) ||
        left.genset.tag.localeCompare(right.genset.tag),
    );

  const free = candidates.filter((candidate) => candidate.conflict === undefined);
  const busy = candidates.filter((candidate) => candidate.conflict !== undefined);

  const put = (gensetId: string, tag: string) => {
    const result = addGenset(deployment.id, gensetId);
    setRefused(
      result.ok ? undefined : `${tag} is on ${result.conflict.reference} over this window.`,
    );
    if (result.ok) setPicking(false);
  };

  return (
    <section
      aria-labelledby="deployment-gensets"
      className="flex flex-col gap-5 overflow-y-auto px-6 py-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="deployment-gensets" className="text-sm font-medium text-primary">
          Gensets on {deployment.reference}
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          {state === 'active' &&
            `The machines standing at ${row.siteName}. Adding one deploys it here: it takes this site's location and moves on the fleet map. Collecting one ends its posting; nothing physically moves until somebody comes for it.`}
          {state === 'planned' &&
            `The machines booked to this job. Nothing moves until it starts on ${dayMonth(deployment.startsAt)}, and a machine committed here cannot be booked to another job over the same window.`}
          {state === 'completed' &&
            'This job is closed, so its machines are the record of what stood there. Nothing can be added to a window that is over.'}
        </p>
      </div>

      <div className="flex max-w-3xl flex-col gap-2">
        {row.members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
            No machines on this job.
          </p>
        ) : (
          row.members.map((member) => {
            const genset = fleet.find((machine) => machine.id === member.membership.gensetId);

            return (
              <div
                key={member.membership.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-element p-3"
              >
                <GensetIdentity genset={genset} tag={member.tag} model={member.model} />

                <span className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[13px] text-secondary">
                    {member.collected ? (
                      <span className="text-tertiary">
                        collected {dayMonth(member.membership.collectedAt as string)}
                      </span>
                    ) : (
                      <>
                        <TruckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        {member.membership.lorryPlate}
                      </>
                    )}
                  </span>

                  {/* A closed job's membership is a record, and a collected machine
                      has already gone. Neither offers a control. */}
                  {state !== 'completed' && !member.collected && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => collectGenset(member.membership.id)}
                        >
                          <XIcon aria-hidden="true" />
                          {state === 'planned' ? 'Release' : 'Collect'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-64">
                        {state === 'planned'
                          ? `Release ${member.tag} from this booking. It is free for another job over this window.`
                          : `Collect ${member.tag}. Its posting ends now and it stays where it is standing until somebody moves it.`}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {state !== 'completed' && (
        <div className="flex max-w-3xl flex-col gap-2">
          {picking ? (
            <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-element p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-primary">
                  {state === 'active' ? 'Deploy a genset here' : 'Book a genset to this job'}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
                  Cancel
                </Button>
              </div>

              {free.length === 0 ? (
                <p className="py-2 text-sm text-secondary">
                  Every machine in the fleet is committed over this window.
                </p>
              ) : (
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {free.map(({genset}) => (
                    <li key={genset.id}>
                      <button
                        type="button"
                        onClick={() => put(genset.id, genset.tag)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left',
                          'outline-none transition-colors hover:bg-hover focus-visible:bg-hover',
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm text-primary">{genset.tag}</span>
                          <span className="truncate text-xs text-secondary">{genset.model}</span>
                        </span>
                        {/* Where it is now, so nobody moves a set off another yard
                            without reading that they are doing it. */}
                        <span className="shrink-0 text-xs text-tertiary">
                          {genset.siteId === null
                            ? 'In the depot'
                            : `At ${siteLabel(genset.siteId)}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* The machines this job cannot have, and why. Named rather than
                  hidden: the job in the way is the fact a dispatcher needs. */}
              {busy.length > 0 && (
                <details className="border-t border-subtle pt-2">
                  <summary className="cursor-pointer text-xs text-secondary">
                    {busy.length} committed elsewhere over this window
                  </summary>
                  <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {busy.map(({genset, conflict}) => (
                      <li
                        key={genset.id}
                        className="flex items-baseline justify-between gap-3 px-2 text-xs"
                      >
                        <span className="truncate text-secondary">{genset.tag}</span>
                        <span className="shrink-0 text-tertiary">
                          {conflict?.reference} · {conflict?.locationLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" className="self-start" onClick={() => setPicking(true)}>
              <PlusIcon aria-hidden="true" />
              {state === 'active' ? 'Deploy a genset here' : 'Book a genset'}
            </Button>
          )}

          {/* The store refuses an overlap even though the picker filters them out,
              and when it does the reason is shown rather than swallowed. */}
          {refused !== undefined && (
            <p className="text-sm text-severity-warning">{refused}</p>
          )}
        </div>
      )}
    </section>
  );
};
