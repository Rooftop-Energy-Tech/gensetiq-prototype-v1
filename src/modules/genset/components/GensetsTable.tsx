import {Link} from '@tanstack/react-router';
import type {KeyboardEvent} from 'react';

import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {gensetName} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

type GensetsTableProps = {
  gensets: Array<Genset>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
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
  {label: 'Genset name', width: '32%'},
  {label: 'Run state', width: '15%'},
  {label: 'Fuel level', width: '16%'},
  {label: 'Location', width: '21%'},
  {label: 'Last updated', width: '16%'},
] as const;

export const GensetsTable = ({gensets, selectedId, onSelect}: GensetsTableProps) => {
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
    <div className="h-full overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Fleet gensets, with run state, fuel level, location and telemetry age
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

            return (
              <tr
                key={genset.id}
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
