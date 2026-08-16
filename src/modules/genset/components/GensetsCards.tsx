import {Link} from '@tanstack/react-router';
import {ChevronRightIcon, DropletIcon, MapPinIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {CONDITION_META} from './detail/severityMeta';
import {gensetDetail} from '../data/detail';
import {gensetCondition} from '../data/fuelIntegrity';
import {gensetName} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

/**
 * The fleet at phone width: one card per unit.
 *
 * Not the table with columns dropped. The table's five columns are five *answers*,
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
const GensetCard = ({genset}: {genset: Genset}) => {
  // The table's `Health` column, in badge form. Sourced the same way it is there —
  // from the detail store, which derives it from the set's alerts — so a card cannot
  // claim `Optimum` over a machine whose page shows two shutdown alarms.
  const condition =
    gensetDetail(genset.id) === undefined ? undefined : gensetCondition(genset.id);
  const conditionMeta = condition === undefined ? undefined : CONDITION_META[condition];
  const ConditionIcon = conditionMeta?.icon;

  return (
  <Link
    to="/gensets/$gensetId"
    params={{gensetId: genset.id}}
    className="flex items-center gap-3 rounded-md border border-subtle bg-element px-3 py-3 outline-none transition-colors active:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
  >
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="truncate text-sm font-medium text-primary">{gensetName(genset)}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <RunStateBadge runState={genset.runState} />
        {conditionMeta !== undefined && ConditionIcon !== undefined && (
          <Badge variant="secondary">
            <ConditionIcon className={conditionMeta.textClassName} aria-hidden="true" />
            {conditionMeta.label}
          </Badge>
        )}
        <Badge variant="secondary">
          <DropletIcon className="text-fuel" aria-hidden="true" />
          {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
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

export const GensetsCards = ({gensets}: {gensets: Array<Genset>}) => (
  <div className="h-full overflow-y-auto">
    <ul aria-label="Fleet gensets" className="flex flex-col gap-2 pb-20">
      {gensets.map((genset) => (
        <li key={genset.id}>
          <GensetCard genset={genset} />
        </li>
      ))}
    </ul>
  </div>
);
