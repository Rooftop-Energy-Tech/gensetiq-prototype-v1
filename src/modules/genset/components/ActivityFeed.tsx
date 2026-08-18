import {
  CirclePlayIcon,
  CircleStopIcon,
  FuelIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {relativeTime} from '@/lib/format';
import type {GensetActivity, GensetActivityKind} from '../types/genset.type';

const ACTIVITY_ICON: Record<GensetActivityKind, LucideIcon> = {
  START: CirclePlayIcon,
  STOP: CircleStopIcon,
  REFUEL: FuelIcon,
  FAULT: TriangleAlertIcon,
  SERVICE: WrenchIcon,
};

/**
 * The machine's history as a rail of events — starts, stops, refuels, faults
 * and services, newest first.
 *
 * Extracted from the fleet page's slide-over panel so the genset's own
 * dashboard can carry the same feed: one rendering, two homes, and an event
 * cannot read differently depending on which of them you saw it in.
 */
export const ActivityFeed = ({activity}: {activity: Array<GensetActivity>}) => (
  <ol className="flex flex-col">
    {activity.map((event, index) => {
      const Icon = ACTIVITY_ICON[event.kind];
      const last = index === activity.length - 1;

      return (
        <li key={event.id} className="flex gap-3">
          {/* The rail is drawn as a bordered spacer beside the glyph rather
              than an absolutely-positioned line, so it stretches with however
              many lines the message wraps to. */}
          <div className="flex flex-col items-center">
            <Icon
              className={cn(
                'size-4 shrink-0',
                event.kind === 'FAULT' ? 'text-status-fault' : 'text-secondary',
              )}
              aria-hidden="true"
            />
            {!last && <div className="w-px flex-1 bg-subtle" />}
          </div>
          <div className={cn('flex min-w-0 flex-col', last ? 'pb-0' : 'pb-4')}>
            <span className="text-primary">{event.message}</span>
            <span className="text-xs text-secondary">{relativeTime(event.at)}</span>
          </div>
        </li>
      );
    })}
  </ol>
);
