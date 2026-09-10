import {SunMediumIcon, TriangleAlertIcon, UtilityPoleIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {worstSeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {bayAssertedRows, isCompactPosition} from '../../data/shelfLayout';
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
 * whether it is faulted — and that the drawing shows thirteen more positions than the
 * grid could show at all: nine named parts the app has no reading for, two empty
 * inverter slots, and two blanking plates that hold the rest in the right column.
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
 * Colour is the kind and fill is the state, which keeps the two readable at once —
 * except on a faulted bay, where colour is the **severity** and both of the others
 * give way. That is the ordering a person at the cabinet door needs: what sort of bay
 * it is and whether it is carrying are answered on the panel beside the drawing, and
 * which bay to open is answered only here.
 *
 * - **Rectifier** in the app's teal, the tone the site diagram gives an incomer and
 *   the sites list gives its supply badge — because that is what a rectifier
 *   converts.
 * - **SSU** in the solar ochre, for the same reason.
 * - **Carrying** is filled; **standby** is the plain element background. Only one
 *   group is ever carrying — in daylight the array feeds the tower through the SSUs
 *   and the six rectifiers deliver nothing — so an unlit rectifier row is the plant
 *   working exactly as specified and must not read as a fault.
 * - **Faulted** takes its edge *and* its fill from **the row's own severity** — red
 *   for the `CRITICAL` that every `SSU N Fault` on this estate is. It was flat amber,
 *   which was the warning colour standing in for the only red in the app on a bay
 *   whose row the Alarms tab one tab across ranks critical. The card rack and the
 *   battery's module cards read the same pair from `SEVERITY_META`, so one row cannot
 *   be three colours across three drawings of it.
 * - **Inert bays** are tertiary text on the element background: present, named, and
 *   visibly not reporting anything.
 * - **Empty slots** are dashed and unfilled, but keep their label and stay
 *   selectable: two of the ETP23006's three inverter slots are unpopulated, and a
 *   shelf a third full should look a third full.
 * - **Blanks** are a dashed outline and nothing else. See `SubrackPanel`.
 *
 * ## What each bay prints
 *
 * A name, and under it one line: the reading where the bay has one, and the part's own
 * number or rating where it does not — `Auxiliary power` over `M48500N1`,
 * `Distribution` over `200 A`. So every named bay has the same two-line shape and the
 * second line always answers the same question, which is *what is the one other thing
 * worth knowing about this bay from across the room*.
 *
 * Both lines are the **app's** words. Four bays used to print an acronym or a part
 * number as their name — `SMU`, `GIM`, `UIM`, `M48500` — while the panel beside them
 * was already headed `Monitoring unit`, `Genset I/O`, `Environment I/O` and
 * `Auxiliary power`, so one bay had two names and the drawing had the harder one. The
 * cells now carry the panel's heading exactly, and the part numbers moved to the
 * second line where they are a fact about the bay rather than the whole of its
 * identity.
 *
 * The exception is the two stacked corner boards, which are half a bay tall and have
 * room for one line of smaller type. `isCompactPosition` measures that off the
 * geometry rather than being told, so it is the cell's own height that decides — the
 * `2.75rem` distribution strip is shorter than a bay and still takes two lines.
 */

/** How a bay is filled, edged and coloured — the argument is in the doc above. */
const bayClassName = (
  position: ShelfPosition,
  module: SubrackModule | undefined,
  /**
   * The worst rank standing against a bay that has **no module of its own**.
   *
   * See `raisedOn` for why module bays are excluded.
   */
  raised: AlertSeverity | undefined,
  selected: boolean,
): string => {
  // `overflow-hidden` is a guard rather than a layout choice: every cell is measured
  // to fit its content (see `isCompactPosition`), and this makes it impossible for a
  // name to escape its bay and land across the one beside it if a future label, font
  // or viewport proves one of those measurements optimistic. A drawing of metal should
  // clip inside a bay before it spills between two.
  const base =
    'flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-sm border px-2 text-center transition-colors';

  if (position.kind === 'BLANK') {
    return cn(base, 'border-dashed border-subtle');
  }

  const ring = selected ? 'ring-2 ring-outline' : 'hover:ring-1 hover:ring-strong';

  // An empty slot: dashed like a blank, because it is a space — but on the element
  // background and selectable, because unlike a blank it is a *known* space, for a
  // known kind of thing, and clicking it says which slot of how many.
  if (position.fitted === false) {
    return cn(base, 'cursor-pointer border-dashed border-subtle text-tertiary', ring);
  }

  if (module === undefined) {
    /* A bay with no readings but a row standing against it — the distribution branches
       and the AC input. It takes the row's edge and tint exactly as a faulted module bay
       does, so the drawing agrees with the pill on the panel beside it. */
    if (raised !== undefined) {
      const meta = SEVERITY_META[raised];
      return cn(base, meta.edgeClassName, meta.tintClassName, 'text-primary cursor-pointer', ring);
    }

    return cn(base, 'border-subtle bg-element text-tertiary cursor-pointer', ring);
  }

  if (module.fault === 'ASSERTED') {
    // `WARNING` where the severity is somehow missing, which the type permits and
    // `subrackModules` never produces: a bay drawn in the wrong amber is recoverable
    // and a bay drawn as though nothing were wrong is not.
    const meta = SEVERITY_META[module.faultSeverity ?? 'WARNING'];

    return cn(base, meta.edgeClassName, meta.tintClassName, 'text-primary cursor-pointer', ring);
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
const bayLabel = (
  position: ShelfPosition,
  module: SubrackModule | undefined,
  raised: AlertSeverity | undefined,
): string => {
  if (position.fitted === false) {
    // Kind-neutral. It said "no inverter fitted", which was true while the inverter
    // slots were the only bays that could be empty — a five-rectifier shelf has an
    // empty rectifier bay, and it is not an inverter.
    return `${position.label}: empty, nothing fitted`;
  }

  if (module === undefined) {
    if (position.label === '') return 'Empty bay';

    /* The rank is spoken, because on a bay with no readings the colour is the whole of
       what the cell can say about it and a reader who cannot see it has no other route.
       The row itself is named on the panel; this says there is one. */
    if (raised !== undefined) {
      const second = position.rating ?? position.part;
      return `${position.label}${second === undefined ? '' : `, ${second}`}: ${SEVERITY_META[raised].label} alarm standing`;
    }

    // With whatever the cell's second line would say — including where the cell is too
    // short to print it, since a reader who cannot see the drawing is the one reader
    // who should never lose a fact to its geometry. That is both corner boards: their
    // part numbers are spoken here and drawn nowhere.
    //
    // No `fitted` guard, unlike the drawing's own second line: an unpopulated slot
    // returned above with its own sentence, so anything reaching here is present.
    const second = position.rating ?? position.part;
    return second === undefined ? position.label : `${position.label}, ${second}`;
  }

  // The rank is spoken, because it is the only thing the cell says about a faulted bay
  // that a reader who cannot see it has no other route to: the colour is the whole
  // message and there is no room in 88px for the word.
  const state =
    module.fault === 'ASSERTED'
      ? `faulted, ${SEVERITY_META[module.faultSeverity ?? 'WARNING'].label}`
      : module.outputKw > 0
        ? 'carrying'
        : 'on standby';

  // The **drawn** label, not the module's own. They differ only for a solar unit —
  // the cell says `Solar Supply Unit 3` and the module calls itself `SSU 3` — and a
  // reader who cannot see the cell should be told what is in it. The device's own
  // string is still the panel's identity line, where it joins `SSU 3 Fault`.
  return `${position.label}: ${state}, ${module.outputKw.toFixed(1)} kW, ${module.tempC.toFixed(1)} °C`;
};

/**
 * The mark in a bay's name row: its kind, or a warning if it is faulted.
 *
 * The warning replaces the kind rather than sitting beside it. There is room for one
 * glyph in a 3rem cell, and a bay a person has to go and look at should say so before
 * it says what sort of bay it is — the kind is on the card beside the drawing anyway.
 *
 * In the row's own severity, like the bay's surface and like the badge on the panel
 * beside it. There is no room for the severity in words in an 88px cell, so the glyph's
 * colour is the whole of what it can say about rank — and a bay whose edge and shade
 * are red while its glyph is amber is a cell disagreeing with itself. `NEUTRAL` takes
 * no hue and does not need one: the glyph is still a triangle where every other bay
 * has a sun or a utility pole, so such a bay is marked by shape even before colour.
 *
 * Unlit when the bay is on standby, which is the same rule the fill follows: only one
 * group converts at a time and the idle one is not in trouble.
 */
const BayIcon = ({module}: {module: SubrackModule}) => {
  if (module.fault === 'ASSERTED') {
    return (
      <TriangleAlertIcon
        className={cn(
          'size-4 shrink-0',
          // `WARNING` for the combination the type permits and `subrackModules` never
          // builds — the same fallback the cell's own surface takes.
          SEVERITY_META[module.faultSeverity ?? 'WARNING'].textClassName,
        )}
        aria-hidden="true"
      />
    );
  }

  const Icon = module.kind === 'RECTIFIER' ? UtilityPoleIcon : SunMediumIcon;
  const lit = module.kind === 'RECTIFIER' ? 'text-teal' : 'text-solar';

  return (
    <Icon
      className={cn('size-4 shrink-0', module.outputKw > 0 ? lit : 'text-tertiary')}
      aria-hidden="true"
    />
  );
};

export const SubrackFigure = ({
  shelves,
  modules,
  standing,
  catalogue,
  selected,
  onSelect,
}: {
  /**
   * The two shelves, already built for this cabinet's counts.
   *
   * Handed in rather than derived here. The band beside this figure needs the same
   * geometry — to resolve a click into a position and to count the parts in its
   * caption — and two components building it from the same counts is two chances for
   * the drawing and the lookup to disagree about where a bay is. See `cabinetShelves`.
   */
  shelves: ReadonlyArray<Shelf>;
  modules: ReadonlyArray<SubrackModule>;
  /** Every standing `SITE` row, so a bay with no readings can still be marked. */
  standing: ReadonlyArray<AlarmView>;
  /** Every `SITE` row this site's unit publishes — the narrowing `bayWatchedRows` needs. */
  catalogue: ReadonlySet<string>;
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
  /**
   * The worst rank standing against a bay, **for bays that have no module.**
   *
   * ## Why module bays are excluded
   *
   * A rectifier or SSU bay is coloured by its **own positional row** — `SSU 3 Fault`
   * means the module in slot 3, because SSU identity is read off detection pins — and
   * `subrackModules` already resolves that into `module.faultSeverity`. Every other row
   * watching those bays is a *group* row: `SSU Lost` is about the four solar units
   * together, `Rectifier Abnormal` about the six rectifiers. Colouring a bay from one
   * would paint the whole group.
   *
   * That is not hypothetical — `SSU Lost` stands at every site on this estate, so
   * feeding group rows in here would tint all four SSU bays grey, and each of them would
   * lose the fill that says whether it is *carrying*. A neutral row is a note rather
   * than a problem, and four bays repainted for a note is the loudest possible reading
   * of the quietest rank.
   *
   * ## Why the bays without modules are the opposite case
   *
   * The three distribution branches and the AC input have **no positional row at all** —
   * every row watching them is a group row, so there is no specific claim to prefer and
   * a group row is the only claim there is. Drawing it is strictly better than drawing
   * nothing, which is what they did before: `AlarmPill` put `Warning · DC Overvoltage
   * Alarm` on the distribution panel while the bay beside it stayed plain, so the
   * drawing quietly contradicted the card it was driving (Jeff spotted it, 2026-09-10).
   */
  const raisedOn = (position: ShelfPosition): AlertSeverity | undefined =>
    isModulePosition(position.kind)
      ? undefined
      : worstSeverity([...bayAssertedRows(position, standing, catalogue)]);

  const moduleAt = (position: ShelfPosition): SubrackModule | undefined =>
    isModulePosition(position.kind)
      ? modules.find(
          (module) => module.kind === position.kind && module.slot === position.slot,
        )
      : undefined;

  return (
    <div className="flex w-full max-w-[44rem] flex-col gap-5">
      {shelves.map((shelf) => (
        <figure key={shelf.key} className="m-0 flex flex-col gap-1.5">
          {/* The shelf's own frame, in the inset surface, so the bays read as being
              inside a box rather than as loose tiles on the page. */}
          <div className="rounded-md border border-default bg-inset p-2">
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${SHELF_COLUMNS}, minmax(0, 1fr))`,
                // The rem lives here rather than in the layout, which holds the
                // heights as numbers so `positionHeightRem` can add them up.
                gridTemplateRows: shelf.rowHeights.map((height) => `${height}rem`).join(' '),
              }}
            >
              {shelf.positions.map((position) => {
                const module = moduleAt(position);
                const raised = raisedOn(position);
                const isSelected = position.key === selected;
                // Half a bay tall, so one small line and no second one.
                const compact = isCompactPosition(shelf, position);
                // Nothing under an unpopulated slot. `part` on an empty inverter
                // slot is what it *takes*, not what is in it, so drawing it would put
                // a module in a bay the drawing is showing as empty.
                const secondLine =
                  position.fitted === false
                    ? undefined
                    : (position.rating ?? position.part);
                const style = {
                  gridColumn: `${position.col} / span ${position.span}`,
                  // `rowSpan` is one unless the bay shares its row — the GIM and the
                  // UIM each take half of one, so everything beside them spans both.
                  gridRow: `${position.row} / span ${position.rowSpan ?? 1}`,
                };
                const className = bayClassName(position, module, raised, isSelected);

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
                    aria-label={bayLabel(position, module, raised)}
                    title={bayLabel(position, module, raised)}
                    onClick={() => onSelect(position.key)}
                  >
                    {/* Two type sizes, and the cell's own height picks between them.
                        A full bay takes `text-sm`, and may wrap to two lines — which is
                        what `Solar Supply Unit 3` needs, since truncated it would read
                        `Solar Supp…` and lose the slot number, the one part of the
                        label a person counting bays at the open door is using.
                        `leading-tight` is what pays for that second line: at the
                        default leading, two lines plus the figure under them come to
                        58px inside a 58px bay, which is a cell that fits by rounding.

                        The two corner boards are **half a bay** — 27px — so a second
                        line is not available to them at any leading, and
                        `Environment I/O` is the longest name in the drawing. They take
                        `text-xs` and one line, which fits at every width the figure
                        shrinks to. `truncate` is the backstop rather than the plan: the
                        smaller type is what makes the name fit, and this only says that
                        a 27px cell can never be made to overflow. The whole name is in
                        the tooltip and the aria label either way. */}
                    <span
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 leading-tight font-medium',
                        compact ? 'text-xs' : 'text-sm',
                      )}
                    >
                      {module !== undefined && <BayIcon module={module} />}
                      {/* A bay with no readings but a row standing against it. The same
                          triangle a faulted module bay shows, in the same hue — a bay
                          marked by colour alone is marked twice as weakly, and `NEUTRAL`
                          takes no hue at all, so the shape is what carries it there. */}
                      {module === undefined && raised !== undefined && (
                        <TriangleAlertIcon
                          className={cn('size-4 shrink-0', SEVERITY_META[raised].textClassName)}
                          aria-hidden="true"
                        />
                      )}
                      <span className={cn('min-w-0', compact && 'truncate')}>
                        {position.label}
                      </span>
                    </span>

                    {/* The second line: what the bay is delivering, or the one other
                        fact worth knowing about a bay that delivers nothing.

                        A module prints its output, because which bays are actually
                        delivering is the whole difference between a shelf carrying the
                        tower and a shelf idling behind the array — and never a zero
                        where there is no reading, which would read as a measured
                        nought. A bay with no readings prints its rating where it has
                        one and its part number otherwise, which is how
                        `Auxiliary power` keeps the `M48500N1` it used to have in place
                        of a name. The rating wins because the only bays that have one
                        are the three distribution branches, where all three are the
                        same part and `200 A` is what tells the strip from the bays
                        below it. See `ShelfPosition.part` and `.rating`.

                        `tabular-nums` is on the reading only. It lines up a column of
                        kW figures, which is what it is for; a part number is a name
                        that happens to contain digits. */}
                    {module !== undefined ? (
                      <span className="text-xs tabular-nums text-tertiary">
                        {module.outputKw.toFixed(1)} kW
                      </span>
                    ) : (
                      secondLine !== undefined &&
                      !compact && (
                        <span className="min-w-0 truncate text-xs text-tertiary">
                          {secondLine}
                        </span>
                      )
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
