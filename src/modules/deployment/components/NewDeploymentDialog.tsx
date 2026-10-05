import {useEffect, useId, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {useNavigate} from '@tanstack/react-router';
import {CheckIcon, MapPinIcon, PlusIcon} from 'lucide-react';

import {InfoTip} from '@/components/global/InfoTip';
import {SearchSelect} from '@/components/global/SearchSelect';
import {Button} from '@/components/ui/button';
import {DateInput} from '@/components/ui/date-input';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {sessionName, useSession} from '@/modules/auth/session';
import {useFleet} from '@/modules/genset/data/deployment';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {DEPLOYMENT_CLIENTS, clientById} from '../data/particulars';
import {
  addGenset,
  conflictFor,
  createDeployment,
  nextReference,
  referenceTaken,
} from '../data/store';
import type {
  DeploymentBooking,
  DeploymentContact,
  DeploymentCrewMember,
  DeploymentPin,
} from '../types/deployment.type';
import {includes, nearestSiteId, usePinLookup} from './detail/addressSearch';
import {AddressField} from './detail/AddressField';
import {
  CrewEditor,
  JobTypePicker,
  ReferenceChecker,
  WORK,
  cleanReference,
  effectiveJobType,
  jobTypeOf,
  referenceProblem,
  withPrefix,
} from './detail/DeploymentWork';
import {PinMap} from './detail/PinMap';
import {SettingsContacts} from './detail/SettingsContacts';
import {GensetMultiPicker} from './GensetMultiPicker';

/** `YYYY-MM-DD` in local time, what a date input holds. */
const localDate = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/**
 * A date input's value as a timestamp. Today is *now*, so a deployment starting today
 * opens as deployed rather than as planned until midday; any other day is midday, so
 * a time zone cannot move it to the day before.
 */
const isoFromDate = (value: string): string | null => {
  if (value === '') return null;
  if (value === localDate(new Date())) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
};

type Location = {siteId: string; pin: DeploymentPin | null};

/** Where the address page's map opens before an address is set. */
const KUALA_LUMPUR = {latitude: 3.1478, longitude: 101.6953};

const STEPS = ['Details', 'Customer', 'Location', 'Team'] as const;

/** A page's first field, which it opens on: the job type's first button, or an input. */
const FIRST_FIELD = '[role="radio"], input, textarea, button[role="combobox"]';

/**
 * Where the form is: one dot per page, the current one filled. Any page can be clicked
 * to go to, filled in or not (2026-10-01); a page left with something missing shows a
 * red mark, a finished one a tick.
 */
const Steps = ({
  step,
  seen,
  incomplete,
  onGo,
}: {
  step: number;
  /** The furthest page opened so far: the marks only judge pages somebody has been on. */
  seen: number;
  incomplete: ReadonlyArray<boolean>;
  onGo: (step: number) => void;
}) => (
  <ol aria-label="Steps" className="flex items-center gap-2 text-sm">
    {STEPS.map((name, index) => {
      const current = index === step;
      const visited = index <= seen && !current;
      const missing = visited && incomplete[index];
      return (
        <li key={name} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-default" />}
          <button
            type="button"
            aria-current={current ? 'step' : undefined}
            aria-label={missing ? `${name}, something missing` : undefined}
            onClick={() => onGo(index)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 outline-none hover:bg-hover',
              'focus-visible:ring-[1px] focus-visible:ring-brand',
              current ? 'font-medium text-primary' : visited ? 'text-primary' : 'text-tertiary',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-5 items-center justify-center rounded-full border text-xs',
                current && 'border-brand bg-brand text-brand-text',
                visited && !missing && 'border-brand text-brand',
                missing && 'border-severity-critical text-severity-critical',
                !current && !visited && 'border-default',
              )}
            >
              {missing ? '!' : visited ? <CheckIcon className="size-3" /> : index + 1}
            </span>
            {name}
          </button>
        </li>
      );
    })}
  </ol>
);

