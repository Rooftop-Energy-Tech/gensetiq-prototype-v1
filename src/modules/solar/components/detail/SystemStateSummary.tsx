import {GaugeIcon, MoonIcon, PowerOffIcon, SunIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {InverterState} from '../../types/system.type';

/**
 * The hero glyph, one per state — the system's answer to `RunStateSummary`.
 *
 * A sun rather than the genset's play triangle, and a moon rather than its pause
 * bars. The colours still come from the shared `status-*` tokens, so the two
 * pages agree on what "working" and "not doing anything" look like even where the
 * marks differ.
 */
const HERO: Record<InverterState, {icon: LucideIcon; className: string}> = {
  GENERATING: {icon: SunIcon, className: 'text-teal'},
  IDLE: {icon: MoonIcon, className: 'text-status-idle'},
  OFFLINE: {icon: PowerOffIcon, className: 'text-status-offline'},
};

const LABEL: Record<InverterState, string> = {
  GENERATING: 'Generating',
  IDLE: 'Idle',
  OFFLINE: 'Offline',
};

/**
 * "Generating / 18.4 kW" — the leftmost column of a system's home page.
 *
 * The output badge is present only while the system is generating, the rule the
 * run-state hero follows: a system at night has no output, and `0 kW` under a
 * moon would read as a fault at the one hour of the day it is guaranteed not to
 * be one.
 */
export const SystemStateSummary = ({
  state,
  outputKw,
}: {
  state: InverterState;
  outputKw: number;
}) => {
  const {icon: Icon, className} = HERO[state];

  return (
    <div className="flex shrink-0 items-center gap-3 md:w-[113px] md:flex-col">
      <div className="flex flex-1 items-center gap-2 md:flex-none md:flex-col">
        <Icon className={cn('size-8', className)} aria-hidden="true" />
        <p className="text-base font-medium whitespace-nowrap text-primary">{LABEL[state]}</p>
      </div>

      {state === 'GENERATING' && (
        <Badge variant="element" className="border-subtle md:w-full">
          <GaugeIcon className="text-teal" aria-hidden="true" />
          {amount(outputKw, 'kW', 1)}
        </Badge>
      )}
    </div>
  );
};
