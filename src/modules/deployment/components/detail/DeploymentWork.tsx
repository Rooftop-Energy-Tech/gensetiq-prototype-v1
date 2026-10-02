import {useState} from 'react';
import {CheckIcon, CircleIcon, PlusIcon, TrashIcon, XIcon} from 'lucide-react';

import {DATASET} from '@/brands';
import type {DeploymentWork} from '@/brands';
import {InfoTip, LockTip} from '@/components/global/InfoTip';
import {SearchSelect} from '@/components/global/SearchSelect';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {deployments} from '../../data/store';
import type {DeploymentCrewMember} from '../../types/deployment.type';
import {includes} from './addressSearch';

/**
 * Job type and crew, on an estate whose deployments carry them (2026-10-01): the
 * new-deployment form and Settings both render these, and neither does when the
 * estate has no `work` vocabulary.
 */

/**
 * What is typed into the ID, tidied: capitals, and no spaces, dashes or slashes. A few
 * characters past the right length are kept, so the checker can say there are too
 * many rather than the box silently eating them.
 */
export const cleanReference = (work: DeploymentWork, typed: string): string =>
  typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3 + work.referenceDigits + 3);

/** The request types' letters, `['ERQ', 'PRQ']`: the only ways a reference may start. */
export const requestPrefixes = (work: DeploymentWork): Array<string> =>
  work.jobTypes.flatMap((type) => (type.prefix === undefined ? [] : [type.prefix]));

/** `1st`, `2nd`, `3rd`, `4th` … — which character of the ID a check is about. */
const nth = (position: number): string => {
  const tens = position % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[position % 10] ?? 'th');
  return `${position}${suffix}`;
};

/** The letters people type where they meant a digit, and the digit they meant. */
const LOOKALIKE: Record<string, string> = {
  O: '0',
  D: '0',
  Q: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  B: '8',
  G: '6',
};

/** A check's state: met, not yet (still typing), or wrong. */
export type CheckStatus = 'ok' | 'todo' | 'bad';
export type ReferenceCheck = {label: string; status: CheckStatus; detail?: string};

/**
 * The ID's rules, each with whether the typed ID meets it and, when it does not,
 * exactly what is wrong (2026-10-01): which character, and what it should be. With
 * `finished` (the box has been left) a check still waiting on more typing is wrong.
 */
export const referenceChecks = (
  work: DeploymentWork,
  reference: string,
  finished: boolean,
): Array<ReferenceCheck> => {
  const prefixes = requestPrefixes(work);
  const either = prefixes.join(' or ');
  const digits = work.referenceDigits;
  const letters = reference.slice(0, 3);
  const unfinished: CheckStatus = finished ? 'bad' : 'todo';

  let lettersCheck: ReferenceCheck;
  const firstDigit = [...letters].findIndex((char) => /\d/.test(char));
  if (prefixes.includes(letters)) {
    lettersCheck = {label: `Starts with ${either}`, status: 'ok'};
  } else if (firstDigit !== -1) {
    lettersCheck = {
      label: `Starts with ${either}`,
      status: 'bad',
      detail: `The ${nth(firstDigit + 1)} character is the digit ${letters[firstDigit]}. The ID starts with three letters, ${either}.`,
    };
  } else if (letters.length < 3 && prefixes.some((prefix) => prefix.startsWith(letters))) {
    lettersCheck = {
      label: `Starts with ${either}`,
      status: unfinished,
      detail: finished ? `“${letters}” is not finished: use ${either}.` : undefined,
    };
  } else {
    const anagram = prefixes.find(
      (prefix) => [...prefix].sort().join('') === [...letters].sort().join(''),
    );
    lettersCheck = {
      label: `Starts with ${either}`,
      status: 'bad',
      detail:
        anagram === undefined
          ? `It starts with “${letters}”. Use ${either}.`
          : `It starts with “${letters}”. Did you mean ${anagram}?`,
    };
  }

  const tail = reference.slice(3);
  const stray = [...tail].findIndex((char) => !/\d/.test(char));
  let digitsCheck: ReferenceCheck;
  if (stray !== -1) {
    const char = tail[stray] as string;
    const meant = LOOKALIKE[char];
    digitsCheck = {
      label: `Then ${digits} digits`,
      status: 'bad',
      detail: `The ${nth(stray + 4)} character is the letter ${char}${meant === undefined ? '' : `, not the number ${meant}`}. After the letters it is digits only.`,
    };
  } else if (tail.length === digits) {
    digitsCheck = {label: `Then ${digits} digits`, status: 'ok'};
  } else if (tail.length > digits) {
    const extra = tail.length - digits;
    digitsCheck = {
      label: `Then ${digits} digits`,
      status: 'bad',
      detail: `There are ${tail.length} digits; it needs ${digits}. Remove ${extra}.`,
    };
  } else {
    digitsCheck = {
      label: `Then ${digits} digits`,
      status: unfinished,
      detail: finished
        ? `There ${tail.length === 1 ? 'is' : 'are'} only ${tail.length} digit${tail.length === 1 ? '' : 's'}; it needs ${digits} (${digits - tail.length} more).`
        : `${tail.length} of ${digits} so far`,
    };
  }
  return [lettersCheck, digitsCheck];
};

