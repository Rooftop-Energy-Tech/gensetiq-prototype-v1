import {Link} from '@tanstack/react-router';
import {MailIcon, PhoneIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {clientById} from '../data/particulars';
import type {Deployment} from '../types/deployment.type';
import {NoteByline} from './detail/SettingsNotes';

/**
 * Who the deployment is for, who to ring, and the latest word on it (2026-09-30):
 * the customer, the primary contact and the newest note. The same card on the
 * overview page and in the register's side panel. Everything else is in Settings.
 */
export const CustomerCard = ({
  deployment,
  className,
}: {
  deployment: Deployment;
  className?: string;
}) => {
  const client = clientById(deployment.clientId);
  const primary = deployment.contacts.find((contact) => contact.primary);
  const latest = deployment.notes.at(-1);
  const more = deployment.notes.length - 1;

  const toSettings = (
    <Link
      to="/deployments/$deploymentId/settings"
      params={{deploymentId: deployment.id}}
      className="rounded-sm text-secondary underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
    >
      {more === 1 ? '1 more in Settings' : `${more} more in Settings`}
    </Link>
  );

  return (
    <section
      aria-label="Customer"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-subtle bg-element p-3 text-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-secondary">Customer</span>
        <span className="font-medium text-primary">{client?.name ?? 'No customer set'}</span>
      </div>

      {primary !== undefined && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-secondary">Primary contact</span>
          <span className="text-primary">
            {primary.name || 'Unnamed'}
            {primary.role !== '' && <span className="text-secondary"> · {primary.role}</span>}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {primary.phone !== '' && (
              <a
                href={`tel:${primary.phone.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-1.5 rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
              >
                <PhoneIcon className="size-3.5 text-secondary" aria-hidden="true" />
                {primary.phone}
              </a>
            )}
            {primary.email !== '' && (
              <a
                href={`mailto:${primary.email}`}
                className="flex min-w-0 items-center gap-1.5 rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
              >
                <MailIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
                <span className="truncate">{primary.email}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {latest !== undefined && (
        <div className="flex flex-col gap-1 border-t border-subtle pt-3">
          <span className="text-xs text-secondary">Latest note</span>
          <NoteByline note={latest} />
          <p className="line-clamp-3 whitespace-pre-wrap text-primary">{latest.body}</p>
          {more > 0 && <p className="text-xs">{toSettings}</p>}
        </div>
      )}
    </section>
  );
};
