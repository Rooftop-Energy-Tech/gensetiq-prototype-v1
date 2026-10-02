import {useState} from 'react';
import {PencilIcon, TrashIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {sessionName, useSession} from '@/modules/auth/session';
import {updateDeployment} from '../../data/store';
import type {Deployment, DeploymentNote} from '../../types/deployment.type';

const TEXTAREA =
  'min-h-20 w-full rounded-md border border-default bg-element px-3 py-2 text-sm text-primary shadow-xs outline-none placeholder:text-tertiary focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand';

/** Who wrote it and when, the line above every note here and on the overview. */
export const NoteByline = ({note}: {note: DeploymentNote}) => (
  <p className="text-xs text-secondary">
    <span className="font-medium text-primary">{note.authorName}</span>
    {' · '}
    {stampAt(note.createdAt)}
    {note.editedAt !== null && ' · edited'}
  </p>
);

/**
 * The deployment's log, newest first. Anyone can post; only a note's author can
 * edit or delete it, matched on the session's email.
 */
export const SettingsNotes = ({
  deployment,
  readOnly,
}: {
  deployment: Deployment;
  readOnly: boolean;
}) => {
  const session = useSession();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{id: string; body: string} | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const save = (notes: Array<DeploymentNote>) => updateDeployment(deployment.id, {notes});

  const post = () => {
    const body = draft.trim();
    if (body === '' || session === null) return;
    save([
      ...deployment.notes,
      {
        id: `note-${Date.now()}`,
        authorEmail: session.email,
        authorName: sessionName(session),
        createdAt: new Date().toISOString(),
        editedAt: null,
        body,
      },
    ]);
    setDraft('');
  };

  const newestFirst = [...deployment.notes].reverse();

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="New note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) post();
            }}
            placeholder="Add a note: access, fuel drops, what the customer asked for"
            className={TEXTAREA}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={draft.trim() === ''} onClick={post}>
              Add note
            </Button>
          </div>
        </div>
      )}

      {newestFirst.length === 0 ? (
        <p className="rounded-md border border-dashed border-subtle px-4 py-5 text-center text-sm text-secondary">
          No notes yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {newestFirst.map((note) => {
            const own = !readOnly && session !== null && note.authorEmail === session.email;
            const isEditing = editing?.id === note.id;
            return (
              <li
                key={note.id}
                className="flex flex-col gap-1.5 rounded-md border border-subtle bg-element px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <NoteByline note={note} />
                  {own && !isEditing && deleting !== note.id && (
                    <div className="-my-1 flex shrink-0 items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Edit note"
                            onClick={() => setEditing({id: note.id, body: note.body})}
                          >
                            <PencilIcon aria-hidden="true" className="text-secondary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Delete note"
                            onClick={() => setDeleting(note.id)}
                          >
                            <TrashIcon aria-hidden="true" className="text-secondary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      aria-label="Edit note"
                      autoFocus
                      value={editing.body}
                      onChange={(event) => setEditing({id: note.id, body: event.target.value})}
                      className={TEXTAREA}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={editing.body.trim() === ''}
                        onClick={() => {
                          save(
                            deployment.notes.map((each) =>
                              each.id === note.id
                                ? {...each, body: editing.body.trim(), editedAt: new Date().toISOString()}
                                : each,
                            ),
                          );
                          setEditing(null);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={cn('text-sm whitespace-pre-wrap text-primary')}>{note.body}</p>
                )}

                {deleting === note.id && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-sm text-secondary">Delete this note?</span>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        save(deployment.notes.filter((each) => each.id !== note.id));
                        setDeleting(null);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
