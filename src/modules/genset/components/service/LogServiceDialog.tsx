import {useState} from 'react';
import {CheckIcon, PaperclipIcon, PlusIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {DateInput} from '@/components/ui/date-input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {figure} from '@/lib/format';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import {logService, scheduleOf} from '../../data/services';

/**
 * Today and now, as the values `DateInput` and an `<input type="time">` want.
 *
 * Local, not UTC. `toISOString().slice(0, 10)` is the tempting one-liner and it
 * is wrong by a day for anyone west of Greenwich in the evening — the form
 * should open on the date on the technician's watch.
 */
const localDate = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

const localTime = (at: Date): string =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-primary">{label}</span>
    {children}
    {hint !== undefined && <span className="text-xs text-secondary">{hint}</span>}
  </label>
);

/**
 * The form for recording a service that has been done.
 *
 * ## What it asks for, and what it doesn't
 *
 * Every field is either a counter input or one of the facts the history displays.
 * *Work done* is a counter input (2026-10-05): the schedule's items, ticked, and only
 * the ticked ones restart their counters. The twenty-eight checklist items, the phase
 * voltages, the battery readings — none of it is here, because all of it is on
 * the attached sheet and re-keying it into the app would create a second copy
 * that can disagree with the first.
 *
 * ## Why the hour reading is required and nothing else is
 *
 * Because it is the only field the app *computes* from. A record missing its
 * technician is a worse record; a record missing its hour reading cannot reset
 * the run-hour counter at all, so saving one would leave the genset reading
 * overdue immediately after being serviced.
 *
 * ## Why the genset is shown and not chosen
 *
 * The dialog opens from one genset's page. Offering a picker would let somebody
 * file a service against the machine they are not looking at, which is a mistake
 * with no upside — the fleet-wide entry point is a different screen, and this
 * prototype does not have one yet.
 */
export const LogServiceDialog = ({
  genset,
  currentEngineHours,
  compact = false,
  itemId,
}: {
  genset: Genset;
  currentEngineHours: number;
  /**
   * A small outline trigger for a table row — the fleet service page's — rather
   * than the Service tab's primary button. The dialog behind it is the same.
   */
  compact?: boolean;
  /**
   * One schedule item to mark done: the trigger is that row's `Mark done`, and the
   * form opens with only that item ticked (Jeff, 2026-10-05). Absent, none is.
   */
  itemId?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const now = new Date();
  const [date, setDate] = useState(localDate(now));
  const [time, setTime] = useState(localTime(now));
  const [technician, setTechnician] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const items = scheduleOf(genset.id).items;
  // Nothing ticked to start with (Jeff, 2026-10-05) — or the one item a row's
  // `Mark done` opened it for.
  const preset = () => (itemId === undefined ? [] : [itemId]);
  const [done, setDone] = useState<Array<string>>(preset);

  const reset = () => {
    const fresh = new Date();
    setDate(localDate(fresh));
    setTime(localTime(fresh));
    setTechnician('');
    setHours('');
    setNotes('');
    setFile(null);
    setDone(preset());
    setError(undefined);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const engineHours = Number(hours);
    if (hours.trim() === '' || Number.isNaN(engineHours)) {
      setError('Enter the run hours at service.');
      return;
    }
    if (done.length === 0) {
      setError('Tick at least one item.');
      return;
    }

    logService({
      gensetId: genset.id,
      // Where the set stands now, or the depot: no longer asked (Jeff, 2026-10-05).
      siteId: genset.siteId ?? '',
      performedAt: new Date(`${date}T${time}`).toISOString(),
      technicianName: technician.trim() === '' ? 'Unrecorded' : technician.trim(),
      engineHoursAtService: engineHours,
      file,
      notes,
      // In the schedule's order, whatever order they were ticked in.
      itemIds: items.filter((item) => done.includes(item.id)).map((item) => item.id),
    });

    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {itemId !== undefined ? (
          <Button
            size="xs"
            variant="outline"
            aria-label={`Mark ${items.find((item) => item.id === itemId)?.name ?? 'item'} done`}
          >
            <CheckIcon aria-hidden="true" />
            Mark done
          </Button>
        ) : compact ? (
          <Button size="xs" variant="outline" aria-label={`Log a service for ${gensetName(genset)}`}>
            <PlusIcon aria-hidden="true" />
            Log service
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon aria-hidden="true" />
            Log service
          </Button>
        )}
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Log a service</DialogTitle>
        {/* The genset alone: the form's explanatory lines came off (Jeff, 2026-10-05). */}
        <DialogDescription className="mt-1">{gensetName(genset)}</DialogDescription>

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[180px] flex-1">
              <Field label="Technician">
                <Input
                  value={technician}
                  onChange={(event) => setTechnician(event.target.value)}
                  placeholder="Name"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="min-w-[140px] flex-1">
              <Field label="Date">
                <DateInput value={date} onChange={setDate} />
              </Field>
            </div>

            <div className="min-w-[120px] flex-1">
              <Field label="Time">
                <Input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* A line of its own (Jeff, 2026-10-05), under the date and time. */}
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[160px] flex-1">
              <Field
                label="Run hours at service"
                hint={`Meter now reads ${figure(currentEngineHours)} h.`}
              >
                <Input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={hours}
                  onChange={(event) => {
                    setHours(event.target.value);
                    setError(undefined);
                  }}
                  placeholder="1208.7"
                  aria-invalid={error !== undefined}
                />
              </Field>
            </div>
          </div>

          {/* What was done (2026-10-05): only the ticked items restart their
              counters; the rest keep counting from their own last service. */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium text-primary">
              Work done
              <button
                type="button"
                className="text-xs font-normal text-brand hover:text-primary"
                onClick={() => setDone(done.length === items.length ? [] : items.map((item) => item.id))}
              >
                {done.length === items.length ? 'Clear all' : 'Tick all'}
              </button>
            </legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {items.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-brand"
                    checked={done.includes(item.id)}
                    onChange={(event) => {
                      setDone(
                        event.target.checked ? [...done, item.id] : done.filter((candidate) => candidate !== item.id),
                      );
                      setError(undefined);
                    }}
                  />
                  {/* The item's remark under its name, so the technician sees the
                      grade or part number while ticking it. */}
                  <span className="flex min-w-0 flex-col">
                    {item.name}
                    {item.remarks !== undefined && <span className="text-xs text-secondary">{item.remarks}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Remarks">
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Refill diesel 600litre & pm genset"
            />
          </Field>

          <Field label="Report">
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <PaperclipIcon aria-hidden="true" />
                  {file === null ? 'Attach PDF' : 'Replace PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </Button>
              {file !== null && (
                <span className="min-w-0 truncate text-xs text-secondary">{file.name}</span>
              )}
            </div>
          </Field>

          {error !== undefined && (
            <p className="text-sm text-severity-critical" role="alert">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm">
              Save service
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
