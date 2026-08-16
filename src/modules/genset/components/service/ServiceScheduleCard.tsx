import {useEffect, useState} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {ServiceSchedule} from '../../types/service.type';
import {setSchedule} from '../../data/services';

/**
 * The interval, as a setting rather than a readout.
 *
 * ## Why the derived figures that used to sit here are gone
 *
 * This band used to also show the engine hours now, the hours at the last
 * service and the date of it — the arithmetic behind the counters. All three
 * were already on the page: the counters above state the subtraction's *result*,
 * and the history table below carries the hour reading and the date of every
 * service including the newest. Repeating them in the middle made the tab longer
 * without answering a question the reader still had.
 *
 * What is left is the one thing on this tab that is genuinely a *setting* — a
 * decision somebody makes, rather than a fact the machine reports.
 *
 * ## Why it is editable per genset
 *
 * Because the shipped `250 h / 6 months` is a placeholder for an answer the
 * operations team has not given yet, and the questions that settle it — does a
 * 1250 kVa set differ from a 250 kVa one, do prime sites differ from standby —
 * are all "this unit is not like the others". Being able to correct one machine
 * without a code change is what lets the prototype be shown to the people who
 * know the answer.
 *
 * Saved per genset, in `localStorage`, and only when changed — a unit that has
 * never been edited keeps following the default, so raising the fleet-wide
 * number later moves it.
 */
export const ServiceScheduleCard = ({
  gensetId,
  schedule,
}: {
  gensetId: string;
  schedule: ServiceSchedule;
}) => {
  const [hours, setHours] = useState(String(schedule.intervalHours));
  const [months, setMonths] = useState(String(schedule.intervalMonths));

  // Re-sync when the stored schedule changes underneath — including the case
  // that matters, `setSchedule` clamping a 0 the operator typed up to 1. Without
  // this the field would keep showing the rejected value while the counters used
  // the stored one.
  useEffect(() => {
    setHours(String(schedule.intervalHours));
    setMonths(String(schedule.intervalMonths));
  }, [schedule.intervalHours, schedule.intervalMonths]);

  const parsedHours = Number(hours);
  const parsedMonths = Number(months);
  const valid =
    hours.trim() !== '' &&
    months.trim() !== '' &&
    !Number.isNaN(parsedHours) &&
    !Number.isNaN(parsedMonths) &&
    parsedHours >= 1 &&
    parsedMonths >= 1;

  const changed =
    parsedHours !== schedule.intervalHours || parsedMonths !== schedule.intervalMonths;

  return (
    <section aria-label="Schedule" className="flex flex-col gap-3">
      <h2 className="text-base font-medium text-primary">Schedule</h2>

      <form
        className="flex flex-wrap items-end gap-4 rounded-lg border border-default bg-element px-4 py-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !changed) return;
          setSchedule(gensetId, {intervalHours: parsedHours, intervalMonths: parsedMonths});
        }}
      >
        <label className="flex w-[150px] flex-col gap-1.5">
          <span className="text-xs text-secondary">Every</span>
          <div className="flex items-center gap-2">
            {/* `step={1}`, not a rounder 10. `step` is a *validity constraint*,
                not a spinner increment: with `min={1}` and `step={10}` the only
                valid values are 1, 11, 21 … and a perfectly ordinary 250 fails
                constraint validation, which blocks the submit event silently. */}
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              aria-label="Run hours between services"
            />
            <span className="text-sm whitespace-nowrap text-secondary">run hours</span>
          </div>
        </label>

        {/* Not "and". The whole feature is that these are alternatives — the one
            reached first wins — and a label reading "and" would describe a
            schedule where a set is serviced only when both are met, which would
            leave a machine that never runs unserviced forever. */}
        <span className="pb-2 text-sm text-secondary">or</span>

        <label className="flex w-[150px] flex-col gap-1.5">
          <span className="text-xs text-secondary">Every</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              aria-label="Months between services"
            />
            <span className="text-sm whitespace-nowrap text-secondary">months</span>
          </div>
        </label>

        <span className="pb-2 text-sm text-secondary">whichever comes first.</span>

        <Button type="submit" size="sm" variant="outline" disabled={!valid || !changed}>
          Save
        </Button>
      </form>
    </section>
  );
};
