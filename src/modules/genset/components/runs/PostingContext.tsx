import {MapPinIcon, TruckIcon} from 'lucide-react';

import {amount, stampDate} from '@/lib/format';
import {postingEnd} from '@/modules/deployment/types/deployment.type';
import type {GensetPosting} from '@/modules/deployment/types/deployment.type';

/**
 * The posting a window of runs belongs to — the deployment log, folded in here.
 *
 * ## Why the two logs became one
 *
 * A genset had a `Runs` tab and a `Deployments` tab, and a reader had to hold the
 * relationship between them in their head: a posting is a stretch of work, the runs
 * are what the engine did inside it, and the deployments log's `On load` column was
 * the runs tab's `Time running` for one particular window. Two screens, one subject,
 * asked of the same machine — Afifah's call, 2026-09-22: the deployment details come
 * here and the separate tab goes.
 *
 * It fits because the runs tab already scoped by posting. `DeploymentPicker` was
 * written on the argument that a posting is the window the questions are actually
 * asked of — "what did the Ranau posting burn?" — so the page could already answer
 * for one job. What it could not do is say *anything about the job itself*: which
 * yard, which lorry, what the tank read when it arrived and when it left. Those were
 * a tab away, which is exactly the split that made two tabs confusing.
 *
 * ## Two states, because the picker has two
 *
 * With a posting chosen, this is that posting: where, when, the tank at both edges,
 * the lorry. With none chosen, the window is a stretch of calendar that may cross
 * several postings, and the honest summary is the machine's posting record as a
 * whole — how many it has held and where it is standing now. That second state is
 * what the deployments tab's three tiles used to say.
 */

const Field = ({label, value}: {label: string; value: string}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="truncate text-xs font-medium text-secondary">{label}</span>
    <span className="truncate text-sm font-semibold text-primary">{value}</span>
  </div>
);

export const PostingContext = ({
  posting,
  postings,
  standingAt,
}: {
  /** The posting the window is scoped to, if the reader has chosen one. */
  posting: GensetPosting | undefined;
  /** Every posting this machine has held, for the unscoped summary. */
  postings: ReadonlyArray<GensetPosting>;
  /** Where it is standing now, or `undefined` in the workshop. */
  standingAt: string | undefined;
}) => {
  if (posting === undefined) {
    if (postings.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-x-10 gap-y-3 rounded-md border border-subtle bg-element px-5 py-4">
        <Field label="Postings held" value={String(postings.length)} />
        <Field label="Standing at" value={standingAt ?? 'In depot'} />
        {/* Said plainly rather than left for a reader to infer from the range
            control: a window drawn on the calendar can straddle three postings and
            a gap, and the totals under it are then a sum across all of them. */}
        <p className="min-w-0 text-xs text-tertiary">
          Showing a calendar window. Pick a posting to scope the runs and totals to
          one job.
        </p>
      </div>
    );
  }

  const {deployment, membership} = posting;
  const end = postingEnd(posting);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-subtle bg-element px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-primary">{deployment.reference}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-secondary">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{deployment.locationLabel}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
        <Field
          label="Window"
          value={`${stampDate(deployment.startsAt)} — ${end === null ? 'standing' : stampDate(end)}`}
        />
        {/* The tank at the job's own edges, which is the figure the deployment log
            carried and no run does: a run knows what it burned, only the posting
            knows what was in the tank when the lorry dropped the set off. */}
        <Field label="Tank on arrival" value={amount(membership.startFuelLitres, 'L')} />
        <Field
          label="Tank on collection"
          value={
            membership.endFuelLitres === null
              ? 'Still standing'
              : amount(membership.endFuelLitres, 'L')
          }
        />
        {membership.lorryPlate !== '' && (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xs font-medium text-secondary">Lorry</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <TruckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
              {membership.lorryPlate}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
