import {useState} from 'react';
import {PlusIcon, Trash2Icon} from 'lucide-react';

import {REGISTER_FRAME, REGISTER_ROWS, REGISTER_TABLE, REGISTER_TH} from '@/components/global/registerTable';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {figure, numericDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import {calendarDueDate, counterOvershoot} from '../../types/service.type';
import type {ItemStatus, ServiceCounter, ServiceSchedule} from '../../types/service.type';
import {setSchedule} from '../../data/services';
import type {Genset} from '../../types/genset.type';
import {LogServiceDialog} from './LogServiceDialog';
import {SERVICE_SEVERITY_META} from './serviceMeta';

/**
 * The schedule, as a setting rather than a readout: the items this genset is
 * serviced on, each on its own interval.
 *
 * ## A list of items, as a car's book has (Jeff, 2026-10-05)
 *
 * Oil every 250 h or 6 months, coolant every 2,000 h or two years, the battery
 * every two years however much the set runs. Each row is one item: its name, its
 * hour interval, its month interval — either may be blank, not both — and when it
 * is next due, counted from the last service that did it. Items can be renamed,
 * removed and added; a genset keeps at least one. Each row's *Mark done* opens the
 * Log service form with only that item ticked. Each has a *Remarks* field for a
 * standing note — the oil grade, a part number. It was one pair of intervals for
 * the whole set until then.
 *
 * ## Why it is editable per genset
 *
 * Because the shipped intervals are placeholders for the operations team's, and
 * the questions that settle them — does a 1250 kVA set differ from a 250 kVA one,
 * do prime sites differ from standby — are all "this unit is not like the others".
 * Being able to correct one machine without a code change is what lets the
 * prototype be shown to the people who know the answer.
 *
 * Saved per genset, in `localStorage`, as each field is left — there is no Save
 * button (Jeff, 2026-10-05) — and only when changed — a unit that has
 * never been edited keeps following the default, so changing the fleet-wide list
 * later moves it.
 */

/** A row being edited: the intervals as typed, so a half-typed number is not lost. */
type Draft = {id: string; name: string; hours: string; months: string; remarks: string};

const toDrafts = (schedule: ServiceSchedule): Array<Draft> =>
  schedule.items.map((item) => ({
    id: item.id,
    name: item.name,
    hours: item.intervalHours === undefined ? '' : String(item.intervalHours),
    months: item.intervalMonths === undefined ? '' : String(item.intervalMonths),
    remarks: item.remarks ?? '',
  }));

/** Blank is no interval; anything else must be a whole number from 1. */
const parse = (value: string): number | undefined | 'invalid' => {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) || parsed < 1 ? 'invalid' : parsed;
};

const isBlank = (draft: Draft): boolean =>
  [draft.name, draft.hours, draft.months, draft.remarks].every((value) => value.trim() === '');

const rowError = (draft: Draft): string | undefined => {
  const hours = parse(draft.hours);
  const months = parse(draft.months);
  if (draft.name.trim() === '') return 'Name the item.';
  if (hours === 'invalid' || months === 'invalid') return 'Intervals are whole numbers from 1.';
  if (hours === undefined && months === undefined) return 'Give it hours, months or both.';
  return undefined;
};

/** When this counter comes due, in the fleet service page's words. */
const counterDue = (counter: ServiceCounter, status: Extract<ItemStatus, {kind: 'tracked'}>): string => {
  const overshoot = counterOvershoot(counter);
  if (counter.kind === 'hours') {
    const hours = `${figure(Math.round(Math.abs(overshoot)))} h`;
    return overshoot >= 0 ? `${hours} over` : `In ${hours}`;
  }
  const date = numericDate(calendarDueDate(status.lastService, counter.interval).getTime());
  return overshoot >= 0 ? `Was due on ${date}` : `Due on ${date}`;
};

/** The item's next due, read off its binding counter, in its severity's colour. */
const NextDue = ({status}: {status: ItemStatus | undefined}) => {
  // A row added and not yet saved has nothing to count.
  if (status === undefined) return <span className="text-tertiary">—</span>;
  if (status.kind === 'never-serviced') return <span className="text-secondary">First service</span>;
  const counter = status.binding === 'hours' ? status.hours : status.calendar;
  if (counter === undefined) return null;
  return (
    <span className={status.severity === 'OK' ? 'text-primary' : SERVICE_SEVERITY_META[status.severity].textClassName}>
      {counterDue(counter, status)}
    </span>
  );
};

const Th = ({children, align, className}: {children?: React.ReactNode; align?: 'right'; className?: string}) => (
  <th scope="col" className={cn(REGISTER_TH, 'px-3', align === 'right' ? 'text-right' : 'text-left', className)}>
    {children}
  </th>
);

