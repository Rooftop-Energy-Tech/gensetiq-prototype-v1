import {useId, useState} from 'react';
import type {ReactNode} from 'react';
import {useNavigate} from '@tanstack/react-router';
import {TrashIcon, XIcon} from 'lucide-react';

import {InfoTip, LockTip} from '@/components/global/InfoTip';
import {SearchSelect} from '@/components/global/SearchSelect';
import {Button} from '@/components/ui/button';
import {DateInput} from '@/components/ui/date-input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {stampDate} from '@/lib/format';
import type {DeploymentRow} from '../../data/feed';
import {DEPLOYMENT_CLIENTS, clientById} from '../../data/particulars';
import {
  closeDeployment,
  deleteDeployment,
  referenceTaken,
  updateDeployment,
} from '../../data/store';
import {deploymentSearch} from '../../types/view.type';
import {AddressField} from './AddressField';
import {includes, usePinLookup} from './addressSearch';
import {PinMap} from './PinMap';
import {SettingsContacts} from './SettingsContacts';
import {
  CrewEditor,
  JobTypePicker,
  ReferenceChecker,
  WORK,
  cleanReference,
  effectiveJobType,
  referenceProblem,
  withPrefix,
} from './DeploymentWork';
import {SettingsNotes} from './SettingsNotes';

/**
 * A deployment's own facts, who it is for, its log, and the two things that end it.
 *
 * ## What belongs here
 *
 * The site's Settings tab draws the line at **givens, not readings**, and the same
 * line holds: the ID, the address, the dates, the customer and the people to call
 * are all statements a person made and can make differently. What the deployment
 * *produced* is not here, because that is measured.
 *
 * ## Moving a deployment moves its machines
 *
 * The address is one somebody searched for, or a spot they put under the pin (2026-09-30; the
 * register's sites stopped being offered on 2026-10-01). A pin belongs to this deployment only: the site it
 * was booked at keeps its position. On a standing deployment either one is a lorry —
 * every set on it takes the new position — which is `genset/data/deployment.ts`
 * reading the pin before the site.
 *
 * ## What locks, and when
 *
 * The start date locks once the deployment has started, since that day has
 * happened. A completed deployment is a record, so the whole page is read-only.
 *
 * ## End and delete are different acts
 *
 * **End** closes a standing deployment now: the machines leave the yard and none of
 * them moves, because they are standing there until somebody comes for them. The
 * record keeps everything it had. **Delete** is for a booking made in error, and is
 * offered on a planned deployment only: one machines have actually stood on is a
 * fact about the world. Both ask first, in a dialog.
 *
 * There is no Save button: there is no backend to save to, so a Save button would
 * imply a round-trip that does not exist. Text commits on blur or Enter; pickers,
 * the pin and the dates commit on change.
 */

/** ISO 8601 for a date input, which wants `YYYY-MM-DD` and nothing else. */
const dateValue = (iso: string | null): string =>
  iso === null ? '' : new Date(iso).toISOString().slice(0, 10);

/** Midday, so a date typed into a form cannot land the deployment on the previous day. */
const isoFromDate = (value: string): string | null =>
  value === '' ? null : new Date(`${value}T12:00:00`).toISOString();

/** Why a control is greyed out, for the lock tooltip. */
const ENDED = 'Locked because this deployment has ended. Completed deployments are read-only.';