/** Why a reference is not a request type's letters and the estate's digits, if it is not. */
export const referenceProblem = (work: DeploymentWork, reference: string): string | undefined => {
  const failed = referenceChecks(work, reference, true).find((check) => check.status !== 'ok');
  return failed === undefined ? undefined : (failed.detail ?? failed.label);
};

const CHECK_ICON: Record<CheckStatus, typeof CheckIcon> = {
  ok: CheckIcon,
  todo: CircleIcon,
  bad: XIcon,
};
const CHECK_TONE: Record<CheckStatus, string> = {
  ok: 'text-severity-ok',
  todo: 'text-tertiary',
  bad: 'text-severity-critical',
};

/**
 * The ID's rules under the box, ticked off as it is typed (2026-10-01), so a wrong ID
 * says which rule it breaks and where rather than only that it is wrong. `taken`
 * adds the last rule, that no other deployment has the ID.
 */
export const ReferenceChecker = ({
  work,
  reference,
  finished,
  taken,
}: {
  work: DeploymentWork;
  reference: string;
  finished: boolean;
  taken: boolean;
}) => {
  const checks = referenceChecks(work, reference, finished);
  const shaped = checks.every((check) => check.status === 'ok');
  const all: Array<ReferenceCheck> = [
    ...checks,
    {
      label: 'Not used by another deployment',
      status: taken ? 'bad' : shaped ? 'ok' : 'todo',
      detail: taken ? `${reference} is already used by another deployment.` : undefined,
    },
  ];
  return (
    <ul aria-label="Deployment ID checks" aria-live="polite" className="flex flex-col gap-0.5">
      {all.map((check) => {
        const Icon = CHECK_ICON[check.status];
        return (
          <li key={check.label} className="flex items-start gap-1.5 text-[13px]">
            <Icon
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-3.5 shrink-0',
                CHECK_TONE[check.status],
                check.status === 'todo' && 'size-3',
              )}
            />
            <span className={check.status === 'bad' ? 'text-severity-critical' : 'text-secondary'}>
              <span className="sr-only">
                {check.status === 'ok'
                  ? 'Done: '
                  : check.status === 'bad'
                    ? 'Problem: '
                    : 'To do: '}
              </span>
              {check.status === 'ok' || check.detail === undefined ? check.label : check.detail}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/** The request type a reference names by its prefix: `ERQ0065692` is an ERQ. */
export const jobTypeOf = (work: DeploymentWork, reference: string) => {
  const upper = reference.trim().toUpperCase();
  return work.jobTypes.find((type) => type.prefix !== undefined && upper.startsWith(type.prefix));
};

/** ERQ, PRQ or Standby, as a row of buttons. */
export const JobTypePicker = ({
  work,
  value,
  onChange,
  disabled = false,
}: {
  work: DeploymentWork;
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) => (
  <div role="radiogroup" aria-label="Job type" className="flex gap-2">
    {work.jobTypes.map((type) => {
      const checked = value === type.id;
      return (
        <button
          key={type.id}
          type="button"
          role="radio"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(type.id)}
          className={cn(
            'h-9 flex-1 cursor-pointer rounded-md border px-3 text-sm shadow-xs outline-none',
            'focus-visible:ring-[1px] focus-visible:ring-brand',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked
              ? 'border-brand bg-brand text-brand-text'
              : 'border-default bg-element text-primary hover:bg-highlight',
          )}
        >
          {type.label}
        </button>
      );
    })}
  </div>
);

/**
 * The job type a reference and a pick come to. A request type follows the ID, so
 * the two cannot disagree; a type without a prefix (Standby) is picked over it.
 */
export const effectiveJobType = (
  work: DeploymentWork,
  reference: string,
  picked: string | null,
): string | null => {
  const pickedType = work.jobTypes.find((type) => type.id === picked);
  if (pickedType !== undefined && pickedType.prefix === undefined) return pickedType.id;
  return jobTypeOf(work, reference)?.id ?? picked;
};

/** The ID with a request type's letters in front of whatever digits it has. */
export const withPrefix = (work: DeploymentWork, reference: string, prefix: string): string =>
  cleanReference(work, prefix + reference.replace(/\D/g, ''));

/** The estate's roster, then anyone typed onto an earlier deployment. */
const roster = (work: DeploymentWork): Array<string> => {
  const names = new Set(work.crew);
  for (const deployment of deployments()) {
    for (const member of deployment.crew) if (member.name !== '') names.add(member.name);
  }
  return [...names];
};

const NamePicker = ({
  id,
  name,
  names,
  disabled,
  onPick,
}: {
  id: string;
  name: string;
  names: Array<string>;
  disabled: boolean;
  onPick: (name: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const matches = names.filter((each) => typed === '' || includes(each, typed));
  const isNew = typed !== '' && !names.some((each) => each.toLowerCase() === typed.toLowerCase());
  return (
    <SearchSelect
      id={id}
      disabled={disabled}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Search or type a name"
      placeholder="Choose a name"
      selectedId={name === '' ? undefined : `name:${name}`}
      value={name === '' ? null : <span className="block truncate">{name}</span>}
      groups={[
        {
          options: [
            ...matches.map((each) => ({id: `name:${each}`, label: each})),
            ...(isNew ? [{id: `new:${typed}`, label: `Add “${typed}”`}] : []),
          ],
          status: 'Type a name to add it',
        },
      ]}
      onSelect={(option) => onPick(option.id.slice(option.id.indexOf(':') + 1))}
    />
  );
};

/**
 * Who goes out on the lorry: a row per person, each a role and a name. Optional,
 * since a booking made the night before may not know its crew yet. Two workers or
 * no chargeman are both fine; the report's four roles are what Add crew offers first.
 */
export const CrewEditor = ({
  work,
  crew,
  onChange,
  readOnly = false,
  lockedReason,
}: {
  work: DeploymentWork;
  crew: Array<DeploymentCrewMember>;
  onChange: (crew: Array<DeploymentCrewMember>) => void;
  readOnly?: boolean;
  lockedReason?: string;
}) => {
  const names = roster(work);
  const edit = (id: string, change: Partial<DeploymentCrewMember>) =>
    onChange(crew.map((member) => (member.id === id ? {...member, ...change} : member)));

  const add = () => {
    const unfilled = work.crewRoles.find((role) => !crew.some((member) => member.role === role));
    onChange([
      ...crew,
      {id: `crew-${Date.now()}`, role: unfilled ?? work.crewRoles[0] ?? '', name: ''},
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-primary">Crew</span>
          <InfoTip label="Crew">
            Who goes out with the lorry: {work.crewRoles.join(', ').toLowerCase()}. Optional, and
            can be filled in later in Settings.
          </InfoTip>
        </span>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add crew
          </Button>
        )}
      </div>

      {crew.length === 0 ? (
        <p className="rounded-md border border-dashed border-subtle px-4 py-5 text-center text-sm text-secondary">
          No crew yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {crew.map((member) => (
            <li
              key={member.id}
              aria-label={member.name === '' ? member.role : `${member.role}, ${member.name}`}
              className="flex items-center gap-2"
            >
              <LockTip reason={lockedReason}>
                <div className="w-40 shrink-0">
                  <SearchSelect
                    disabled={readOnly}
                    query=""
                    onQueryChange={() => {}}
                    searchPlaceholder="Role"
                    selectedId={member.role}
                    value={<span className="block truncate">{member.role}</span>}
                    groups={[{options: work.crewRoles.map((role) => ({id: role, label: role}))}]}
                    onSelect={(option) => edit(member.id, {role: option.id})}
                  />
                </div>
              </LockTip>
              <LockTip reason={lockedReason}>
                <div className="min-w-0 flex-1">
                  <NamePicker
                    id={`${member.id}-name`}
                    name={member.name}
                    names={names}
                    disabled={readOnly}
                    onPick={(name) => edit(member.id, {name})}
                  />
                </div>
              </LockTip>
              {!readOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.name || member.role}`}
                      onClick={() => onChange(crew.filter((each) => each.id !== member.id))}
                    >
                      <TrashIcon aria-hidden="true" className="text-secondary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** The active estate's job types and crew vocabulary, or `undefined` where it has none. */
export const WORK = DATASET.work;
