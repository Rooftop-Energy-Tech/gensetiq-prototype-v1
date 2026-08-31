import {
  MoonIcon,
  PencilLineIcon,
  PlugZapIcon,
  SprayCanIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {relativeTime, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {SystemActivity, SystemActivityKind} from '../../data/systemActivity';

/**
 * Past this, an event is stamped with its date rather than counted back to.
 *
 * The genset feed counts back to everything because a genset's log is starts and
 * stops and never runs long. A system's oldest entry is its commissioning, one to
 * four years back, and `961 days ago` is a number nobody converts — it is the
 * form of a date that has stopped being one. Ninety days is where "a while ago"
 * stops being useful and "3 Mar 2024" starts.
 */
const STAMP_AFTER_DAYS = 90;

const when = (at: string, now: number): string =>
  now - Date.parse(at) > STAMP_AFTER_DAYS * 24 * 60 * 60 * 1000
    ? stampDate(at)
    : relativeTime(at, now);

const ACTIVITY_ICON: Record<SystemActivityKind, LucideIcon> = {
  COMMISSION: PlugZapIcon,
  FAULT: TriangleAlertIcon,
  CLEAN: SprayCanIcon,
  SILENCE: MoonIcon,
  NOTE: PencilLineIcon,
};

/**
 * The system's history as a rail of events, newest first.
 *
 * The genset's `ActivityFeed` rendered against array events. Not shared with it:
 * that component's icon map is keyed by `GensetActivityKind`, and the two
 * vocabularies have nothing in common — a PV system is never refuelled and a
 * genset is never washed. Widening one component to take both maps would mean passing
 * the icon table in as a prop, which is a component that renders a list of things
 * with icons, not a feed.
 *
 * The rail is drawn as a bordered spacer beside the glyph rather than an
 * absolutely positioned line, so it stretches with however many lines a message
 * wraps to. That part *is* copied, deliberately: the two feeds sit on sibling
 * pages and should look like one thing.
 */
export const SystemActivityFeed = ({
  activity,
  now,
}: {
  activity: Array<SystemActivity>;
  now: number;
}) => (
  <ol className="flex flex-col">
    {activity.map((event, index) => {
      const Icon = ACTIVITY_ICON[event.kind];
      const last = index === activity.length - 1;

      return (
        <li key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Icon
              className={cn(
                'size-4 shrink-0',
                event.kind === 'FAULT' ? 'text-severity-critical' : 'text-secondary',
              )}
              aria-hidden="true"
            />
            {!last && <div className="w-px flex-1 bg-subtle" />}
          </div>
          <div className={cn('flex min-w-0 flex-col', last ? 'pb-0' : 'pb-4')}>
            <span className="text-primary">{event.message}</span>
            <span className="text-xs text-secondary">
              {when(event.at, now)}
              {event.source !== undefined && (
                <span className="text-tertiary"> · {event.source}</span>
              )}
            </span>
          </div>
        </li>
      );
    })}
  </ol>
);
