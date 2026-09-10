import {TriangleAlertIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {BAY_REM, ROW_GAP_REM} from '@/modules/cabinet/data/shelfLayout';
import {IMBALANCE_POINTS} from '../../data/modules';
import {filledSlots} from '../../types/moduleCabinet.type';
import type {ModuleCabinet, ModuleSlot} from '../../types/moduleCabinet.type';
import type {BatteryModule} from '../../types/module.type';

/**
 * The battery line-up drawn front-on, cabinet by cabinet, with every slot a control.
 *
 * `SubrackFigure` for the bank, and deliberately the same object: a reader who has
 * clicked a bay on the cabinet page already knows how this works, and the two pages
 * sharing a shape is worth more than either having one of its own.
 *
 * ## Why HTML and not SVG, again
 *
 * The same reasons the subrack elevation gives. A cabinet is rectangles with words in
 * them; CSS grid places them, `<button>` makes them focusable and keyboard-operable
 * for free, and text truncates the way text does everywhere else. The site diagram is
 * SVG because it draws conductors — paths, elbows, a switch blade at 35° — and there
 * is nothing of that here.
 *
 * ## The spacing is the subrack elevation's, not the hardware's
 *
 * Slot height and the gaps come from `BAY_REM` and `ROW_GAP_REM` — **the same constants
 * the cabinet page's bays are built on**, imported rather than copied — and the line-up
 * fills the same 44rem column, so the panel beside it is the same 346px on both pages.
 * Jeff made the cabinet page the definitive guide for this band's spacing (2026-09-10).
 *
 * That **overrides** the rule this file shipped with, and the reversal is worth stating
 * rather than quietly deleting. The boxes were a fixed 8.5rem wide: an `ESC330-D6` is
 * 650 mm wide and 1600 tall, an aspect of 0.4, and seven 40px slots came to 332px, so
 * 8.5rem drew the cabinet at very nearly its real proportion — the discipline
 * `plantScene` applies to the pad, where a 650 mm cabinet really is a quarter of the
 * 2.6 m line-up it stands in.
 *
 * They now flex to fill the column and stand about 221px wide against 472px tall, an
 * aspect of 0.47 rather than 0.41. So the drawing is no longer to scale, and what it
 * buys is that a reader moving between the cabinet page and this one finds the drawing
 * and its panel in the same places, at the same rhythm, rather than two bands that
 * almost match. **Consistency across the two pages beat fidelity to one cabinet's
 * dimensions**, which is a fair trade for a drawing whose job is *which door do I open*
 * rather than *how big is the box* — the slot count is what answers the first, and it
 * is unchanged.
 *
 * Slot 1 is drawn at the top and the numbers run down, which is how the labels are
 * stencilled and how a person reads a rack.
 *
 * Two things this deliberately does not claim. The **spares are drawn at the bottom**
 * of each cabinet, which is where an installer filling in order leaves them — but the
 * survey counted the empty positions without recording whether they are the top ones
 * or the bottom ones, and a cabinet loaded for weight would fill upward from the
 * floor. And the cabinets stand in `M01`-first order left to right, which is the
 * register's order rather than a surveyed line-up. Both are arrangement; the seven
 * slots and the one module in the power cabinet are hardware. `moduleCabinets` says
 * which is which.
 *
 * ## What a slot's appearance says
 *
 * **Fill is charge and edge is state**, and keeping those two apart is what lets the
 * drawing answer the bank's two questions at once — *is the pack level* and *is
 * anything wrong with it*.
 *
 * - **Charge** is a bar across the slot, in the app's own battery hue at low opacity,
 *   as wide as the module is full. Thirteen bars down a line-up is the imbalance read
 *   the whole band exists for: a pack in order is a neat stack of near-identical
 *   bars, and a module three points down is visible before its figure is read.
 * - **Faulted** takes its edge *and* its surface from the **row's own severity**, and
 *   the charge bar gives way. That is the subrack's rule exactly — a bay a person has
 *   to go and open says so before it says anything else — and it is why the bar is a
 *   quiet hue rather than a loud one: it must never compete with a red slot.
 * - **`IMBALANCE_POINTS` or more under the pack** takes an **amber edge and no
 *   surface**, keeping the distinction `ModuleRack` argues at length. Hue says who is
 *   claiming — red a device reported it, amber this app worked it out — and fill says
 *   the same thing again, so neither is load-bearing alone.
 * - **Spare** is dashed on the element background with tertiary text, the way the
 *   subrack draws its two unpopulated inverter slots. Selectable, because unlike a
 *   blanking plate it is a *known* space for a known kind of thing, and clicking it
 *   says which slot of seven is free.
 *
 * ## What a slot prints
 *
 * The module's stencilled label and its charge, and nothing else. Two facts is what a
 * 150px-wide slot holds at a size that can be read at arm's length, and they are the
 * two a person at the cabinet door is using: which one is this, and how full. Health,
 * temperature, stored energy and the register behind a fault are all one click away
 * in the panel — which is the trade the subrack made when its ten cards became a
 * drawing, and the same compensation applies: the drawing shows the *spares*, which
 * no card grid ever did.
 */

/** `57%` from `0.57` — the same rounding the cards and the pack use. */
const percent = (fraction: number): number => Math.round(fraction * 100);

/** How far under the pack this module sits, in points — negative if it is above. */
const shortfallOf = (module: BatteryModule, packSoc: number): number =>
  percent(packSoc - module.soc);

const slotClassName = (
  module: BatteryModule | undefined,
  fault: AlarmView | undefined,
  flagged: boolean,
  selected: boolean,
): string => {
  // `overflow-hidden` is what clips the charge bar to the slot's rounded corners, and
  // a guard besides: a label should never escape its slot and land across the one
  // below it.
  // Height comes from the caller as an inline style off `BAY_REM`, so it cannot drift
  // from the subrack's bays by a class being edited here.
  const base =
    'relative flex min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-sm border px-2 text-left transition-colors cursor-pointer outline-none';
  const ring = selected ? 'ring-2 ring-outline' : 'hover:ring-1 hover:ring-strong';

  if (module === undefined) {
    return cn(base, 'border-dashed border-subtle bg-element text-tertiary', ring);
  }

  // The edge only — the severity's *surface* is an overlay drawn above the charge bar
  // rather than a background under it, so a faulted slot still shows how full it is.
  if (fault !== undefined) {
    return cn(base, SEVERITY_META[fault.severity].edgeClassName, 'bg-element text-primary', ring);
  }

  if (flagged) return cn(base, 'border-severity-warning/40 bg-element text-primary', ring);

  return cn(base, 'border-subtle bg-element text-primary', ring);
};

/** What a screen reader is told, which is more than 150px of slot can print. */
const slotLabel = (
  cabinet: ModuleCabinet,
  slot: ModuleSlot,
  fault: AlarmView | undefined,
  shortfall: number,
): string => {
  if (slot.module === undefined) {
    return `${cabinet.label}, slot ${slot.slot} of ${cabinet.slots.length}: empty, no module fitted`;
  }

  // The rank is spoken because the colour is the whole of what the slot can say about
  // it, and a reader who cannot see the drawing has no other route to it.
  const state =
    fault !== undefined
      ? `faulted, ${SEVERITY_META[fault.severity].label}`
      : shortfall >= IMBALANCE_POINTS
        ? `${shortfall} points under the pack`
        : 'no fault reported';

  return `${slot.module.label}, ${cabinet.label} slot ${slot.slot}: ${percent(slot.module.soc)}% charged, ${state}`;
};

export const ModuleCabinetFigure = ({
  cabinets,
  packSoc,
  faults,
  flagged,
  selected,
  onSelect,
}: {
  cabinets: ReadonlyArray<ModuleCabinet>;
  /** The bank's own charge, for the shortfall each slot is measured against. */
  packSoc: number;
  /** Keyed on the module's one-based index, as `faultedModules` returns it. */
  faults: ReadonlyMap<number, AlarmView>;
  /** The ids of modules `IMBALANCE_POINTS` or more under the pack. */
  flagged: ReadonlySet<string>;
  selected: string;
  onSelect: (key: string) => void;
}) => (
  /* The cabinets side by side, as they stand bolted on the pad. `items-start` so a
     power cabinet of one slot sits at the top of the row rather than stretching to
     the height of a seven-slot box beside it — it is a different sort of container
     and should not be drawn as a mostly-empty version of the same one. */
  /* 44rem and `gap-5`, both the subrack band's — see the note above on what filling
     this column costs and what it buys. `items-start` so a power cabinet of one slot
     sits at the top of the row rather than stretching to a seven-slot box's height: it
     is a different sort of container and must not be drawn as a mostly-empty one. */
  <div className="flex w-full max-w-[44rem] flex-wrap items-start gap-5">
    {cabinets.map((cabinet) => (
      <figure
        key={cabinet.key}
        /* An equal share of the row, so the line-up fills its 44rem exactly as the
           shelf elevation fills its own — including the power cabinet, which takes a
           full column while holding one slot. It is still not drawn as a mostly-empty
           `ESC330`: `items-start` above keeps it one slot tall, so what it shares with
           its neighbours is the width and not the height.

           The doc at the top of this file carries what this replaced and why. */
        /* `min-w-[8.5rem]` is what keeps `flex-wrap` above meaningful. With `flex-1`
           and no floor the boxes shrink instead of wrapping, and four cabinets on a
           phone would come to about 56px of slot each — `M01` and `63%` need 55. The
           floor is the width the boxes used to be fixed at, so they fill the column on
           a desktop and break to a second row rather than crushing on a narrow one. */
        className="m-0 flex min-w-[8.5rem] flex-1 flex-col gap-1.5"
      >
        {/* **Above the slots, not under them** (Jeff, 2026-09-10). A caption under a
            drawing is right when the drawing is the subject and the words are a note on
            it — which is how `SubrackFigure` uses one. Here the box is the subject and
            its name is the *heading* of the modules inside it: a reader scanning the
            line-up for `Cabinet 2` should find the label before the slots it belongs
            to, not after seven of them, and with the boxes standing side by side a
            label underneath sits closer to the next cabinet's slots than to its own.

            Two lines, because one does not fit and a wrapping one would not fit
            predictably. `Cabinet 1 · ESC330-D6 · 6 of 7` is about 180px of 11px type
            against a 136px column, so it broke wherever the text happened to run out —
            and headings breaking in different places left the cabinets sitting at
            different heights along the row.

            Split at the meaning instead: the box's name, then what it is and how full.
            Every heading is exactly two lines whatever the model is called, so the
            line-up stays level. */}
        <figcaption className="flex flex-col text-xs leading-tight text-tertiary">
          <span className="truncate font-medium text-secondary">{cabinet.label}</span>
          <span className="truncate">
            {`${filledSlots(cabinet)} of ${cabinet.slots.length} · ${cabinet.model}`}
          </span>
        </figcaption>
        {/* The cabinet's own shell, in the inset surface — so the slots read as being
            inside a box rather than as loose tiles on the page, which is the frame
            `SubrackFigure` draws round each shelf. */}
        <div
          /* `ROW_GAP_REM` rather than a `gap-1.5` class, for the reason the slot height
             is an inline style: the two drawings claim to share a rhythm, so they share
             the number. It resolves to the same 0.375rem `gap-1.5` would. */
          style={{gap: `${ROW_GAP_REM}rem`}}
          className="flex flex-col rounded-md border border-default bg-inset p-2"
        >
          {cabinet.slots.map((slot) => {
            /* The register counts modules from one across the whole bank and this
               draws them cabinet by cabinet, so the join is on the module's own
               label — `M04` is the fourth module wherever it is standing. Parsed
               once here rather than threaded through the layout, which would put
               the bank's numbering into a type that is about geometry. */
            const index =
              slot.module === undefined ? undefined : Number(slot.module.label.slice(1));
            const fault = index === undefined ? undefined : faults.get(index);
            const isFlagged = slot.module !== undefined && flagged.has(slot.module.id);
            const shortfall =
              slot.module === undefined ? 0 : shortfallOf(slot.module, packSoc);

            return (
              <button
                key={slot.key}
                type="button"
                style={{height: `${BAY_REM}rem`}}
                className={slotClassName(slot.module, fault, isFlagged, slot.key === selected)}
                aria-pressed={slot.key === selected}
                aria-label={slotLabel(cabinet, slot, fault, shortfall)}
                title={slotLabel(cabinet, slot, fault, shortfall)}
                onClick={() => onSelect(slot.key)}
              >
                {/* The charge bar, behind the text and clipped by the slot.

                    Drawn on **every** fitted slot, faulted ones included. It was
                    suppressed under a fault at first, on the subrack's rule that the
                    severity owns the surface — and the estate showed that up straight
                    away. At SBH-1336 the three marked modules are `M01`–`M03` and `M03`
                    is the *fullest module in the line-up* at 66%; with the bar dropped
                    it drew emptier than the 61% slot below it. A mark that inverts the
                    reading it sits on top of is worse than no mark.

                    So both facts are kept and they are stacked rather than merged: the
                    bar says how full, the tint over it says how bad. `aria-hidden`
                    because the percentage beside it is the same fact in words. */}
                {slot.module !== undefined && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-battery/15"
                    style={{width: `${percent(slot.module.soc)}%`}}
                  />
                )}

                {/* The severity's surface, over the bar and under the text. This is the
                    subrack's `tintClassName` doing its usual job in an unusual layer —
                    the slot keeps the same edge, the same glyph and the same hue as a
                    faulted bay, and only the compositing order differs. */}
                {fault !== undefined && (
                  <span
                    aria-hidden="true"
                    className={cn('absolute inset-0', SEVERITY_META[fault.severity].tintClassName)}
                  />
                )}

                {slot.module === undefined ? (
                  <>
                    <span className="relative truncate text-xs">Spare</span>
                    <span className="relative text-xs tabular-nums">{slot.slot}</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex min-w-0 items-center gap-1">
                      {/* The mark replaces nothing here — there is no kind glyph on a
                          battery slot the way there is on a subrack bay, because every
                          slot holds the same kind of thing. So a triangle in the row's
                          own severity appears only where there is something to mark,
                          and its absence is the ordinary case. */}
                      {fault !== undefined && (
                        <TriangleAlertIcon
                          className={cn(
                            'size-3.5 shrink-0',
                            SEVERITY_META[fault.severity].textClassName,
                          )}
                          aria-hidden="true"
                        />
                      )}
                      {fault === undefined && isFlagged && (
                        <TriangleAlertIcon
                          className="size-3.5 shrink-0 text-severity-warning"
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 truncate text-xs font-medium">
                        {slot.module.label}
                      </span>
                    </span>

                    <span className="relative text-xs tabular-nums text-secondary">
                      {percent(slot.module.soc)}%
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </figure>
    ))}
  </div>
);
