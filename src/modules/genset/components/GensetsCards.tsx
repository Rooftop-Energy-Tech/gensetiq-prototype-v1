import {Link} from '@tanstack/react-router';
import {ChevronRightIcon, DropletIcon, MapPinIcon} from 'lucide-react';

import {StaticAlarmBadge} from '@/components/global/AlarmCounts';
import {Badge} from '@/components/ui/badge';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {fuelLevelTextClass} from './fuelLevelTone';
import {useFleetAlarmCounts} from '../data/alarmViews';
import type {AlertSeverity} from '../types/alert.type';
import {gensetLabel} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

/**
 * The fleet at phone width: one card per unit.
 *
 * Not the table with columns dropped. The table's columns are *answers*,
 * and the two that would survive a 390px screen — name and run state — are the two
 * that say least on their own; "1,763L (72%)" and "Petaling Jaya" are why anybody
 * scrolls this list. A card keeps all five and spends vertical space, which a phone
 * has and a table row does not.
 *
 * **The whole card navigates**, where a table row only selects. There is no preview
 * panel at this width to select *into*, and a card that highlighted itself and did
 * nothing else would be the dead-end control the fleet screen's toggle rule exists
 * to avoid. So the card is a link, and the arrow says so.
 */
/** A set the counts pass has not reached — the table's constant, for its reason. */
const EMPTY_COUNTS: Record<AlertSeverity, number> = {CRITICAL: 0, WARNING: 0, NEUTRAL: 0};

const GensetCard = ({genset, counts}: {genset: Genset; counts: Record<AlertSeverity, number>}) => {
  return (
  <Link
    to="/gensets/$gensetId"
    params={{gensetId: genset.id}}
    className="flex items-center gap-3 rounded-md border border-subtle bg-element px-3 py-3 outline-none transition-colors active:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
  >
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {/* Bare, like the table's cell — this is the same register at phone width and
          the screen is headed `Gensets`. See `gensetLabel`. */}
      <p className="truncate text-sm font-medium text-primary">{gensetLabel(genset)}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <RunStateBadge runState={genset.runState} />
        {/* The table's Alarm pill, where the card had shown the Optimum / Attention /
            Critical verdict until 2026-09-29: the counts are what the table reads,
            and the verdict was the one fact on the card it did not. Static, because
            the whole card is already the link. */}
        <StaticAlarmBadge counts={counts} />
        <Badge variant="secondary">
          <DropletIcon className="text-fuel" aria-hidden="true" />
          <span className={fuelLevelTextClass(genset.fuelLitres, genset.fuelCapacityLitres)}>
            {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
          </span>
        </Badge>
      </div>

      {/* The two facts with no badge of their own: where it is, and how long ago it
          last said anything. Telemetry age belongs beside the location rather than
          in a pill — it qualifies everything above it, including the fuel figure. */}
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-secondary">
        <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{genset.locationLabel}</span>
        <span className="shrink-0 text-tertiary">·</span>
        <span className="shrink-0 text-tertiary">{relativeTime(genset.lastUpdated)}</span>
      </p>
    </div>

    <ChevronRightIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
  </Link>
  );
};

export const GensetsCards = ({gensets}: {gensets: Array<Genset>}) => {
  // One counts pass for the list — the table's `useFleetAlarmCounts`, so a card and
  // a row cannot disagree about a set.
  const counts = useFleetAlarmCounts(gensets);

  return (
    <div className="h-full overflow-y-auto">
      <ul aria-label="Fleet gensets" className="flex flex-col gap-2 pb-20">
        {gensets.map((genset) => (
          <li key={genset.id}>
            <GensetCard genset={genset} counts={counts[genset.id] ?? EMPTY_COUNTS} />
          </li>
        ))}
      </ul>
    </div>
  );
};
