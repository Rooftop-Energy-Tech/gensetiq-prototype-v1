import {useState} from 'react';
import {PaperclipIcon, PlusIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {SITE_SEED} from '@/modules/site/data/siteSeed';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import {logService} from '../../data/services';

/**
 * Today and now, as the values an `<input type="date">` and `type="time"` want.
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
    <span className="text-sm text-primary">{label}</span>
    {children}
    {hint !== undefined && <span className="text-xs text-secondary">{hint}</span>}
  </label>
);

/**
 * The form for recording a service that has been done.
 *
 * ## What it asks for, and what it doesn't
 *
 * Six fields, and every one of them is either a counter input or one of the four
 * facts the history displays. The twenty-eight checklist items, the phase
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
}: {
  genset: Genset;
  currentEngineHours: number;
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const now = new Date();
  const [siteId, setSiteId] = useState(genset.siteId ?? '');
  const [date, setDate] = useState(localDate(now));
  const [time, setTime] = useState(localTime(now));
  const [technician, setTechnician] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    const fresh = new Date();
    setSiteId(genset.siteId ?? '');
    setDate(localDate(fresh));
    setTime(localTime(fresh));
    setTechnician('');
    setHours('');
    setNotes('');
    setFile(null);
    setError(undefined);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const engineHours = Number(hours);
    if (hours.trim() === '' || Number.isNaN(engineHours)) {
      setError('Enter the hour-meter reading. Both counters measure from it, so a service without one cannot reset them.');
      return;
    }

    logService({
      gensetId: genset.id,
      siteId,
      performedAt: new Date(`${date}T${time}`).toISOString(),
      technicianName: technician.trim() === '' ? 'Unrecorded' : technician.trim(),
      engineHoursAtService: engineHours,
      file,
      notes,
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
        <Button size="sm">
          <PlusIcon aria-hidden="true" />
          Log a service
        </Button>
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Log a service</DialogTitle>
        <DialogDescription className="mt-1">
          {gensetName(genset)} · attach the completed checklist. The app displays the site,
          technician, date and machine; the sheet holds the rest.
        </DialogDescription>

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[180px] flex-1">
              <Field label="Site" hint="Where the work was done — stored as it is now.">
                <select
                  value={siteId}
                  onChange={(event) => setSiteId(event.target.value)}
                  className="h-9 w-full rounded-md border border-default bg-element px-3 text-sm text-primary outline-none focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand"
                >
                  {genset.siteId === null && <option value="">Depot — not deployed</option>}
                  {SITE_SEED.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="min-w-[180px] flex-1">
              <Field label="Technician">
                <Input
                  value={technician}
                  onChange={(event) => setTechnician(event.target.value)}
                  placeholder="Name on the sheet"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="min-w-[140px] flex-1">
              <Field label="Date">
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
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

            <div className="min-w-[160px] flex-1">
              <Field
                label="Hours at service"
                hint={`Meter now reads ${currentEngineHours.toLocaleString('en-MY')} h.`}
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

          <Field label="Remarks" hint="Optional — the sheet's own remarks line.">
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Refill diesel 600litre & pm genset"
            />
          </Field>

          <Field
            label="Report"
            hint="Held for this browser session only — this prototype stores records, not files."
          >
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
