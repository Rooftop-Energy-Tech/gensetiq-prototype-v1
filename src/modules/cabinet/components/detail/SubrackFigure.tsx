import {SunMediumIcon, TriangleAlertIcon, UtilityPoleIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {CABINET_SHELVES} from '../../data/shelfLayout';
import {SHELF_COLUMNS, isModulePosition} from '../../types/shelfPosition.type';
import type {Shelf, ShelfPosition} from '../../types/shelfPosition.type';
import type {SubrackModule} from '../../types/subrackModule.type';

/**
 * The cabinet drawn front-on, bay by bay, with every bay a control.
 *
 * ## Why a drawing replaced the grid of cards
 *
 * The rack of ten cards answered *what is in this shelf* and could not answer *which
 * one do I pull*. Those are different questions and only the second is why somebody
 * opens a cabinet page: a technician is dispatched to a box, opens the door, and
 * counts bays. A wrapping grid that reflows with the window has no relationship to
 * the metal — `SSU 3` could be first on a row or last, depending on how wide the
 * browser is.
 *
 * This is laid out the way the hardware is, so `SSU 3 Fault` on the Alarms tab lands
 * on a bay a person can find with the door open. That is the entire argument, and it
 * is the same one `ModuleRack` makes for keeping the battery's modules in slot order
 * rather than sorting them by charge.
 *
 * What it costs is the grid's one real advantage: ten cards printed forty figures at
 * once and this prints two per bay, with the rest a click away. The compensation is
 * that the two it keeps are the two that matter — what the bay is delivering, and
 * whether it is faulted — and that the drawing shows twelve more positions than the
 * grid could show at all: eight named parts the app has no reading for, and four
 * blanking plates that hold the rest in the right place.
 *
 * ## Why HTML and not SVG
 *
 * The site diagram is hand-built SVG because it draws *conductors*: paths, elbows,
 * a switch blade at 35°, and a scale that has to be measured at runtime. A shelf is
 * rectangles with words in them. CSS grid places them exactly, `<button>` makes them
 * focusable and keyboard-operable for free, and text in a cell wraps and truncates
 * the way text does everywhere else in the app. An SVG version would reimplement all
 * four badly.
 *
 * ## What each bay's appearance says
 *
 * Colour is the kind and fill is the state, which keeps the two readable at once:
 *
 * - **Rectifier** in the app's teal, the tone the site diagram gives an incomer and
 *   the sites list gives its supply badge — because that is what a rectifier
 *   converts.
 * - **SSU** in the solar ochre, for the same reason.
 * - **Carrying** is filled; **standby** is the plain element background. Only one
 *   group is ever carrying — in daylight the array feeds the tower through the SSUs
 *   and the six rectifiers deliver nothing — so an unlit rectifier row is the plant
 *   working exactly as specified and must not read as a fault.
 * - **Faulted** takes the warning edge, the same `border-severity-warning` the card
 *   rack and the battery's modules use.
 * - **Inert bays** are tertiary text on the element background: present, named, and
 *   visibly not reporting anything.
 * - **Blanks** are a dashed outline and nothing else. See `SubrackPanel`.
 */

/** How tall a module bay is, and the shorter distribution row above them. */
const BAY_HEIGHT = '3rem';
const DISTRIBUTION_HEIGHT = '2.25rem';

/**
 * The row heights for one shelf.
 *
 * Read off the positions rather than declared on the `Shelf`, so a drawing cannot end
 * up with a row template that disagrees with what is in its rows. The distribution
 * strip is shorter than a bay because it is on the metal — and because giving the
 * three branches the same weight as six rectifiers would say something false about
 * which of the two a reader came here for.
 */
const rowTemplate = (shelf: Shelf): string => {
  const shortTop = shelf.positions.some(
    (position) => position.row === 1 && position.kind === 'DISTRIBUTION',
  );

  return shortTop
    ? `${DISTRIBUTION_HEIGHT} repeat(${shelf.rows - 1}, ${BAY_HEIGHT})`
    : `repeat(${shelf.rows}, ${BAY_HEIGHT})`;
};

/** How a bay is filled, edged and coloured — the argument is in the doc above. */
const bayClassName = (
  position: ShelfPosition,
  module: SubrackModule | undefined,
  selected: boolean,
): string => {
  const base =
    'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm border px-1.5 text-center transition-colors';

  if (position.kind === 'BLANK') {
    return cn(base, 'border-dashed border-subtle');
  }

  const ring = selected ? 'ring-2 ring-outline' : 'hover:ring-1 hover:ring-strong';

  if (module === undefined) {
    return cn(base, 'border-subtle bg-element text-tertiary cursor-pointer', ring);
  }

  if (module.fault === 'ASSERTED') {
    return cn(
      base,
      'border-severity-warning/60 bg-severity-warning/10 text-primary cursor-pointer',
      ring,
    );
  }

  const carrying = module.outputKw > 0;
  const kind =
    module.kind === 'RECTIFIER'
      ? carrying
        ? 'border-teal/60 bg-teal/15 text-primary'
        : 'border-subtle bg-element text-secondary'
      : carrying
        ? 'border-solar/60 bg-solar/15 text-primary'
        : 'border-subtle bg-element text-secondary';

  return cn(base, kind, 'cursor-pointer', ring);
};

/**
 * What a screen reader is told about a bay, which is more than the cell prints.
 *
 * The cell has room for a name and a figure; this has to carry the state too, because
 * a reader who cannot see that the fill is unlit has no other way to learn that six
 * rectifiers are on standby behind a generating array.
 */
const bayLabel = (position: ShelfPosition, module: SubrackModule | undefined): string => {
  if (module === undefined) return position.label === '' ? 'Empty bay' : position.label;

  const state =
    module.fault === 'ASSERTED'
      ? 'faulted'
      : module.outputKw > 0
        ? 'carrying'
        : 'on standby';

  return `${module.label}: ${state}, ${module.outputKw.toFixed(1)} kW, ${module.tempC.toFixed(1)} °C`;
};

/**
 * The mark in a bay's name row: its kind, or a warning if it is faulted.
 *
 * The warning replaces the kind rather than sitting beside it. There is room for one
 * glyph in a 3rem cell, and a bay a person has to go and look at should say so before
 * it says what sort of bay it is — the kind is on the card beside the drawing anyway.
 *
 * Unlit when the bay is on standby, which is the same rule the fill follows: only one
 * group converts at a time and the idle one is not in trouble.
 */
const BayIcon = ({module}: {module: SubrackModule}) => {
  if (module.fault === 'ASSERTED') {
    return (
      <TriangleAlertIcon
        className="size-3.5 shrink-0 text-severity-warning"
        aria-hidden="true"
      />
    );
  }

  const Icon = module.kind === 'RECTIFIER' ? UtilityPoleIcon : SunMediumIcon;
  const lit = module.kind === 'RECTIFIER' ? 'text-teal' : 'text-solar';

  return (
    <Icon
      className={cn('size-3.5 shrink-0', module.outputKw > 0 ? lit : 'text-tertiary')}
      aria-hidden="true"
    />
  );
};

export const SubrackFigure = ({
  modules,
  selected,
  onSelect,
}: {
  modules: ReadonlyArray<SubrackModule>;
  selected: string;
  onSelect: (key: string) => void;
}) => {
  /**
   * The join between the drawing and the readings, by `(kind, slot)`.
   *
   * Not by id: a module's id is `sbh-1336/r03`, a fact about one site, and a bay's
   * key is `psu-3`, a fact about the shelf. Keeping them separate is what lets the
   * elevation be a constant — the day a second monitoring unit is added, the same
   * drawing joins to that site's modules with no change here. `shelfLayoutFits`
   * guards the case where it should not.
   */
  const moduleAt = (position: ShelfPosition): SubrackModule | undefined =>
    isModulePosition(position.kind)
      ? modules.find(
          (module) => module.kind === position.kind && module.slot === position.slot,
        )
      : undefined;

  return (
    <div className="flex w-full max-w-[36rem] flex-col gap-5">
      {CABINET_SHELVES.map((shelf) => (
        <figure key={shelf.key} className="m-0 flex flex-col gap-1.5">
          {/* The shelf's own frame, in the inset surface, so the bays read as being
              inside a box rather than as loose tiles on the page. */}
          <div className="rounded-md border border-default bg-inset p-1.5">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${SHELF_COLUMNS}, minmax(0, 1fr))`,
                gridTemplateRows: rowTemplate(shelf),
              }}
            >
              {shelf.positions.map((position) => {
                const module = moduleAt(position);
                const isSelected = position.key === selected;
                const style = {
                  gridColumn: `${position.col} / span ${position.span}`,
                  gridRow: position.row,
                };
                const className = bayClassName(position, module, isSelected);

                // A blank is drawn and left inert — it is spacing that happens to be
                // visible, and a tab stop that says nothing is worse than no control.
                if (position.kind === 'BLANK') {
                  return (
                    <div key={position.key} style={style} className={className} aria-hidden="true" />
                  );
                }

                return (
                  <button
                    key={position.key}
                    type="button"
                    style={style}
                    className={cn(className, 'outline-none')}
                    aria-pressed={isSelected}
                    aria-label={bayLabel(position, module)}
                    title={bayLabel(position, module)}
                    onClick={() => onSelect(position.key)}
                  >
                    <span className="flex min-w-0 items-center gap-1 text-xs font-medium">
                      {module !== undefined && <BayIcon module={module} />}
                      <span className="min-w-0 truncate">{position.label}</span>
                    </span>

                    {/* The one figure a bay has room for, and it is the right one:
                        which bays are actually delivering is the whole difference
                        between a shelf carrying the tower and a shelf idling behind
                        the array. Inert bays print nothing here rather than a zero,
                        which would read as a measured nought. */}
                    {module !== undefined && (
                      <span className="text-xs tabular-nums text-tertiary">
                        {module.outputKw.toFixed(1)} kW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <figcaption className="text-xs text-tertiary">
            <span className="font-medium text-secondary">{shelf.name}</span>
            {` · ${shelf.caption}`}
          </figcaption>
        </figure>
      ))}
    </div>
  );
};
