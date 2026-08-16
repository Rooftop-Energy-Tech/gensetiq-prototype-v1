import {CheckIcon, ChevronDownIcon, XIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {Reading} from '../../../types/telemetry.type';
import {MAX_SERIES, SERIES_SLOTS} from './seriesMeta';

/**
 * The design's "number/value multiselect": which readings to plot.
 *
 * Two halves, and the split is the point. The **chips** are the current
 * selection, each in its series' colour — they are the legend as well as the
 * control, so the reader never has to look from a key at the top of the panel
 * back down to a trace to work out which is which. The **popover** is the
 * catalogue, opened only when changing something.
 *
 * The list offers instantaneous readings and nothing else. `Engine hours` and
 * `Mains outages (30 d)` are numbers a genset reports and are not trends — see
 * `ReadingKind` — and a picker that offers them is a picker that produces
 * meaningless charts on request.
 *
 * Each row carries the reading's value *now*. Choosing what to investigate is
 * mostly a matter of noticing which number looks off, and making the reader open
 * the chart to find that out costs a round trip per candidate.
 */
export const SeriesPicker = ({
  readings,
  selected,
  onToggle,
}: {
  readings: Array<Reading>;
  selected: Array<string>;
  onToggle: (key: string) => void;
}) => {
  const chosen = selected
    .map((key) => readings.find((reading) => reading.key === key))
    .filter((reading): reading is Reading => reading !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chosen.map((reading, index) => {
        const slot = SERIES_SLOTS[index];

        return (
          <Badge key={reading.key} variant="element" size="md" className="gap-2 border-subtle">
            <span className={cn('size-2 shrink-0 rounded-full', slot.background)} />
            <span className="text-primary">{reading.label}</span>
            {/* Hidden on the last one standing — `toggleKey` refuses to empty the
                selection, and a control that does nothing is worse than no
                control. */}
            {chosen.length > 1 && (
              <button
                type="button"
                onClick={() => onToggle(reading.key)}
                className="cursor-pointer text-secondary transition-colors hover:text-primary"
              >
                <XIcon aria-hidden="true" />
                <span className="sr-only">Remove {reading.label}</span>
              </button>
            )}
          </Badge>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <Badge
            asChild
            variant="element"
            size="md"
            className="cursor-pointer border-subtle transition-colors hover:bg-highlight"
          >
            <button type="button">
              <span className="text-secondary">
                {chosen.length < MAX_SERIES ? 'Add a reading' : 'Swap a reading'}
              </span>
              <ChevronDownIcon className="text-secondary" aria-hidden="true" />
            </button>
          </Badge>
        </PopoverTrigger>

        <PopoverContent className="flex max-h-[360px] w-[320px] flex-col">
          {/* The cap is explained where it is about to be enforced. In the
              toolbar it was a permanent sentence about a rule that only matters
              at the moment of choosing, and it pushed the range picker onto a
              second row. */}
          {chosen.length === MAX_SERIES && (
            <p className="shrink-0 px-2 py-1.5 text-xs text-secondary">
              Two at a time, one per axis — picking a third drops the oldest.
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {readings.map((reading) => {
              const index = selected.indexOf(reading.key);
              const active = index >= 0;

              return (
                <button
                  key={reading.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(reading.key)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-highlight"
                >
                  <span className="flex size-3 shrink-0 items-center justify-center">
                    {active ? (
                      <CheckIcon
                        className={cn('size-3', SERIES_SLOTS[index].text)}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      active ? 'font-medium text-primary' : 'text-secondary',
                    )}
                  >
                    {reading.label}
                  </span>
                  <span className="shrink-0 text-xs whitespace-nowrap text-secondary">
                    {amount(reading.value, reading.unit, reading.precision)}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
