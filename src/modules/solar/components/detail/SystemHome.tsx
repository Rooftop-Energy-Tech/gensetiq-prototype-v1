import {useState} from 'react';
import type {FormEvent} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {stampDate} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SolarTodayChart} from '@/modules/site/components/SolarTodayChart';
import {useSession} from '@/modules/auth/session';
import {addSystemNote, systemActivityLog, useSystemNotes} from '../../data/systemActivity';
import {systemHealth} from '../../data/systemHealth';
import type {SystemDetail} from '../../data/systemDetail';
import type {SolarSystem} from '../../types/system.type';
import {InverterList} from './InverterList';
import {SystemActivityFeed} from './SystemActivityFeed';
import {SystemHealth} from './SystemHealth';
import {SystemStateSummary} from './SystemStateSummary';

/**
 * A solar system's home page — four bands, separated by rules.
 *
 * ## The order is the genset page's order, and that is the point
 *
 * `GensetHome` states it: the bands are the order the questions get asked, and
 * the whole page rests on that decision. A PV system is a different machine and
 * the questions turn out to be the same four:
 *
 *  1. **What is it making, and how much has it made.** Output, today's energy,
 *     and the day's curve against the system's own recent normal. Everything here
 *     is cumulative or slow-moving — still true if you looked away for an hour.
 *  2. **What is it made of, and what is each part doing.** The inverters.
 *  3. **What is wrong.** The rules, and the numbers behind them.
 *  4. **What has happened to it.** The feed, newest first.
 *
 * ## Band 2 is a list, where a genset's is a control pad
 *
 * This is the one place the parallel breaks, and it breaks for a real reason. A
 * genset is *one machine* — its controls and its live dials belong on its own
 * page because there is nowhere else for them to be. A solar system is a small
 * power station: at a tower it is one inverter, at SESB's largest mini-grid it is
 * ten, and "the DC current" has no answer there. So the dials and the pad live on
 * each box's page and this band is the list that points at them, which is exactly
 * what `SiteHome` does with its genset rows.
 *
 * It stays a list at one inverter. A band that inlined the dials whenever there
 * happened to be a single box would change shape with the data, and a screen that
 * looks different depending on what is at the site teaches a reader that they
 * cannot trust what they learned last time.
 *
 * ## At phone width
 *
 * The bands survive intact and stack, for the reason the genset page needed no
 * mobile rewrite: **the reading order is already vertical.** The inverter table
 * scrolls sideways inside its own band rather than pushing the page, which is the
 * one thing on here that cannot reflow.
 */

/** First light and last, the hours `hybrid.ts` builds every solar day between. */
const FIRST_LIGHT = 7;
const LAST_LIGHT = 19;

