import {useEffect, useId, useState} from 'react';
import {useRouter} from '@tanstack/react-router';
import {RotateCcwIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';
import {CUSTOMERS, CUSTOMER_TERM} from '../../data/customers';
import {HAS_PROGRAMS, PROGRAMS} from '../../data/programs';
import {
  resetSiteConfig,
  setSiteCustomer,
  setSiteLatitude,
  setSiteLongitude,
  setSiteName,
  setSiteProgram,
  useSiteConfig,
} from '../../data/siteConfig';

/**
 * The site's identity and placement, as six editable facts.
 *
 * ## What belongs here, and what deliberately doesn't
 *
 * The rule is **givens, not readings**. What a place is called, where it is, whose
 * region it sits in and which rollout filed it are all *statements somebody made
 * about the site*, and somebody can make a different one. What the site draws, what
 * is standing in the yard, what the tanks hold — none of those are here, because
 * they are measurements and the fleet's own membership, and a form that let a
 * reader type a load figure would be inventing a meter reading.
 *
 * The supply is the odd one out and it stays in its own section below. It is a
 * given like the rest, but it is the only one that changes what the page *draws*
 * rather than what it *says*, so it gets the space to explain itself — see
 * `SiteSettings`.
 *
 * ## Why the two pickers apply on change and the three text fields don't
 *
 * A `<select>` has no half-finished state: every value it can hold is a value
 * somebody chose, so committing on change is exactly as honest as the power-role
 * radios beside it. A text field does — `5.` and `-` are both real keystrokes on
 * the way to a real coordinate, and committing per keystroke would put the pin at
 * 5°N and then at 0°N while somebody types 5.9804. So those commit on blur or
 * Enter, revert on Escape, and say so.
 *
 * ## There is still no Save button
 *
 * The section's stance is the tab's, for the tab's reason: there is no backend to
 * save to, a Save button would imply a round-trip and a rollback that do not exist,
 * and the honest version is a control that visibly takes effect and a line of text
 * saying where the value went. What replaces Save is **Reset** — which is
 * meaningful here in a way Save is not, because the dataset's own row is a real
 * thing to go back to.
 */

/** The mark on a field a reader has moved off the dataset's value. */
const EditedMark = () => (
  <span className="rounded-sm bg-highlight px-1.5 py-0.5 text-[11px] leading-4 font-medium text-secondary">
    Edited
  </span>
);

const FieldShell = ({
  label,
  htmlFor,
  edited,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  edited: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) => (
  <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} className="text-sm text-primary">
        {label}
      </label>
      {edited && <EditedMark />}
    </div>
    {children}
    {error != null ? (
      <span className="text-xs text-severity-critical">{error}</span>
    ) : (
      hint !== undefined && <span className="text-xs text-secondary">{hint}</span>
    )}
  </div>
);

/**
 * A field whose value is only worth reading once it is finished being typed.
 *
 * `draft` is component state and `value` is the store's, and the `useEffect` is
 * what re-synchronises them when the store moves underneath — a Reset, or the same
 * site edited in another tab. Without it, Reset would put the store back and leave
 * the old text sitting in the box.
 *
 * `commit` returns the reason a value was refused, or `null` for accepted. A
 * refused value **stays in the field** with the reason under it rather than
 * snapping back: somebody who typed `95` into a latitude wants to fix the 9, not
 * retype the whole thing. The store is unchanged either way, so what the page draws
 * never reflects a value this rejected.
 */
const CommittedField = ({
  label,
  hint,
  value,
  edited,
  commit,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  edited: boolean;
  commit: (raw: string) => string | null;
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'>) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const apply = () => setError(commit(draft.trim()));

  return (
    <FieldShell label={label} htmlFor={id} edited={edited} hint={hint} error={error}>
      <Input
        {...input}
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
          if (event.key === 'Escape') {
            setDraft(value);
            setError(null);
          }
        }}
        className={cn(error != null && 'border-severity-critical')}
      />
    </FieldShell>
  );
};

