import {PauseIcon, PlayIcon, PowerOffIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {AlertSeverity} from '../../types/alert.type';
import type {RunState} from '../../types/genset.type';

/**
 * The hero glyph, one per run state.
 *
 * Deliberately not the same colours as `RUN_STATE_META`. That set colours a 12px
 * dot inside a neutral pill in a table of twenty-four rows, where the job is to
 * be distinguishable at a glance without turning the table into a traffic light.
 * This is the only thing on the page saying what the machine is doing, and it is
 * set beside the title rather than inside a table — so `RUNNING` takes the teal the
 * design gives it here and the other two keep their state colour. It was a 32px
 * glyph when that argument was written and is 16px now; the argument is about the
 * company it keeps, not the size.
 */
const HERO: Record<RunState, LucideIcon> = {
  RUNNING: PlayIcon,
  IDLE: PauseIcon,
  OFFLINE: PowerOffIcon,
};

/**
 * The pill's colour: **is it turning, and is anything wrong with it.**
 *
 * A turning set takes the colour of its worst standing alarm — red for a critical,
 * amber for a warning, green for nothing — so the one chip beside the plate answers
 * both halves of "how is this machine" at a glance, and matches the marks and bars
 * on the cards below, which are coloured off the same alarms.
 *
 * A stopped set is grey whatever it is carrying, and that is the deliberate part. On
 * a machine that is not running, an alarm is history rather than a condition: a
 * coolant shutdown that already stopped the engine is not a fire to run at, and
 * painting a parked set red would put it alongside a turning one that is about to
 * fail. What it is carrying is still one click away on the Alarms tab, and the chip
 * counts sit in the strip directly below this.
 *
 * Tinted rather than filled — `/10` behind `/25` edge, with the hue as ink. The
 * filled treatment in `SEVERITY_META` is for the alarm pill's own cell, where the
 * count is the subject; here the subject is two words of text that have to stay
 * readable at title size.
 */
const TONE: Record<string, string> = {
  CRITICAL: 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical',
  WARNING: 'border-severity-warning/25 bg-severity-warning/10 text-severity-warning',
  OK: 'border-severity-ok/25 bg-severity-ok/10 text-severity-ok',
  STOPPED: 'border-default bg-inset text-secondary',
};

const LABEL: Record<RunState, string> = {
  RUNNING: 'Running',
  IDLE: 'Idle',
  OFFLINE: 'Offline',
};

/**
 * "Running · 418 kW" — beside the machine's plate at the head of the page.
 *
 * It was a 32px glyph over a label in a 113px column, the leftmost thing on the
 * home page's run band, until 2026-09-22. Two things were wrong with that. It was
 * sized as a hero on a page whose hero is the plate above it; and it was **on one
 * tab of eight**, so a reader on Runs or Alarms could not see whether the engine
 * was turning without going back. Beside the title it is on all eight, which is
 * where a fact about the machine rather than about a page belongs.
 *
 * Small enough to sit on a 16px title line: a 16px glyph and the label at the
 * title's own size, with the load following in the secondary tone rather than in a
 * badge. A pill beside a heading reads as a control.
 *
 * The load is present only while the engine is turning. A stopped genset has no
 * load, and "0 kW" would read as a genset running into an open breaker — a real
 * and quite different problem.
 */
export const RunStateSummary = ({
  runState,
  loadKw,
  severity,
}: {
  runState: RunState;
  loadKw: number | null;
  /** The worst alarm standing on this machine, if any. Ignored when it is stopped. */
  severity?: AlertSeverity;
}) => {
  const Icon = HERO[runState];
  const running = runState === 'RUNNING';
  const tone = !running
    ? TONE.STOPPED
    : severity === 'CRITICAL' || severity === 'WARNING'
      ? TONE[severity]
      : TONE.OK;

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold whitespace-nowrap',
        tone,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {LABEL[runState]}
      {loadKw !== null && (
        <>
          {/* The separator and the load take the pill's own ink at reduced weight,
              rather than the page's greys: a secondary grey inside a tinted chip
              reads as a different element sitting in it. */}
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span className="tabular-nums opacity-90">{amount(loadKw, 'kW')}</span>
        </>
      )}
    </span>
  );
};