/** A button that is off for a reason, with the reason on hover. */
const BlockedButton = ({
  reasons,
  variant,
  onClick,
  children,
}: {
  reasons: Array<string>;
  variant?: 'outline';
  onClick: () => void;
  children: ReactNode;
}) =>
  reasons.length === 0 ? (
    <Button size="sm" variant={variant} onClick={onClick}>
      {children}
    </Button>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-outline"
        >
          <Button size="sm" variant={variant} disabled>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-64 flex-col gap-0.5">
        {reasons.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );

const Field = ({
  label,
  htmlFor,
  info,
  required = false,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  info?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
        {label}
        {required && <span className="text-severity-critical"> *</span>}
      </label>
      {info !== undefined && <InfoTip label={label}>{info}</InfoTip>}
    </span>
    {children}
    {hint !== undefined && <p className="text-xs text-secondary">{hint}</p>}
  </div>
);

/**
 * The form behind `New deployment` (2026-09-30), in pages since 2026-10-01: Details
 * (job type, ID, dates, gensets), Customer (who hired them, and their site contacts),
 * Location (the address on a large map), and Team: the crew and a first note, both optional. Pages can be left half done and come back to; only
 * Create is held until everything required is in, and the booking can be created from
 * Location without visiting Team. Closing with anything
 * typed asks before discarding it.
 */
const NewDeploymentForm = ({
  onDone,
  discarding,
  onDiscardingChange,
  onDirtyChange,
}: {
  onDone: () => void;
  /** Showing "Discard this deployment?" in the footer. Held by the dialog, which asks on close. */
  discarding: boolean;
  onDiscardingChange: (discarding: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const ids = useId();
  const navigate = useNavigate();
  const session = useSession();
  const fleet = useFleet();

  // On an estate with request numbers the ID is the customer's ERQ/PRQ, so it starts empty.
  const [initialReference] = useState(() => (WORK === undefined ? nextReference() : ''));
  const [reference, setReference] = useState(initialReference);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(0);
  const go = (next: number) => {
    setStep(next);
    setSeen((at) => Math.max(at, next));
  };
  const pageRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => localDate(new Date()));
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [gensetIds, setGensetIds] = useState<Array<string>>([]);
  const [contacts, setContacts] = useState<Array<DeploymentContact>>([]);
  const [note, setNote] = useState('');
  const [pickedJobType, setPickedJobType] = useState<string | null>(null);
  const [crew, setCrew] = useState<Array<DeploymentCrewMember>>([]);

  const jobType = WORK === undefined ? null : effectiveJobType(WORK, reference, pickedJobType);

  // An ERQ or PRQ fills in its issuer, TNB, and so does Standby on one of their
  // numbers. The customer is only ever the form's own fill, so a customer somebody
  // picked is never overwritten, and clearing the request takes it back out.
  const [clientFilled, setClientFilled] = useState(false);
  const issuer =
    WORK?.jobTypes.find((type) => type.id === jobType)?.clientId ??
    (WORK === undefined ? undefined : jobTypeOf(WORK, reference)?.clientId);
  useEffect(() => {
    if (issuer !== undefined && (clientId === null || clientFilled)) {
      setClientId(issuer);
      setClientFilled(true);
    } else if (issuer === undefined && clientFilled) {
      setClientId(null);
      setClientFilled(false);
    }
    // Follows the job type only; the customer is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuer]);
  const pickJobType = (id: string) => {
    setPickedJobType(id);
    const type = WORK?.jobTypes.find((each) => each.id === id);
    // A request type puts its letters on the ID and keeps the digits typed.
    if (WORK !== undefined && type?.prefix !== undefined) {
      setReference(withPrefix(WORK, reference, type.prefix));
    }
  };
  const [referenceLeft, setReferenceLeft] = useState(false);
  const badShape =
    WORK === undefined || reference === '' ? undefined : referenceProblem(WORK, reference);

  const site = location === null ? undefined : siteSeed(location.siteId);
  const position =
    location?.pin ??
    (site === undefined ? undefined : {latitude: site.latitude, longitude: site.longitude});

  const startsAt = isoFromDate(startDate);
  const dates: DeploymentBooking = {
    id: 'draft',
    reference,
    siteId: location?.siteId ?? '',
    locationLabel: '',
    startsAt: startsAt ?? new Date().toISOString(),
    endsAt: isoFromDate(endDate),
  };

  const busy = gensetIds.filter((id) => conflictFor(id, dates) !== undefined);
  const plate = (id: string) => {
    const genset = fleet.find((each) => each.id === id);
    return genset === undefined ? id : gensetLabel(genset);
  };

  const missing = [
    WORK !== undefined && reference.trim() === '' && 'a deployment ID',
    WORK !== undefined && jobType === null && 'a job type',
    startsAt === null && 'a start date',
    gensetIds.length === 0 && 'at least one genset',
  ].filter((item): item is string => item !== false);
  const endBeforeStart = dates.endsAt !== null && startsAt !== null && dates.endsAt <= startsAt;
  const taken = reference.trim() !== '' && referenceTaken(reference);
  // What keeps each page from being done, in the words its disabled button shows.
  const detailsBlockers = [
    missing.length > 0 && `Add ${missing.join(', ')}.`,
    badShape !== undefined && `Deployment ID: ${badShape}`,
    taken && `${reference.trim()} is already used by another deployment.`,
    endBeforeStart && 'The planned end date must be after the start date.',
    busy.length > 0 &&
      `${busy.map(plate).join(', ')} ${busy.length === 1 ? 'is' : 'are'} booked over these dates.`,
  ].filter((item): item is string => item !== false);
  const customerBlockers = clientId === null ? ['Add a customer.'] : [];
  const locationBlockers = location === null ? ['Add an address.'] : [];
  // Pages can be left unfinished, so what blocks Create says which page it is on.
  const blockers = [
    ...detailsBlockers.map((line) => `Details: ${line}`),
    ...customerBlockers.map((line) => `Customer: ${line}`),
    ...locationBlockers.map((line) => `Location: ${line}`),
  ];

  // Each page opens on its first field.
  useEffect(() => {
    pageRef.current?.scrollTo({top: 0});
    pageRef.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
  }, [step]);

  const dirty =
    reference !== initialReference ||
    clientId !== null ||
    location !== null ||
    startDate !== today ||
    endDate !== '' ||
    gensetIds.length > 0 ||
    contacts.length > 0 ||
    pickedJobType !== null ||
    crew.length > 0 ||
    note.trim() !== '';

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const place = (pin: DeploymentPin) =>
    setLocation({siteId: nearestSiteId(pin.latitude, pin.longitude) ?? '', pin});

  const {move: moveOnMap, lookingUp} = usePinLookup(place);

  const create = () => {
    if (blockers.length > 0 || location === null || startsAt === null || clientId === null) return;
    const body = note.trim();
    const deployment = createDeployment({
      siteId: location.siteId,
      startsAt,
      endsAt: dates.endsAt,
      reference: reference.trim() === '' ? undefined : reference.trim(),
      particulars: {
        clientId,
        contacts,
        pin: location.pin,
        jobType,
        crew: crew.filter((member) => member.name !== ''),
        notes:
          body === '' || session === null
            ? []
            : [
                {
                  id: `note-${Date.now()}`,
                  authorEmail: session.email,
                  authorName: sessionName(session),
                  createdAt: new Date().toISOString(),
                  editedAt: null,
                  body,
                },
              ],
      },
    });
    for (const gensetId of gensetIds) addGenset(deployment.id, gensetId);
    onDone();
    void navigate({
      to: '/deployments/$deploymentId',
      params: {deploymentId: deployment.id},
    });
  };

  const client = clientById(clientId);

  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle>New deployment</DialogTitle>
        <DialogDescription>
          Fields marked <span className="text-severity-critical">*</span> are required. Everything
          else can be changed later in Settings.
        </DialogDescription>
      </div>

      <Steps
        step={step}
        seen={seen}
        incomplete={[
          detailsBlockers.length > 0,
          customerBlockers.length > 0,
          locationBlockers.length > 0,
          false,
        ]}
        onGo={go}
      />

      <div
        ref={pageRef}
        className="-mx-1 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-1"
      >
        {step === 0 && (
          <>
            {WORK !== undefined && (
              <Field
                label="Job type"
                htmlFor={`${ids}-job-type`}
                required
                info="ERQ is an emergency request and PRQ a planned one; the ID's letters follow the pick. Standby is standby cover on an ERQ or PRQ request, and keeps the ID as it is."
              >
                <JobTypePicker work={WORK} value={jobType} onChange={pickJobType} />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Deployment ID"
                htmlFor={`${ids}-reference`}
                required={WORK !== undefined}
                // With request numbers the checker below says what is wrong, rule by rule.
                hint={
                  WORK === undefined && taken ? 'Already used by another deployment.' : undefined
                }
                info={
                  WORK === undefined
                    ? "Filled in with the next number. You can change it, for example to the customer's work-order number."
                    : 'The ERQ or PRQ request number: three letters and seven digits, e.g. ERQ0065692. Its letters set the job type.'
                }
              >
                <Input
                  id={`${ids}-reference`}
                  value={reference}
                  placeholder={WORK === undefined ? undefined : 'ERQ0065692'}
                  aria-invalid={taken || (referenceLeft && badShape !== undefined) || undefined}
                  onChange={(event) =>
                    setReference(
                      WORK === undefined
                        ? event.target.value
                        : cleanReference(WORK, event.target.value),
                    )
                  }
                  onBlur={() => setReferenceLeft(true)}
                />
                {WORK !== undefined && reference !== '' && (
                  <ReferenceChecker
                    work={WORK}
                    reference={reference}
                    finished={referenceLeft}
                    taken={taken}
                  />
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Start date"
                htmlFor={`${ids}-starts`}
                required
                info="Today or earlier opens the deployment as Deployed and moves its gensets now. A later date books them as Planned."
              >
                <DateInput id={`${ids}-starts`} value={startDate} onChange={setStartDate} />
              </Field>
              <Field
                label="Planned end date"
                htmlFor={`${ids}-ends`}
                info="Leave it empty if there's no planned end."
              >
                <DateInput
                  id={`${ids}-ends`}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={setEndDate}
                />
              </Field>
            </div>

            <Field
              label="Gensets"
              htmlFor="new-deployment-gensets"
              required
              info="Gensets already booked over these dates are greyed out. Once the address is set, the nearest come first."
            >
              <GensetMultiPicker
                selected={gensetIds}
                onChange={setGensetIds}
                dates={dates}
                origin={position}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field
              label="Customer"
              htmlFor={`${ids}-client`}
              required
              hint={
                clientFilled
                  ? `Filled in for ${WORK?.jobTypes.find((type) => type.id === jobType)?.label ?? 'this job type'}. You can change it.`
                  : undefined
              }
              info="The company that hired the gensets."
            >
              <SearchSelect
                id={`${ids}-client`}
                query={clientQuery}
                onQueryChange={setClientQuery}
                searchPlaceholder="Search customers"
                placeholder="Choose a customer"
                selectedId={clientId ?? undefined}
                value={
                  client === undefined ? null : (
                    <span className="block truncate">{client.name}</span>
                  )
                }
                groups={[
                  {
                    options: DEPLOYMENT_CLIENTS.filter(
                      (each) => clientQuery.trim() === '' || includes(each.name, clientQuery),
                    ).map((each) => ({id: each.id, label: each.name})),
                    status: 'No matching customers',
                  },
                ]}
                onSelect={(option) => {
                  setClientId(option.id);
                  setClientFilled(false);
                }}
              />
            </Field>

            <SettingsContacts contacts={contacts} onChange={setContacts} />
          </>
        )}

        {step === 2 && (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-1.5">
              <label htmlFor={`${ids}-address`} className="text-sm font-medium text-primary">
                Address<span className="text-severity-critical"> *</span>
              </label>
              <InfoTip label="Address">
                Type an address or coordinates and pick the suggestion, or move the map until the
                pin sits where the gensets stand. Whichever you do last sets the address.
              </InfoTip>
            </span>
            <AddressField
              id={`${ids}-address`}
              address={location?.pin?.address ?? site?.address ?? null}
              onPick={place}
            />
            <PinMap
              latitude={(position ?? KUALA_LUMPUR).latitude}
              longitude={(position ?? KUALA_LUMPUR).longitude}
              zoom={position === undefined ? 11 : undefined}
              movable
              onMove={moveOnMap}
              className="mt-1.5 min-h-64 flex-1"
            />
            <p
              aria-live="polite"
              className="mt-1.5 flex min-h-9 items-center gap-2 rounded-md border border-subtle bg-canvas px-3 py-1.5 text-sm"
            >
              <MapPinIcon aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
              {lookingUp ? (
                <span className="text-secondary">Looking up the address at the pin…</span>
              ) : location === null ? (
                <span className="text-tertiary">
                  Search above, or move the map to put the pin on the spot
                </span>
              ) : (
                <span className="truncate">{location.pin?.address ?? site?.address}</span>
              )}
            </p>
          </div>
        )}

        {step === 3 && (
          <>
            {WORK !== undefined && <CrewEditor work={WORK} crew={crew} onChange={setCrew} />}

            <Field
              label="First note"
              htmlFor={`${ids}-note`}
              info="Optional. Posted to the deployment's notes, signed with your name."
            >
              <textarea
                id={`${ids}-note`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Access, fuel drops, what the customer asked for"
                className="min-h-20 w-full rounded-md border border-default bg-element px-3 py-2 text-sm text-primary shadow-xs outline-none placeholder:text-tertiary focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand"
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-subtle pt-4">
        {discarding ? (
          <>
            <span className="mr-auto text-sm text-secondary">Discard this deployment?</span>
            <Button variant="ghost" size="sm" onClick={() => onDiscardingChange(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" size="sm" onClick={onDone}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              onClick={() => (dirty ? onDiscardingChange(true) : onDone())}
            >
              Cancel
            </Button>
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => go(step - 1)}>
                Back
              </Button>
            )}
            {step === 2 && (
              <BlockedButton reasons={blockers} variant="outline" onClick={create}>
                Create now
              </BlockedButton>
            )}
            {step < STEPS.length - 1 && (
              <Button size="sm" onClick={() => go(step + 1)}>
                Next
              </Button>
            )}
            {step === STEPS.length - 1 && (
              <BlockedButton reasons={blockers} onClick={create}>
                Create deployment
              </BlockedButton>
            )}
          </>
        )}
      </div>
    </>
  );
};

/** The toolbar's `New deployment` button and the dialog it opens. */
export const NewDeploymentButton = () => {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const close = () => {
    setOpen(false);
    setDirty(false);
    setDiscarding(false);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        New deployment
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Escape or a click outside: close if nothing was typed, else ask first.
          if (next) setOpen(true);
          else if (dirty) setDiscarding(true);
          else close();
        }}
      >
        <DialogContent
          // One height for all four pages, so the buttons stay put; a long page scrolls.
          className="h-[min(780px,90vh)] max-w-[672px] gap-5"
          // Start in the first field. Radix would focus the first (i), which opens its
          // tooltip and makes the first Escape close that instead of the dialog.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLElement>(FIRST_FIELD)?.focus();
          }}
        >
          {open && (
            <NewDeploymentForm
              onDone={close}
              discarding={discarding}
              onDiscardingChange={setDiscarding}
              onDirtyChange={setDirty}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