const SelectField = ({
  label,
  hint,
  value,
  edited,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  value: string;
  edited: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => {
  const id = useId();

  return (
    <FieldShell label={label} htmlFor={id} edited={edited} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-default bg-element px-3 text-sm text-primary shadow-xs outline-none focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand"
      >
        {children}
      </select>
    </FieldShell>
  );
};

/**
 * The value `<option>` uses for "in no programme".
 *
 * An empty string, because that is the one thing `<option value>` cannot hold as a
 * real id — every programme id in a dataset is a non-empty slug, so there is no
 * collision to guard. It maps to `null` at the store, which is a *choice* and not
 * an absent key; see `SiteOverride.program`.
 */
const NO_PROGRAM = '';

/**
 * Signed decimal degrees, in range, or the reason it isn't.
 *
 * Both bounds are checked rather than just the parse, because the failure this is
 * really guarding is a **transposed pair** — 116.07, 5.98 instead of 5.98, 116.07 —
 * and a longitude typed into the latitude field is the one wrong value that is
 * still a perfectly good number. Latitude cannot exceed 90, so half of every
 * transposition is caught for free.
 */
const parseDegrees = (raw: string, limit: number, axis: string): number | string => {
  if (raw === '') return `A ${axis} is required.`;

  const value = Number(raw);
  if (!Number.isFinite(value)) return `${raw} is not a number.`;
  if (Math.abs(value) > limit) return `A ${axis} runs from −${limit} to ${limit}.`;

  return value;
};

export const SiteIdentityPanel = ({siteId}: {siteId: string}) => {
  const {config, seeded, changed, isChanged} = useSiteConfig(siteId);
  const headingId = useId();

  /**
   * The breadcrumb is loader data, and a rename has to reach it.
   *
   * `/sites/$siteId`'s loader reads the seed to produce the crumb, and a loader runs
   * on navigation — so renaming a site here leaves `SWK-1163` in the trail above
   * while every other reference on the page says the new name. That reads as a bug
   * even though nothing is wrong with the store.
   *
   * Invalidating from the component that made the change is the narrow fix. The
   * alternative is teaching the override store to reach the router, which would put
   * a routing dependency underneath every data module that reads a site.
   *
   * Only the name needs it. The crumb is the only loader-derived value on this
   * section's surface, and moving a pin or refiling a programme does not appear in
   * it.
   */
  const router = useRouter();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-sm font-medium text-primary">
            Identity and placement
          </h2>
          <p className="max-w-2xl text-sm text-secondary">
            What this site is called, where it stands, and which{' '}
            {CUSTOMER_TERM.toLowerCase()} and programme it belongs to. These are the
            site's own facts — what it draws and what is standing in the yard are read
            from the incomer and the fleet, and are not editable here.
          </p>
        </div>

        {/* Only once something has actually moved. A Reset that is always available
            invites the reader to wonder what it would undo, and on a fresh site the
            answer is nothing. */}
        {isChanged && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSiteConfig(siteId);
              // Reset can restore the name too, so the crumb has to be re-derived
              // here for the same reason it does on a rename.
              void router.invalidate();
            }}
          >
            <RotateCcwIcon aria-hidden="true" />
            Reset to {seeded.name}
          </Button>
        )}
      </div>

      <div className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <CommittedField
            label="Site name"
            hint={`The label the header, the breadcrumb and every list use. Dataset: ${seeded.name}.`}
            value={config.name}
            edited={changed.name !== undefined}
            maxLength={40}
            commit={(raw) => {
              if (raw === '') return 'A site needs a name.';
              setSiteName(siteId, raw);
              void router.invalidate();
              return null;
            }}
          />

          <SelectField
            label={CUSTOMER_TERM}
            hint="Where the site sits. The sun hours every solar figure here is built from come with it."
            value={config.customer}
            edited={changed.customer !== undefined}
            onChange={(next) => setSiteCustomer(siteId, next)}
          >
            {CUSTOMERS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </SelectField>
        </div>

        {HAS_PROGRAMS && (
          <SelectField
            label="Programme"
            hint="A grouping, and only a grouping — nothing on any screen is derived from it."
            value={config.program ?? NO_PROGRAM}
            edited={changed.program !== undefined}
            onChange={(next) => setSiteProgram(siteId, next === NO_PROGRAM ? null : next)}
          >
            <option value={NO_PROGRAM}>Unassigned — in no programme</option>
            {PROGRAMS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.shortName} — {entry.blurb}
              </option>
            ))}
          </SelectField>
        )}

        <div className="flex flex-wrap gap-4">
          <CommittedField
            label="Latitude"
            hint={`Signed decimal degrees, north positive. Dataset: ${seeded.latitude}.`}
            value={String(config.latitude)}
            edited={changed.latitude !== undefined}
            inputMode="decimal"
            commit={(raw) => {
              const parsed = parseDegrees(raw, 90, 'latitude');
              if (typeof parsed === 'string') return parsed;
              setSiteLatitude(siteId, parsed);
              return null;
            }}
          />

          <CommittedField
            label="Longitude"
            hint={`Signed decimal degrees, east positive. Dataset: ${seeded.longitude}.`}
            value={String(config.longitude)}
            edited={changed.longitude !== undefined}
            inputMode="decimal"
            commit={(raw) => {
              const parsed = parseDegrees(raw, 180, 'longitude');
              if (typeof parsed === 'string') return parsed;
              setSiteLongitude(siteId, parsed);
              return null;
            }}
          />
        </div>
      </div>

      <p className="text-[13px] leading-[18px] text-secondary">
        The text fields take effect when you leave them or press Enter; Escape puts back
        what was there. Saved in this browser only — this prototype has no backend, so
        nothing here reaches an asset register and a colleague opening {seeded.name} sees
        the estate's own values.
      </p>
    </section>
  );
};
