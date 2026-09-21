import {useId, useState} from 'react';
import {useNavigate} from '@tanstack/react-router';
import {TrashIcon, XIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {stampDate} from '@/lib/format';
import {siteSeeds} from '@/modules/site/data/siteSeed';
import type {DeploymentRow} from '../../data/feed';
import {closeDeployment, deleteDeployment, updateDeployment} from '../../data/store';
import {deploymentSearch} from '../../types/view.type';

/**
 * A job's own facts, and the two things that end it.
 *
 * ## What belongs here
 *
 * The site's Settings tab draws the line at **givens, not readings**, and the same
 * line holds: the reference somebody quoted, the yard it was agreed for, and the two
 * dates are all statements a person made and can make differently. What the job
 * *produced* is not here, because that is measured.
 *
 * ## Moving a job moves its machines
 *
 * Changing the yard on a standing job is a lorry, exactly as putting a machine on
 * one is: every set on it takes the new yard's placename and position. The control
 * says so before it is used, because a picker that quietly relocated three machines
 * would be lying about the biggest thing it does.
 *
 * ## Close and delete are different acts
 *
 * **Close** ends a standing job now: the window closes at this moment, the machines
 * leave the yard and none of them moves, because they are standing there until
 * somebody comes for them. The record keeps everything it had.
 *
 * **Delete** is for a job that should not exist — a booking made in error. It takes
 * the job and its commitments off the record, and the page says what will happen to
 * the machines before it does. It is offered on a planned job, and on a standing one
 * it is not: a job that machines have actually stood on is a fact about the world,
 * and the app should not offer to pretend otherwise.
 *
 * There is no Save button, for the reason the site's own form gives: there is no
 * backend to save to, so a Save button would imply a round-trip that does not exist.
 * Dates and the reference commit on blur or Enter; the yard commits on change.
 */

/** ISO 8601 for a date input, which wants `YYYY-MM-DD` and nothing else. */
const dateValue = (iso: string | null): string =>
  iso === null ? '' : new Date(iso).toISOString().slice(0, 10);

/** Midday, so a date typed into a form cannot land the job on the previous day. */
const isoFromDate = (value: string): string | null =>
  value === '' ? null : new Date(`${value}T12:00:00`).toISOString();

const Field = ({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex max-w-md flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
      {label}
    </label>
    {children}
    {hint !== undefined && <p className="text-[13px] text-secondary">{hint}</p>}
  </div>
);

export const DeploymentSettings = ({row}: {row: DeploymentRow}) => {
  const {deployment, state} = row;
  const navigate = useNavigate();
  const ids = useId();

  const [reference, setReference] = useState(deployment.reference);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sites = siteSeeds();

  return (
    <div className="flex flex-col gap-7 overflow-y-auto px-6 py-7">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-primary">The job</h2>
          <p className="max-w-2xl text-sm text-secondary">
            What this deployment is called, where it was agreed for, and the window it
            runs over. Changes take effect as you make them; there is no backend to save
            to.
          </p>
        </div>

        <Field
          label="Reference"
          htmlFor={`${ids}-reference`}
          hint="What the operations room quotes. Any string, so a customer's own work-order number fits."
        >
          <Input
            id={`${ids}-reference`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            onBlur={() => {
              const next = reference.trim();
              if (next === '' || next === deployment.reference) {
                setReference(deployment.reference);
                return;
              }
              updateDeployment(deployment.id, {reference: next});
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setReference(deployment.reference);
            }}
          />
        </Field>

        <Field
          label="Site"
          htmlFor={`${ids}-site`}
          hint={
            state === 'active'
              ? 'Moving a standing job is a lorry: every machine on it takes the new yard’s location.'
              : 'Which yard this job is agreed for.'
          }
        >
          <select
            id={`${ids}-site`}
            value={deployment.siteId}
            onChange={(event) => updateDeployment(deployment.id, {siteId: event.target.value})}
            className="h-9 w-full rounded-md border border-default bg-element px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-outline"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} · {site.locationLabel}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap gap-4">
          <Field label="Starts" htmlFor={`${ids}-starts`}>
            <Input
              id={`${ids}-starts`}
              type="date"
              defaultValue={dateValue(deployment.startsAt)}
              onBlur={(event) => {
                const next = isoFromDate(event.target.value);
                if (next !== null) updateDeployment(deployment.id, {startsAt: next});
              }}
            />
          </Field>

          <Field
            label="Agreed end"
            htmlFor={`${ids}-ends`}
            hint="Leave empty for a job with no agreed end. A machine on an open-ended job cannot be booked to a later one."
          >
            <Input
              id={`${ids}-ends`}
              type="date"
              defaultValue={dateValue(deployment.endsAt)}
              onBlur={(event) =>
                updateDeployment(deployment.id, {endsAt: isoFromDate(event.target.value)})
              }
            />
          </Field>
        </div>
      </section>

      <div className="border-t border-subtle" />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-primary">Ending it</h2>
          <p className="max-w-2xl text-sm text-secondary">
            {state === 'active' &&
              `Closing ${deployment.reference} ends its window now. The ${row.members.filter((member) => !member.collected).length} machine(s) still on it leave the yard and none of them moves: each is standing there until somebody comes for it.`}
            {state === 'planned' &&
              'This job has not started. Deleting it releases every machine committed to it and moves nothing.'}
            {state === 'completed' &&
              `This job closed on ${stampDate(deployment.endsAt ?? deployment.startsAt)}. It is the record of what stood there, so there is nothing left to end.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state === 'active' && (
            <Button variant="outline" size="sm" onClick={() => closeDeployment(deployment.id)}>
              <XIcon aria-hidden="true" />
              Close this job now
            </Button>
          )}

          {/* Offered on a planned job only. A job machines have actually stood on is a
              fact about the world, and this app does not offer to unmake one. */}
          {state === 'planned' &&
            (confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-secondary">
                  Delete {deployment.reference} and release{' '}
                  {row.members.length === 1 ? 'its machine' : `its ${row.members.length} machines`}?
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteDeployment(deployment.id);
                    void navigate({to: '/deployments', search: deploymentSearch()});
                  }}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(true)}>
                <TrashIcon aria-hidden="true" />
                Delete this booking
              </Button>
            ))}
        </div>
      </section>
    </div>
  );
};
