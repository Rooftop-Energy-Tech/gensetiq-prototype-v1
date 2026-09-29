import {cn} from '@/lib/utils';
import {RUN_STATE_META} from './runStateMeta';
import type {RunState} from '../types/genset.type';

/**
 * A running set's mark: a solid dot with a ring pinging out of it, like a server's
 * "online" light. Added 2026-09-29 — the hollow circle it replaces read the same
 * whether the engine had been turning for a week or had stopped a second ago.
 *
 * It takes `currentColor`, so the caller's text colour sets its hue: the badges'
 * `text-status-running` blue, or the page header pill's own tone. The motion is
 * decoration — the word beside it already says `Running` — so it is switched off
 * under `prefers-reduced-motion` (see `.run-ping` in `styles.css`).
 */
export const RunningPulse = ({className, large = false}: {className?: string; large?: boolean}) => (
  <span
    aria-hidden="true"
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center',
      large ? 'size-4' : 'size-3',
      className,
    )}
  >
    <span className={cn('run-ping absolute rounded-full bg-current', large ? 'size-2.5' : 'size-2')} />
    <span className={cn('relative rounded-full bg-current', large ? 'size-2.5' : 'size-2')} />
  </span>
);

/**
 * The run state's glyph wherever a badge draws one — the pulse while running, the
 * state's own icon otherwise — so every Running badge in the app moves the same way.
 */
export const RunStateIcon = ({runState, className}: {runState: RunState; className?: string}) => {
  const {icon: Icon, iconClassName} = RUN_STATE_META[runState];
  if (runState === 'RUNNING') return <RunningPulse className={cn(iconClassName, className)} />;
  return <Icon className={cn(iconClassName, className)} aria-hidden="true" />;
};