export const SystemHome = ({
  system,
  detail,
  now,
}: {
  system: SolarSystem;
  detail: SystemDetail;
  now: number;
}) => {
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const daylight = hour >= FIRST_LIGHT && hour <= LAST_LIGHT;
  const live = system.state === 'GENERATING';
  const reporting = system.state !== 'OFFLINE';

  const {alerts, condition} = systemHealth(system, detail, now);

  const notes = useSystemNotes();
  const activity = systemActivityLog(
    system,
    detail,
    notes.filter((note) => note.systemId === system.id),
    now,
  );

  const session = useSession();
  const [noteDraft, setNoteDraft] = useState('');

  const handleLogNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addSystemNote(system.id, noteDraft, session?.email ?? 'operator');
    setNoteDraft('');
  };

  const kwh = (value: number): string => `${Math.round(value).toLocaleString('en-MY')} kWh`;

  /**
   * Today's figures are the plant's, so a system nobody can hear has none.
   *
   * An em dash rather than `0 kWh`, which is a different claim: zero says the
   * system made nothing, and what is actually known is that nobody heard it.
   * `systemDetail` already refuses to publish the model's day here; this is the
   * same refusal said out loud in the cell.
   */
  const reported = (value: string): string => (reporting ? value : '—');

  const yieldReading = detail.readings.find((one) => one.key === 'specific-yield');

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 md:pb-6">
      {/* Band 1 — the state, the day's figures, and the day's curve.
          A column below `md` rather than a wrapping row, the trade `GensetHome`
          makes for its run and tank: at 390px both halves *can* squeeze onto one
          line once they are allowed to shrink, and the result is two narrow
          columns with the labels truncated away. */}
      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2.5 p-3 md:min-w-[420px] md:flex-row md:items-center">
          <SystemStateSummary state={system.state} outputKw={system.outputKw} />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border border-subtle bg-element px-3 py-3">
            <MetricRow
              label="Generated so far today"
              value={reported(kwh(detail.today.generatedKwh))}
            />
            {/* Today's whole day, not a forecast of tomorrow. `todayFullKwh` is
                what has arrived divided by the share of the day that has passed,
                so at nine in the morning it is an extrapolation and says so by
                being labelled *on course for* rather than *will make*. */}
            <MetricRow label="On course for" value={reported(kwh(detail.today.fullDayKwh))} />
            {/* kWh per kWp, and not a performance ratio — `systemDetail` carries
                the long version. On this estate a nameplate-relative *ratio* reads
                thirty points below the design's own, because both the design and
                the measurement are capped at what the tower can absorb and these
                systems are deliberately bigger than that. */}
            <MetricRow
              label="Specific yield today"
              value={reported(`${(yieldReading?.value ?? 0).toFixed(2)} kWh/kWp`)}
            />
            {/* The operational figure, not the annual one — three closed months.
                `solarRecent` explains the choice: a system that failed in March is
                at 92% for the year, which is inside the P90 band and invisible to
                any annual test while the fault is present and costing diesel. */}
            <MetricRow
              label="Against design, three months"
              value={`${Math.round(detail.share * 100)}% of P50`}
            />
          </div>
        </div>

        {/* The curve, and the system's **own recent normal** behind it — never the
            design. `SolarPoint` makes the argument: an own-baseline answers "has
            this thing changed", a benchmark answers "is it meeting what it was
            sold as", and the second only exists monthly. Drawing a P50 at
            half-hourly resolution would be the interpolation the whole benchmark
            rule exists to prevent. */}
        <div className="flex min-w-[17rem] flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-medium text-primary">Today</span>
            <span className="text-xs text-secondary tabular-nums">
              {reporting ? (
                <>
                  {live && `${system.outputKw} kW now · `}
                  {kwh(detail.today.generatedKwh)} so far
                </>
              ) : (
                `no readings since ${stampDate(system.lastUpdated)}`
              )}
            </span>
          </div>
          <SolarTodayChart points={detail.today.points} />
        </div>
      </div>

      <hr className="border-subtle" />

      {/* Band 2 — the boxes. */}
      <div className="py-2">
        <InverterList system={system} alerts={alerts} now={now} />
      </div>

      <hr className="border-subtle" />

      {/* Band 3 — what is wrong, and the numbers behind it. Every rule, including
          the ones that name a box: this is the page somebody opens to find out
          whether anything needs doing, and making them read six inverter pages to
          answer that would be the register's mistake repeated one level down. */}
      <SystemHealth
        alerts={alerts}
        condition={condition}
        readings={detail.readings}
        daylight={daylight}
        reporting={reporting}
        lastUpdated={system.lastUpdated}
        now={now}
        heading="The system's own figures"
      />

      <hr className="border-subtle" />

      {/* Band 4 — what the system has been through. Last, because it is the page's
          only backwards-looking band, which is where `GensetHome` puts its own. */}
      <section className="flex max-w-xl flex-col gap-3">
        <h3 className="text-sm font-medium text-primary">Activity</h3>
        {/* The feed's manual inlet. Everything else in it is derived from a fact
            drawn elsewhere on this page; this is the one line a person types — a
            monkey on the fence, a shaded corner at four o'clock — and it files
            under their own name. */}
        <form onSubmit={handleLogNote} className="flex items-center gap-2">
          <Input
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Log an entry against this system"
            aria-label="Log an entry against this system"
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={noteDraft.trim() === ''}>
            Log
          </Button>
        </form>
        <SystemActivityFeed activity={activity} now={now} />
      </section>
    </div>
  );
};
