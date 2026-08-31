import {PointerIcon, RotateCcwIcon, SettingsIcon, UnplugIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import type {InverterControlMode, InverterState} from '../../../types/system.type';

/**
 * One control tile — the genset pad's, unchanged.
 *
 * `active` means the same two things it means there, which is why all four tiles
 * take the same treatment: for a mode it is "this is the mode we are in", for an
 * action it is "this action is available".
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
        // `aria-disabled` rather than `disabled`, for the reason the genset pad
        // gives at length: browsers deliver no pointer events to a disabled
        // control, so its tooltip never opens — and on this pad the tooltip is
        // the only thing that says *why* a command is refused.
        aria-disabled={disabled}
        onClick={disabled ? undefined : onClick}
        aria-pressed={active}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-default bg-element px-2 pt-3 pb-2.5 transition-colors',
          disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-highlight',
          'focus-visible:ring-[3px] focus-visible:ring-outline focus-visible:outline-none',
        )}
      >
        <span className={cn('flex size-8 items-center justify-center rounded-md', tileClassName)}>
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
 * MANUAL / RESET / AUTO / ISOLATE — what an engineer can press on one inverter.
 *
 * ## Why this pad is per box and not per system
 *
 * Because a command is issued to a controller, and a system does not have one —
 * it has ten. `RESET` on a plant means nothing; `RESET` on Inverter 4, the one
 * with nine dark strings, is the thing somebody actually wants to try before
 * driving out there.
 *
 * The pad's shape is the genset pad's, because an inverter has exactly the
 * two-column relationship that layout was drawn for: in `AUTO` the box owns the
 * decisions — it tracks the maximum power point, derates itself on a hot
 * afternoon, and retries on its own timer after a fault — and a person reaching
 * for a command would be fighting it. So the actions are live only in `MANUAL`.
 *
 * ## Why these two actions and not a start and a stop
 *
 * `RESET` is the command a technician actually issues to an array: an inverter
 * that has latched a fault sits there until somebody clears it, and clearing it
 * remotely is the difference between a site visit and a click. `ISOLATE` is the
 * other end — opening the DC isolator so the array stops feeding the bus, which
 * is what happens before anybody touches it.
 *
 * They are the mirror of `START` and `STOP` in availability too. You cannot start
 * a running set; you cannot isolate an array that is not delivering, and the
 * tooltip says which of those is true rather than leaving a grey tile to explain
 * itself.
 *
 * Mode switching works. Both actions are deliberately inert — there is no
 * inverter behind this prototype, and a button that appears to open a DC isolator
 * on a live string and silently does nothing is worse than one that says so.
 */
export const InverterControlPad = ({
  state,
  mode,
  onModeChange,
}: {
  state: InverterState;
  mode: InverterControlMode;
  onModeChange: (mode: InverterControlMode) => void;
}) => {
  const manual = mode === 'MANUAL';
  const generating = state === 'GENERATING';
  const reachable = state !== 'OFFLINE';

  return (
    <div className="grid h-[170px] w-[220px] shrink-0 grid-cols-2 gap-5">
      <Tile
        icon={PointerIcon}
        label="MANUAL"
        tileClassName={manual ? 'bg-teal/16' : 'bg-highlight'}
        iconClassName={manual ? 'text-teal' : 'text-primary'}
        active={manual}
        disabled={!reachable}
        hint={
          reachable
            ? manual
              ? 'Under manual control'
              : 'Take manual control'
            : 'Nothing is listening — the inverter is not reporting'
        }
        onClick={() => onModeChange('MANUAL')}
      />
      <Tile
        icon={RotateCcwIcon}
        label="RESET"
        tileClassName="bg-teal"
        iconClassName="text-white"
        active={manual && reachable}
        disabled={!manual || !reachable}
        hint={
          !reachable
            ? 'Nothing is listening — the inverter is not reporting'
            : manual
              ? 'Clear the inverter’s latched faults — not wired in this prototype'
              : 'Switch to MANUAL to reset by hand. In AUTO the inverter retries on its own timer'
        }
      />
      <Tile
        icon={SettingsIcon}
        label="AUTO"
        tileClassName={manual ? 'bg-highlight' : 'bg-teal/16'}
        iconClassName={manual ? 'text-primary' : 'text-teal'}
        active={!manual}
        disabled={!reachable}
        hint={manual ? 'Hand control back to the inverter' : 'The inverter has control'}
        onClick={() => onModeChange('AUTO')}
      />
      <Tile
        icon={UnplugIcon}
        label="ISOLATE"
        tileClassName="bg-severity-critical"
        iconClassName="text-white"
        active={manual && reachable && generating}
        disabled={!manual || !reachable || !generating}
        hint={
          !reachable
            ? 'Nothing is listening — the inverter is not reporting'
            : !generating
              ? 'Nothing to isolate — this inverter is not delivering'
              : manual
                ? 'Open the DC isolator — not wired in this prototype'
                : 'Switch to MANUAL to isolate by hand'
        }
      />
    </div>
  );
};
