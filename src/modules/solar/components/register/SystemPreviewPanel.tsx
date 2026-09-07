import {Link} from '@tanstack/react-router';
import {ArrowRightIcon} from 'lucide-react';

import {PreviewPanel, PreviewRow} from '@/components/global/PreviewPanel';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {SYSTEM_STATE_META} from '../systemStateMeta';
import {systemName} from '../../types/system.type';
import type {SolarRow} from '../../data/register';

/**
 * The preview beside the solar register — what a selected system is, in five facts.
 *
 * ## Why these five
 *
 * The panel is a *preview*, so the test for a row is whether it changes what a reader
 * does next. State, output and health are the three that move; strings is the one
 * fault this module can state in a number; the telemetry age is what says whether to
 * believe the other four. Capacity is left to the table, where it is a column, and to
 * the system's own header, where it is half the name.
 *
 * A silent system's output reads `—` rather than `0.0 kW`, which is `systems.ts`'s
 * rule carried through: publishing a figure from a plant nobody has heard from in two
 * days would be claiming a measurement nobody took.
 */
export const SystemPreviewPanel = ({
  row,
  className,
}: {
  row: SolarRow | undefined;
  className?: string;
}) => {
  if (row === undefined) {
    return (
      <PreviewPanel
        label="Solar system details"
        heading={undefined}
        emptyMessage="Select a system to see its details."
        className={className}
      />
    );
  }

  const {system} = row;
  const state = SYSTEM_STATE_META[system.state];
  const condition = CONDITION_META[row.condition];

  return (
    <PreviewPanel
      label="Solar system details"
      heading={systemName(system)}
      emptyMessage="Select a system to see its details."
      className={className}
      action={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
              <Link
                to="/solar/$systemId"
                params={{systemId: system.id}}
                aria-label={`Open ${system.siteName}`}
              >
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Open system</TooltipContent>
        </Tooltip>
      }
    >
      <PreviewRow label="State">
        <Badge variant="element" className="border-subtle">
          <state.icon className={cn('size-3', state.iconClassName)} aria-hidden="true" />
          {state.label}
        </Badge>
      </PreviewRow>
      <PreviewRow label="Output">
        {system.state === 'GENERATING' ? amount(system.outputKw, 'kW', 1) : '—'}
      </PreviewRow>
      <PreviewRow label="Strings">
        {system.downStrings === 0
          ? `${system.strings} live`
          : `${system.downStrings} of ${system.strings} dark`}
      </PreviewRow>
      <PreviewRow label="Health">
        <span className={cn('flex items-center gap-1.5', condition.textClassName)}>
          <condition.icon className="size-4 shrink-0" aria-hidden="true" />
          {/* The rule's own words where there is a fault, since "Attention" on its
              own sends the reader into the system page to find out what for. */}
          <span className="truncate">{row.headline ?? condition.label}</span>
        </span>
      </PreviewRow>
      <PreviewRow label="Last updated">{relativeTime(system.lastUpdated)}</PreviewRow>
    </PreviewPanel>
  );
};
