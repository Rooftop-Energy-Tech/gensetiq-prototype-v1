import {useState} from 'react';
import {PlusIcon, StarIcon, TrashIcon} from 'lucide-react';

import {InfoTip, LockTip} from '@/components/global/InfoTip';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {DeploymentContact} from '../../types/deployment.type';

const FIELDS = [
  {key: 'name', label: 'Name', type: 'text'},
  {key: 'role', label: 'Role', type: 'text'},
  {key: 'phone', label: 'Phone', type: 'tel'},
  {key: 'email', label: 'Email', type: 'email'},
] as const;

/** One text field that commits on blur or Enter, the page's rule for text. */
const ContactField = ({
  label,
  type,
  value,
  disabled,
  lockedReason,
  onCommit,
}: {
  label: string;
  type: string;
  value: string;
  disabled: boolean;
  lockedReason: string | undefined;
  onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-secondary">{label}</span>
      <LockTip reason={lockedReason}>
        <Input
          type={type}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft.trim();
            if (next !== value) onCommit(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(value);
          }}
        />
      </LockTip>
    </label>
  );
};

/**
 * The people to call at the customer's end. Exactly one is primary once there are
 * any, and that one is what the overview and the side panel show.
 */
export const SettingsContacts = ({
  contacts,
  onChange,
  readOnly = false,
  lockedReason,
}: {
  contacts: Array<DeploymentContact>;
  /** The whole list after an edit: Settings writes it to the store, the new-deployment form to its draft. */
  onChange: (contacts: Array<DeploymentContact>) => void;
  readOnly?: boolean;
  /** Why the fields are greyed out, when they are. */
  lockedReason?: string;
}) => {
  const save = onChange;

  const edit = (id: string, change: Partial<DeploymentContact>) =>
    save(contacts.map((contact) => (contact.id === id ? {...contact, ...change} : contact)));

  const remove = (id: string) => {
    const rest = contacts.filter((contact) => contact.id !== id);
    // Removing the primary hands the star to whoever is now first.
    if (rest.length > 0 && !rest.some((contact) => contact.primary)) {
      rest[0] = {...rest[0]!, primary: true};
    }
    save(rest);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-primary">Site contacts</span>
          <InfoTip label="Site contacts">
            People to call about this deployment. The starred contact is the primary one, shown on
            the overview page and the side panel.
          </InfoTip>
        </span>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              save([
                ...contacts,
                {
                  id: `contact-${Date.now()}`,
                  name: '',
                  role: '',
                  phone: '',
                  email: '',
                  primary: contacts.length === 0,
                },
              ])
            }
          >
            <PlusIcon aria-hidden="true" />
            Add contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-md border border-dashed border-subtle px-4 py-5 text-center text-sm text-secondary">
          No site contacts yet.
        </p>
      ) : (
        <ul className="@container flex flex-col gap-2">
          {/* Sized by the list's own width, not the viewport: the same rows sit full
              width in Settings and in the narrower new-deployment dialog. */}
          {contacts.map((contact) => (
            <li
              key={contact.id}
              aria-label={contact.name || 'New contact'}
              className="flex items-end gap-2 rounded-md border border-subtle bg-element p-3"
            >
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 @sm:grid-cols-2 @4xl:grid-cols-4">
                {FIELDS.map((field) => (
                  <ContactField
                    key={field.key}
                    label={field.label}
                    type={field.type}
                    value={contact[field.key]}
                    disabled={readOnly}
                    lockedReason={lockedReason}
                    onCommit={(value) => edit(contact.id, {[field.key]: value})}
                  />
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={readOnly}
                      aria-pressed={contact.primary}
                      aria-label={contact.primary ? 'Primary contact' : 'Make primary contact'}
                      onClick={() =>
                        save(contacts.map((each) => ({...each, primary: each.id === contact.id})))
                      }
                    >
                      <StarIcon
                        aria-hidden="true"
                        className={cn(
                          contact.primary
                            ? 'fill-severity-warning text-severity-warning'
                            : 'text-tertiary',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {contact.primary ? 'Primary contact' : 'Make primary'}
                  </TooltipContent>
                </Tooltip>
                {!readOnly && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${contact.name || 'contact'}`}
                        onClick={() => remove(contact.id)}
                      >
                        <TrashIcon aria-hidden="true" className="text-secondary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
