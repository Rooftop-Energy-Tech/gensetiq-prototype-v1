import {Link} from '@tanstack/react-router';
import {ArrowRightIcon} from 'lucide-react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {PreviewPanel, PreviewRow} from '@/components/global/PreviewPanel';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
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
      {/* 🎯 **The table's own cell**, not a second rendering of it. A row and the
          panel beside it describing one array two ways is how the two come to
          disagree about it, so when the column became `Alarm` this did too.

          `Strings` sat above it — `3 of 29 dark` — and went with the table's
          `Strings` column on 2026-09-14: a string is a wiring detail of one array,
          and the count is on the array's own page box by box, where a reader who
          has decided to look at one can act on it. The `Health` row under it stated
          the rule's own words for the same fault (`Strings offline`), which made
          the pair a fault explained twice in a panel four rows long. */}
      <PreviewRow label="Alarm">
        <AlarmBadge
          counts={row.counts}
          to="/solar/$systemId/alarms"
          params={{systemId: system.id}}
        />
      </PreviewRow>
      <PreviewRow label="Last updated">{relativeTime(system.lastUpdated)}</PreviewRow>
    </PreviewPanel>
  );
};