const Field = ({
  label,
  htmlFor,
  hint,
  info,
  locked,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  /** What the field is for, behind an (i) beside the label. */
  info?: string;
  /** Why the control is greyed out, shown on hover. `undefined` when it is not. */
  locked?: string;
  children: ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
        {label}
      </label>
      {info !== undefined && <InfoTip label={label}>{info}</InfoTip>}
    </span>
    <LockTip reason={locked}>{children}</LockTip>
    {hint !== undefined && <p className="text-[13px] text-secondary">{hint}</p>}
  </div>
);

const Section = ({title, info, children}: {title: string; info?: string; children: ReactNode}) => (
  <section aria-label={title} className="flex flex-col gap-4">
    <span className="flex items-center gap-1.5">
      <h2 className="text-sm font-medium text-primary">{title}</h2>
      {info !== undefined && <InfoTip label={title}>{info}</InfoTip>}
    </span>
    {children}
  </section>
);

export const DeploymentSettings = ({row}: {row: DeploymentRow}) => {
  const {deployment, state} = row;
  const navigate = useNavigate();
  const ids = useId();

  const readOnly = state === 'completed';
  const [reference, setReference] = useState(deployment.reference);
  const [referenceRefused, setReferenceRefused] = useState<string | undefined>();
  const [editingReference, setEditingReference] = useState(false);
  const [jobTypeRefused, setJobTypeRefused] = useState<string | undefined>();
  const [clientQuery, setClientQuery] = useState('');
  const [confirming, setConfirming] = useState<'end' | 'delete' | null>(null);

  const client = clientById(deployment.clientId);
  const standing = row.members.filter((member) => !member.collected).length;
  const gensetCount = (count: number) => (count === 1 ? '1 genset' : `${count} gensets`);

  const {move: movePin, lookingUp} = usePinLookup((pin) => updateDeployment(deployment.id, {pin}));

  return (
    <div className="flex flex-col gap-7 overflow-y-auto px-6 py-7">
      <Section title="General">
        {/* Fields and map half the width each (2026-10-01; the fields were 28rem). */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Field
              label="Deployment ID"
              htmlFor={`${ids}-reference`}
              info={
                WORK === undefined
                  ? "The reference shown in the deployments list, alerts and reports. You can rename it, for example to the customer's work-order number."
                  : 'The ERQ or PRQ request number: three letters and seven digits. Shown in the deployments list, alerts and reports, and its letters set the job type.'
              }
              hint={referenceRefused}
              locked={readOnly ? ENDED : undefined}
            >
              <Input
                id={`${ids}-reference`}
                value={reference}
                disabled={readOnly}
                onChange={(event) => {
                  setReference(
                    WORK === undefined
                      ? event.target.value
                      : cleanReference(WORK, event.target.value),
                  );
                  setReferenceRefused(undefined);
                }}
                onBlur={() => {
                  setEditingReference(false);
                  const next = reference.trim();
                  if (next === '' || next === deployment.reference) {
                    setReference(deployment.reference);
                    return;
                  }
                  const refusal = referenceTaken(next, deployment.id)
                    ? 'Already used by another deployment.'
                    : WORK === undefined
                      ? undefined
                      : referenceProblem(WORK, next);
                  if (refusal !== undefined) {
                    setReferenceRefused(refusal);
                    setReference(deployment.reference);
                    return;
                  }
                  updateDeployment(deployment.id, {
                    reference: next,
                    ...(WORK === undefined
                      ? {}
                      : {jobType: effectiveJobType(WORK, next, deployment.jobType)}),
                  });
                }}
                onFocus={() => setEditingReference(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setReference(deployment.reference);
                }}
              />
              {/* While a new ID is being typed, the rules it has to meet; a refused one
                  is still explained by the hint after the box is left. */}
              {WORK !== undefined && editingReference && reference !== deployment.reference && (
                <ReferenceChecker
                  work={WORK}
                  reference={reference}
                  finished={false}
                  taken={referenceTaken(reference, deployment.id)}
                />
              )}
            </Field>

            {WORK !== undefined && (
              <Field
                label="Job type"
                htmlFor={`${ids}-job-type`}
                hint={jobTypeRefused}
                info="ERQ is an emergency request and PRQ a planned one; the ID's letters follow the pick. Standby is standby cover on an ERQ or PRQ request, and keeps the ID as it is."
                locked={readOnly ? ENDED : undefined}
              >
                <JobTypePicker
                  work={WORK}
                  value={deployment.jobType}
                  disabled={readOnly}
                  onChange={(jobType) => {
                    const prefix = WORK?.jobTypes.find((type) => type.id === jobType)?.prefix;
                    const renamed =
                      WORK === undefined || prefix === undefined
                        ? deployment.reference
                        : withPrefix(WORK, deployment.reference, prefix);
                    if (
                      renamed !== deployment.reference &&
                      referenceTaken(renamed, deployment.id)
                    ) {
                      setJobTypeRefused(`${renamed} is already used by another deployment.`);
                      return;
                    }
                    setJobTypeRefused(undefined);
                    setReference(renamed);
                    updateDeployment(deployment.id, {jobType, reference: renamed});
                  }}
                />
              </Field>
            )}

            <Field
              label="Address"
              htmlFor={`${ids}-address`}
              hint={lookingUp ? 'Looking up the address at the pin…' : undefined}
              info="Start typing the address and pick a suggestion. Move the map under the pin to fine-tune where the gensets stand. This moves this deployment only; the site keeps its position."
              locked={readOnly ? ENDED : undefined}
            >
              <AddressField
                id={`${ids}-address`}
                disabled={readOnly}
                address={row.address}
                onPick={(pin) => updateDeployment(deployment.id, {pin})}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Start date"
                htmlFor={`${ids}-starts`}
                info="The day the gensets arrive on site. It locks once the deployment has started."
                locked={
                  readOnly
                    ? ENDED
                    : state === 'active'
                      ? 'Locked because this deployment has already started.'
                      : undefined
                }
              >
                <DateInput
                  id={`${ids}-starts`}
                  disabled={state !== 'planned'}
                  value={dateValue(deployment.startsAt)}
                  onChange={(value) => {
                    const next = isoFromDate(value);
                    if (next !== null) updateDeployment(deployment.id, {startsAt: next});
                  }}
                />
              </Field>
              <Field
                label="Planned end date"
                htmlFor={`${ids}-ends`}
                info="When the gensets are due back. Leave it empty if there's no planned end; a genset on an open-ended deployment can't be booked to a later one."
                locked={readOnly ? ENDED : undefined}
              >
                <DateInput
                  id={`${ids}-ends`}
                  disabled={readOnly}
                  value={dateValue(deployment.endsAt)}
                  onChange={(value) =>
                    updateDeployment(deployment.id, {endsAt: isoFromDate(value)})
                  }
                />
              </Field>
            </div>

            {WORK !== undefined && (
              <CrewEditor
                key={deployment.id}
                work={WORK}
                crew={deployment.crew}
                onChange={(crew) => updateDeployment(deployment.id, {crew})}
                readOnly={readOnly}
                lockedReason={readOnly ? ENDED : undefined}
              />
            )}
          </div>

          {row.latitude !== undefined && row.longitude !== undefined && (
            <LockTip reason={readOnly ? ENDED : undefined}>
              <PinMap
                latitude={row.latitude}
                longitude={row.longitude}
                movable={!readOnly}
                onMove={movePin}
                className="min-h-[280px]"
              />
            </LockTip>
          )}
        </div>
      </Section>

      <div className="border-t border-subtle" />

      <Section title="Customer">
        <div className="max-w-md">
          <Field
            label="Customer"
            htmlFor={`${ids}-client`}
            info="The company that hired the gensets. Shown on the overview page and the side panel."
            locked={readOnly ? ENDED : undefined}
          >
            <SearchSelect
              id={`${ids}-client`}
              disabled={readOnly}
              query={clientQuery}
              onQueryChange={setClientQuery}
              searchPlaceholder="Search customers"
              placeholder="Choose a customer"
              selectedId={deployment.clientId ?? undefined}
              value={
                client === undefined ? null : <span className="block truncate">{client.name}</span>
              }
              groups={[
                {
                  options: DEPLOYMENT_CLIENTS.filter(
                    (each) => clientQuery.trim() === '' || includes(each.name, clientQuery),
                  ).map((each) => ({id: each.id, label: each.name})),
                  status: 'No matching customers',
                },
              ]}
              onSelect={(option) => updateDeployment(deployment.id, {clientId: option.id})}
            />
          </Field>
        </div>

        <SettingsContacts
          key={deployment.id}
          contacts={deployment.contacts}
          onChange={(contacts) => updateDeployment(deployment.id, {contacts})}
          readOnly={readOnly}
          lockedReason={readOnly ? ENDED : undefined}
        />
      </Section>

      <div className="border-t border-subtle" />

      <Section
        title="Notes"
        info="A log for access details, fuel drops and customer requests. Each note is signed with your name, and only its author can edit or delete it."
      >
        <SettingsNotes deployment={deployment} readOnly={readOnly} />
      </Section>

      <div className="border-t border-subtle" />

      <Section
        title="End deployment"
        info={
          state === 'planned'
            ? 'Deletes this booking and frees its gensets. Nothing has moved yet, so nothing is lost.'
            : "Ends the deployment now. The gensets stay on site until they're collected, and the record keeps everything."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {state === 'active' && (
            <Button variant="outline" size="sm" onClick={() => setConfirming('end')}>
              <XIcon aria-hidden="true" />
              End deployment
            </Button>
          )}
          {state === 'planned' && (
            <Button variant="outline" size="sm" onClick={() => setConfirming('delete')}>
              <TrashIcon aria-hidden="true" />
              Delete deployment
            </Button>
          )}
          {state === 'completed' && (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled button fires no pointer events, so the span carries the tooltip. */}
                <span tabIndex={0} className="inline-flex rounded-md">
                  <Button variant="outline" size="sm" disabled>
                    <XIcon aria-hidden="true" />
                    End deployment
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Ended on {stampDate(deployment.endsAt ?? deployment.startsAt)}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </Section>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="gap-4">
          <DialogTitle>
            {confirming === 'end'
              ? `End ${deployment.reference} now?`
              : `Delete ${deployment.reference}?`}
          </DialogTitle>
          <DialogDescription>
            {confirming === 'end'
              ? `${gensetCount(standing)} will be marked ready for collection. ${standing === 1 ? 'It stays' : 'They stay'} on site until collected.`
              : `This removes the booking and frees its ${gensetCount(row.members.length)}. It can't be undone.`}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirming === 'end') {
                  closeDeployment(deployment.id);
                  setConfirming(null);
                  return;
                }
                deleteDeployment(deployment.id);
                setConfirming(null);
                void navigate({to: '/deployments', search: deploymentSearch()});
              }}
            >
              {confirming === 'end' ? 'End deployment' : 'Delete deployment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
