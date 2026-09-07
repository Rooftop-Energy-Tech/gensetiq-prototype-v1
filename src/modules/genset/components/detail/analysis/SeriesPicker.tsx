import {useState} from 'react';
import {ArrowLeftRightIcon, PlusIcon, SearchIcon, XIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {PickableReading, ReadingGroup} from '../../../types/telemetry.type';
import {MAX_SERIES, SERIES_SLOTS} from './seriesMeta';

/**
 * The catalogue, filed and filtered — what the dialog actually lists.
 *
 * Sections in the caller's order, then whatever its groups never mentioned under
 * `Other`. The remainder section is the picker's job rather than the caller's
 * because the picker is the thing that would silently lose the row: a group list
 * is a filing decision that can fall behind the data, and the failure mode of
 * falling behind should be a heading nobody filed, not a reading nobody can plot.
 *
 * A query matches a reading's own label **or its section's**. Typing "battery"
 * for `Charge alternator voltage` is not a spelling mistake — the word an
 * operator reaches for is often the subsystem, not the instrument, and a search
 * that answers only the instrument sends them back to scrolling.
 */
const catalogue = (
  readings: Array<PickableReading>,
  groups: Array<ReadingGroup> | undefined,
  query: string,
): Array<{label: string; readings: Array<PickableReading>}> => {
  const byKey = new Map(readings.map((reading) => [reading.key, reading]));
  const filed = new Set((groups ?? []).flatMap((group) => group.keys));

  const sections = [
    ...(groups ?? []).map((group) => ({
      label: group.label,
      readings: group.keys
        .map((key) => byKey.get(key))
        .filter((reading): reading is PickableReading => reading !== undefined),
    })),
    {
      label: groups === undefined ? '' : 'Other',
      readings: readings.filter((reading) => !filed.has(reading.key)),
    },
  ];

  const needle = query.trim().toLowerCase();

  return sections
    .map((section) => ({
      label: section.label,
      readings:
        needle === '' || section.label.toLowerCase().includes(needle)
          ? section.readings
          : section.readings.filter((reading) =>
              reading.label.toLowerCase().includes(needle),
            ),
    }))
    .filter((section) => section.readings.length > 0);
};

/**
 * The design's "number/value multiselect": which readings to plot.
 *
 * Two halves, and the split is the point. The **chips** are the current
 * selection, each in its series' colour — they are the legend as well as the
 * control, so the reader never has to look from a key at the top of the panel
 * back down to a trace to work out which is which. The **dialog** is the
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
 *
 * ## A dialog, not a dropdown
 *
 * Twenty readings in a 320px popover is a nine-row window with a scrollbar: to
 * find `Oil temperature` you scroll past the coolant pair, and to compare it with
 * `Coolant temperature` you scroll back. The catalogue is not long, it was just
 * being shown through a slot. Given a 672px dialog it fits in two columns under
 * its own headings, and the question the picker exists to answer — *which of
 * these numbers looks wrong* — becomes a matter of looking rather than scrolling.
 *
 * Modal rather than merely larger: a popover this size would cover the chart it
 * is about anyway, and a stray click on the plot behind it would close it
 * mid-search. The overlay makes that explicit instead of accidental.
 *
 * ## Why it stays open after a pick
 *
 * Because the cap makes picking a *pair*. `Add a reading` is followed by "and now
 * the other one" often enough that closing on the first click would mean opening
 * the same dialog twice, and `Swap a reading` is two moves by definition — drop
 * one, choose its replacement. The footer keeps the pair in view, in the axis
 * colours, so the state the dialog is about is legible from inside it.
 */
export const SeriesPicker = ({
  readings,
  groups,
  selected,
  onToggle,
}: {
  readings: Array<PickableReading>;
  /**
   * How to file the catalogue. Optional: a caller with nothing to say about its
   * own readings gets one unlabelled list, which is what this control was.
   */
  groups?: Array<ReadingGroup>;
  selected: Array<string>;
  onToggle: (key: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const chosen = selected
    .map((key) => readings.find((reading) => reading.key === key))
    .filter((reading): reading is PickableReading => reading !== undefined);

  const sections = catalogue(readings, groups, query);
  const full = chosen.length === MAX_SERIES;

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

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // The query is a search, not a setting. Left behind, the next open
          // shows three of twenty readings and a box explaining why, which reads
          // as a broken catalogue rather than as last week's search.
          if (!next) setQuery('');
        }}
      >
        <DialogTrigger asChild>
          <Badge
            asChild
            variant="element"
            size="md"
            className="cursor-pointer border-subtle transition-colors hover:bg-highlight"
          >
            {/* The verb's own icon, not a chevron. A chevron promises a list
                unfolding under the chip; what opens is a dialog in the middle of
                the screen, and the arrows say `swap` — which is the move the cap
                forces once two are up — where a caret would just be wrong. */}
            <button type="button">
              <span className="text-secondary">
                {full ? 'Swap a reading' : 'Add a reading'}
              </span>
              {full ? (
                <ArrowLeftRightIcon className="text-secondary" aria-hidden="true" />
              ) : (
                <PlusIcon className="text-secondary" aria-hidden="true" />
              )}
            </button>
          </Badge>
        </DialogTrigger>

        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden p-0">
          <div className="flex shrink-0 flex-col gap-3 border-b border-subtle px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle>Readings</DialogTitle>
                {/* The cap is explained where it is about to be enforced. In the
                    toolbar it was a permanent sentence about a rule that only
                    matters at the moment of choosing, and it pushed the range
                    picker onto a second row. */}
                <DialogDescription className="mt-1">
                  {full
                    ? 'Two at a time, one per axis — picking a third drops the oldest.'
                    : 'Two at a time, one per axis. Values shown are the readings now.'}
                </DialogDescription>
              </div>

              <DialogClose asChild>
                <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0">
                  <XIcon aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>

            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                // Enter takes the first match. A search box that leaves the mouse
                // to finish the job is a search box the keyboard cannot use, and
                // with the results filed under headings the first match is
                // unambiguous — it is the top row of the top section.
                //
                // Handled here rather than by wrapping the field in a `<form>`:
                // implicit submission depends on a form having no other button
                // and on the browser agreeing, and this dialog is one Enter key,
                // not a form being filled in.
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;

                  const first = sections[0]?.readings[0];
                  if (first === undefined) return;

                  event.preventDefault();
                  onToggle(first.key);
                }}
                placeholder="Search readings"
                aria-label="Search readings"
              />
            </InputGroup>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {sections.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-secondary">
                No reading matches “{query.trim()}”. The chart plots instantaneous
                readings only — counters like engine hours are not offered here.
              </p>
            ) : (
              /* Newspaper columns, not a grid — the width buys *columns*, and a
                 column is what a category is.

                 A category read across two cells was the thing to fix:
                 `Load & current` laid out row-major put `Active power` beside
                 `Phase current L1` and `Phase current L2` beneath it, so the five
                 readings of one subsystem had to be read in a zigzag. Each
                 category now runs straight down, and it is the *catalogue* that
                 takes the second column when the first one fills — the reading
                 order is down the left half, then down the right.

                 `break-inside-avoid` is what keeps that honest: without it the
                 balancer would split a category across the fold, which is the
                 zigzag again with a gutter in it. And it is why the two columns
                 come out uneven — a column break can only land between
                 categories, so the balancer takes the nearest one. */
              <div className="sm:columns-2 sm:gap-x-4">
                {sections.map((section) => (
                  <section
                    key={section.label}
                    className="mb-3 flex break-inside-avoid flex-col gap-1"
                  >
                    {section.label !== '' && (
                      <h3 className="px-2 text-xs font-medium tracking-wide text-tertiary uppercase">
                        {section.label}
                      </h3>
                    )}

                    <div className="flex flex-col">
                      {section.readings.map((reading) => {
                        const active = selected.includes(reading.key);

                        return (
                          <button
                            key={reading.key}
                            type="button"
                            // The only thing marking the selection is a
                            // background, and a background is not a state a
                            // screen reader can read. This is.
                            aria-pressed={active}
                            onClick={() => onToggle(reading.key)}
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
                              // `hover` and `highlight` are the two tiers the
                              // palette defines for exactly this — "hover state
                              // on list items" and "focus / active state" — and
                              // the row needs both to be legible: given one
                              // token for both, the row under the cursor is
                              // indistinguishable from the pair being plotted.
                              // The selected row keeps its own shade while
                              // hovered rather than dropping to the lighter one.
                              active ? 'bg-highlight' : 'hover:bg-hover',
                            )}
                          >
                            {/* Every label at full strength, and no tick column
                                indenting them off the left edge.

                                The list is twenty *names to read*, and greying
                                nineteen of them to make one look chosen taxes the
                                reading to mark the state — while the state
                                already has its own channel in the row's
                                background. The tick went the same way: a 12px
                                glyph in the series colour, on a row that is
                                already filled in that selection's honour, is a
                                second answer to a question nobody asked twice. */}
                            <span className="min-w-0 flex-1 truncate text-sm text-primary">
                              {reading.label}
                            </span>
                            <span className="shrink-0 text-xs whitespace-nowrap text-secondary">
                              {amount(reading.value, reading.unit, reading.precision)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* The pair, in the axis colours, from inside the dialog that changes
              it. The chips outside are the same fact, and the overlay is sitting
              on top of them. */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-subtle px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {chosen.map((reading, index) => (
                <span
                  key={reading.key}
                  className="flex min-w-0 items-center gap-1.5 text-xs text-secondary"
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      SERIES_SLOTS[index].background,
                    )}
                  />
                  <span className="truncate">{reading.label}</span>
                  <span className="shrink-0 text-tertiary">
                    {SERIES_SLOTS[index].axis === 'left' ? 'left axis' : 'right axis'}
                  </span>
                </span>
              ))}
            </div>

            <DialogClose asChild>
              <Button size="sm" variant="secondary" className="shrink-0">
                Done
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
