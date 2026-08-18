import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {CONDITION_META} from './detail/severityMeta';
import {gensetDetail} from '../data/detail';
import {gensetCondition} from '../data/fuelIntegrity';
import {gensetName} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

type GensetsTableProps = {
  gensets: Array<Genset>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * The scroll container, handed up so the split view can watch which rows are on
   * screen — see `useVisibleRowIds`. Optional, because the list-only view has no
   * map to drive and nothing to observe with.
   */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /**
   * Called just before this table scrolls itself, so the page can tell a scroll it
   * caused from one the reader performed. Without it, selecting a pin on the map
   * scrolls the list, which re-frames the map away from that pin.
   */
  onBeforeAutoScroll?: () => void;
};

/**
 * Widths are proportional rather than the design's flat 262px columns.
 *
 * The mock-up floats the detail panel over the table, so all five columns keep
 * full width and the last two simply disappear underneath it. Here the panel
 * takes its own column instead, which leaves ~900px to divide — and split
 * evenly that truncates `BRF9540 | Cummins 1000 kVa` in every row. The name
 * gets the slack; the fixed-shape columns (a badge, a litre figure) give it up.
 */
const COLUMNS = [
  {label: 'Genset name', width: '27%'},
  // Health sits next to run state because the two together are the row's verdict:
  // what the machine is doing, and whether it is doing it well. It is the same
  // `GensetCondition` the detail page prints above its alerts and the sites list
  // rolls up per yard — derived from the alerts, so a row cannot claim `Optimum`
  // over a set whose page shows two shutdown alarms.
  {label: 'Run state', width: '13%'},
  {label: 'Health', width: '14%'},
  {label: 'Fuel level', width: '14%'},
  {label: 'Location', width: '18%'},
  {label: 'Last updated', width: '14%'},
] as const;

export const GensetsTable = ({
  gensets,
  selectedId,
  onSelect,
  scrollRef,
  onBeforeAutoScroll,
}: GensetsTableProps) => {
  /**
   * Bring a selection made elsewhere into view.
   *
   * A pin clicked on the map selects a row that may be six screens down the list,
   * and a selection you cannot see is the same as no selection. `nearest` rather
   * than `center`: a row already on screen should not move at all, which is the
   * common case when the click came from the list itself.
   */
  useEffect(() => {
    const container = scrollRef?.current;
    if (container === null || container === undefined || selectedId === undefined) return;

    const row = container.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(selectedId)}"]`);
    if (row === null) return;

    const {top, bottom} = row.getBoundingClientRect();
    const view = container.getBoundingClientRect();
    // The header is sticky and 40px tall, so a row tucked under it counts as out
    // of view even though it technically intersects the container.
    if (top >= view.top + 40 && bottom <= view.bottom) return;

    onBeforeAutoScroll?.();
    row.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    // `onBeforeAutoScroll` is deliberately not a dependency: it is a fresh closure
    // every render, and re-running this on each one would fight the reader's own
    // scrolling for as long as anything stayed selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scrollRef]);

  // Enter and Space both select; Space additionally has to have its default
  // suppressed or the table scrolls out from under the row being chosen. The
  // genset's own page is reached through the name link in the first cell, which
  // is in the tab order right after the row.
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Fleet gensets, with run state, health, fuel level, location and telemetry age
        </caption>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} style={{width: column.width}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gensets.map((genset) => {
            const selected = genset.id === selectedId;
            // A set with no detail entry has no alerts to judge, so it gets no
            // verdict rather than a green one it hasn't earned.
            //
            // `gensetCondition` rather than `detail.condition`: the latter is the
            // register map's verdict alone, and a set losing fuel carries an alarm
            // no register map has a bit for.
            const condition =
              gensetDetail(genset.id) === undefined ? undefined : gensetCondition(genset.id);
            const conditionMeta = condition === undefined ? undefined : CONDITION_META[condition];
            const ConditionIcon = conditionMeta?.icon;

            return (
              <tr
                key={genset.id}
                data-row-id={genset.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(genset.id)}
                onKeyDown={(event) => handleKeyDown(event, genset.id)}
                className={cn(
                  'cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  {/* The name is the way *into* a genset; the rest of the row
                      only selects it into the preview panel. `stopPropagation`
                      so the click doesn't also fire the row's select on a screen
                      we are in the middle of leaving. */}
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: genset.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {gensetName(genset)}
                  </Link>
                </td>
                <td className="h-13 border-b border-subtle p-2">
                  <RunStateBadge runState={genset.runState} />
                </td>
                <td className="h-13 border-b border-subtle p-2">
                  {conditionMeta === undefined || ConditionIcon === undefined ? (
                    <span className="text-tertiary">—</span>
                  ) : (
                    <Badge variant="secondary">
                      <ConditionIcon className={conditionMeta.textClassName} aria-hidden="true" />
                      {conditionMeta.label}
                    </Badge>
                  )}
                </td>
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
                </td>
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {genset.locationLabel}
                </td>
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {relativeTime(genset.lastUpdated)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
