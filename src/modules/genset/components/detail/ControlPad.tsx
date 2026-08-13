import {PlayIcon, PointerIcon, SettingsIcon, SquareIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {ControlMode} from '../../types/telemetry.type';
import type {RunState} from '../../types/genset.type';

/**
 * One control tile.
 *
 * `active` is what the corner dot reports, and it means different things for the
 * two kinds of tile: for a mode it means "this is the mode we are in", for an
 * action it means "this action is available". Same affordance either way — a lit
 * dot is a thing you can act on or a thing that is already true — which is why
 * the design gives all four the same treatment.
 */
const Tile = ({
  icon: Icon,
  label,
  tileClassName,
  iconClassName,
  active,
  disabled,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tileClassName: string;
  iconClassName: string;
  active: boolean;
  disabled: boolean;
  hint: string;
  onClick?: () => void;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-default bg-element px-2 pt-3 pb-2.5 transition-colors',
          // 55% rather than the usual disabled 50%: a START tile has to stay
          // legible as *the teal one* even when it can't be pressed, or the pad
          // reads as broken instead of as unavailable.
          disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-highlight',
          'focus-visible:ring-[3px] focus-visible:ring-outline focus-visible:outline-none',
        )}
      >
        <span
          className={cn('flex size-8 items-center justify-center rounded-md', tileClassName)}
        >
          <Icon className={cn('size-[18px]', iconClassName)} aria-hidden="true" />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.6px] text-primary">{label}</span>
        <span
          className={cn(
            'absolute top-[7px] left-[7px] size-[7px] rounded-full',
            active ? 'bg-teal' : 'bg-tertiary',
          )}
        />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{hint}</TooltipContent>
  </Tooltip>
);

/**
 * MANUAL / START / AUTO / STOP — the four things an operator can press.
 *
 * The left column is the **mode**, the right column is an **action**, and the
 * relationship between them is the whole reason the pad is laid out as a 2 × 2.
 * In `AUTO` the controller owns the decision: it starts on a mains failure and
 * stops when mains returns, and a person reaching for START would be fighting it.
 * So START and STOP are live only in `MANUAL`, and within `MANUAL` only the one
 * that would change something is enabled — you cannot start a running set.
 *
 * Mode switching works. START and STOP are deliberately inert: this prototype has
 * no controller behind it, and a button that appears to crank a diesel engine and
 * silently does nothing is worse than one that says so. The tooltip says so.
 */
export const ControlPad = ({
  runState,
  mode,
  onModeChange,
}: {
  runState: RunState;
  mode: ControlMode;
  onModeChange: (mode: ControlMode) => void;
}) => {
  const manual = mode === 'MANUAL';
  const running = runState === 'RUNNING';
  const reachable = runState !== 'OFFLINE';

  return (
    <div className="grid h-[170px] w-[220px] shrink-0 grid-cols-2 gap-5">
      <Tile
        icon={PointerIcon}
        label="MANUAL"
        tileClassName={manual ? 'bg-teal/16' : 'bg-highlight'}
        iconClassName={manual ? 'text-teal' : 'text-primary'}
        active={manual}
        disabled={!reachable}
        hint={manual ? 'Under manual control' : 'Take manual control'}
        onClick={() => onModeChange('MANUAL')}
      />
      <Tile
        icon={PlayIcon}
        label="START"
        tileClassName="bg-teal"
        iconClassName="text-white"
        active={manual && reachable && !running}
        disabled={!manual || !reachable || running}
        hint={
          running
            ? 'Already running'
            : manual
              ? 'Start command — not wired in this prototype'
              : 'Switch to MANUAL to start by hand'
        }
      />
      <Tile
        icon={SettingsIcon}
        label="AUTO"
        tileClassName={manual ? 'bg-highlight' : 'bg-teal/16'}
        iconClassName={manual ? 'text-primary' : 'text-teal'}
        active={!manual}
        disabled={!reachable}
        hint={manual ? 'Hand control back to the controller' : 'Controller has control'}
        onClick={() => onModeChange('AUTO')}
      />
      <Tile
        icon={SquareIcon}
        label="STOP"
        tileClassName="bg-severity-critical"
        iconClassName="text-white"
        active={manual && reachable && running}
        disabled={!manual || !reachable || !running}
        hint={
          running
            ? manual
              ? 'Stop command — not wired in this prototype'
              : 'Switch to MANUAL to stop by hand'
            : 'Already stopped'
        }
      />
    </div>
  );
};