export const ServiceScheduleCard = ({
  genset,
  currentEngineHours,
  schedule,
  items,
}: {
  genset: Genset;
  /** The meter now, for the `Mark done` form's hint. */
  currentEngineHours: number;
  schedule: ServiceSchedule;
  /** Each item's counters, as the hero reads them. */
  items: Array<ItemStatus>;
}) => {
  const gensetId = genset.id;
  // Not re-synced from `schedule` after a save: that would wipe a row added and not
  // yet filled in. The card is keyed by genset, so moving between sets starts fresh.
  const [drafts, setDrafts] = useState<Array<Draft>>(() => toDrafts(schedule));

  // A row is only judged once something is typed in it, so a fresh `Add item` row
  // is not red before the reader has started.
  const errors = drafts.map((draft) => (isBlank(draft) ? undefined : rowError(draft)));

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft) => (draft.id === id ? {...draft, ...patch} : draft)));

  const add = () =>
    setDrafts((current) => [...current, {id: `custom-${Date.now().toString(36)}`, name: '', hours: '', months: '', remarks: ''}]);

  /**
   * Saves itself (Jeff, 2026-10-05) — there is no Save button. Called when a field
   * is left, on Enter, and on a removal. A complete row is stored as typed; an
   * incomplete one keeps its last saved version, or, if it was never saved (an
   * `Add item` row not yet filled in), is not stored at all. Nothing is written
   * when nothing changed.
   */
  const persist = (next: Array<Draft> = drafts) => {
    const items = next.flatMap((draft) => {
      if (rowError(draft) === undefined) {
        const hours = parse(draft.hours);
        const months = parse(draft.months);
        return [
          {
            id: draft.id,
            name: draft.name,
            intervalHours: typeof hours === 'number' ? hours : undefined,
            intervalMonths: typeof months === 'number' ? months : undefined,
            remarks: draft.remarks,
          },
        ];
      }
      const stored = schedule.items.find((item) => item.id === draft.id);
      return stored === undefined ? [] : [stored];
    });
    if (items.length === 0) return;
    if (JSON.stringify(toDrafts({items})) === JSON.stringify(toDrafts(schedule))) return;
    setSchedule(gensetId, {items});
  };

  const remove = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    persist(next);
  };

  const statusOf = (id: string) => items.find((status) => status.item.id === id);

  return (
    <section aria-label="Schedule" className="flex flex-col gap-3">
      <h2 className="text-base font-medium text-primary">Schedule</h2>

      {/* Leaving any field saves, as Enter does (Jeff, 2026-10-05). `onBlur`
          bubbles in React, so one handler covers every input in the table. */}
      <form
        className="flex flex-col gap-3"
        onBlur={() => persist()}
        onSubmit={(event) => event.preventDefault()}
        // Enter leaves the field, and so saves. Cancel and Save came off when the
        // card began saving itself (Jeff, 2026-10-05).
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            event.target.blur();
          }
        }}
      >
        <div className={cn('overflow-x-auto', REGISTER_FRAME)}>
          <table className={cn(REGISTER_TABLE, REGISTER_ROWS)}>
            <caption className="sr-only">Service items, their intervals, when each is next due and remarks</caption>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Every (h)</Th>
                <Th>Every (months)</Th>
                <Th>Next due</Th>
                <Th>Remarks</Th>
                <Th className="w-px">
                  <span className="sr-only">Mark done</span>
                </Th>
                <Th className="w-px">
                  <span className="sr-only">Remove</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft, index) => (
                <tr key={draft.id}>
                  <td className="min-w-[200px] px-3 py-2">
                    <Input
                      value={draft.name}
                      onChange={(event) => update(draft.id, {name: event.target.value})}
                      placeholder="e.g. Coolant hoses"
                      aria-label="Item name"
                      aria-invalid={errors[index] !== undefined && draft.name.trim() === ''}
                    />
                  </td>
                  <td className="w-[130px] px-3 py-2">
                    {/* `step={1}`, not a rounder 10: `step` is a validity constraint,
                        and with `min={1}` a step of 10 would reject an ordinary 250. */}
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={draft.hours}
                      onChange={(event) => update(draft.id, {hours: event.target.value})}
                      placeholder="—"
                      aria-label={`Run hours between services of ${draft.name || 'this item'}`}
                    />
                  </td>
                  <td className="w-[130px] px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={draft.months}
                      onChange={(event) => update(draft.id, {months: event.target.value})}
                      placeholder="—"
                      aria-label={`Months between services of ${draft.name || 'this item'}`}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {errors[index] !== undefined ? (
                      <span className="text-severity-critical">{errors[index]}</span>
                    ) : (
                      <NextDue status={statusOf(draft.id)} />
                    )}
                  </td>
                  <td className="min-w-[220px] px-3 py-2">
                    <Input
                      value={draft.remarks}
                      onChange={(event) => update(draft.id, {remarks: event.target.value})}
                      placeholder="e.g. 15W-40, part no. 1R-0739"
                      aria-label={`Remarks for ${draft.name || 'this item'}`}
                    />
                  </td>
                  {/* The Log service form with only this item ticked. Not on a row
                      not yet saved: the item does not exist until it is complete. */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {statusOf(draft.id) !== undefined && (
                      <LogServiceDialog genset={genset} currentEngineHours={currentEngineHours} itemId={draft.id} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={drafts.length === 1}
                      onClick={() => remove(draft.id)}
                      aria-label={`Remove ${draft.name || 'this item'}`}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add item
          </Button>
        </div>
      </form>
    </section>
  );
};
