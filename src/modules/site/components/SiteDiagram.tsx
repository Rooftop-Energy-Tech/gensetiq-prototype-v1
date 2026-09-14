import {useRef} from 'react';
import {
  BatteryChargingIcon,
  BoomBoxIcon,
  FactoryIcon,
  ServerIcon,
  SunMediumIcon,
  UtilityPoleIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {RunState} from '@/modules/genset/types/genset.type';

import {StaticAlarmBadge} from '@/components/global/AlarmCounts';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import {gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasBattery, hasMains, hasSolar, isolatorStateOf, mainsContactorStateOf} from '../types/site.type';
import type {MainsSupply, SitePowerRole, SwitchState} from '../types/site.type';
import {siteHasCabinet} from '@/modules/cabinet/data/shelf';
import {hybridState} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteFeed, SiteSummary} from '../data/sites';

/**
 * The site's single-line diagram: every genset, its isolator, the bus they share,
 * and the load at the end of it.
 *
 * ## Why it is drawn rather than exported
 *
 * Figma ships this as a stack of SVG vectors plus a four-variant `Diagram / Switch`
 * component (Closed | Open × Live | Dead). Reproducing that literally would mean
 * one exported asset per switch state per genset count, so this redraws it —
 * the same call `TickGauge` makes about the design's gauge bitmaps.
 *
 * Every dimension below is the design's, measured off the frame's coordinates:
 * 88 × 74 nodes, a 44px lead to a 64 × 40 isolator, a 47px elbow onto the bus,
 * and a 67px tap from the bus to the load. The switch's internals follow the
 * component's own documentation: terminals on the horizontal centreline at
 * x = 18 and x = 46, and an open blade lifted 35° off the source terminal.
 *
 * ## Why the geometry is fixed, and how it still fits a phone
 *
 * The conductors have to *land* on the boxes.
 * A flex or grid arrangement that reflows leaves a wire ending in mid-air at some
 * viewport width, and a diagram with a conductor pointing at nothing is worse than
 * one that needs a scrollbar. So the block is a fixed pixel canvas.
 *
 * When the canvas is wider than the space it is given, the whole drawing is
 * **scaled down uniformly** rather than scrolled or reflowed. That keeps the
 * geometry exactly as measured — every wire still lands where it was drawn to —
 * and it costs only type size: a 375px screen asks for 0.86 of the 398px canvas, a
 * legible 9.5px caption, and 0.65 of the 530px one an array widens it to, which is
 * about 7px. Scrolling was the previous answer and it was worse: the load node, the
 * one thing the whole drawing points at, started off screen.
 *
 * ## What is added to the design
 *
 * The frame draws two identical `GENSET` boxes with nothing to tell them apart —
 * fine for a mock-up of a two-set site, useless the moment the page has to say
 * *which* set is open. So every node is captioned, in two lines: what it is, and
 * what it is putting into the bus. The load's caption is the site's draw, stated at
 * the point the power actually arrives.
 *
 * Both are additive. The boxes keep their designed 88 × 74 and the captions sit in
 * the 64px gap between them.
 *
 * ## The drawing as the page's selector
 *
 * Pass a `selection` and the nodes standing for devices become buttons: the site
 * page uses the diagram to choose which device's detail sits beside it. Omit it —
 * the settings page's preview — and every node is inert, which is what this
 * component did before any of this existed.
 *
 * It is **one prop holding three things** rather than three props, because two of
 * the three are useless alone: a click handler with no `devices` list to check
 * against can offer a box the page has no card for, and a `selected` with no
 * handler draws a ring nothing can move. Bundled, a caller either wires the whole
 * mechanism or none of it, and there is no half-configured state to guard against.
 *
 * `devices` is what makes a node clickable — not merely being a source. Two nodes
 * are never buttons and for the same reason: the **mains** is a supply the site is
 * connected to rather than a machine on the books, and the **load** is the site
 * itself. Neither has a card, so neither appears in the list, so neither can offer
 * a click that does nothing.
 *
 * One consequence worth stating because it is an accessibility fix rather than a
 * style choice: the `role="img"` and its long description now sit on the `<svg>`
 * rather than on the whole block. `role="img"` tells a screen reader to treat a
 * subtree as one opaque image, so leaving it outside would have made the node
 * buttons unreachable. The conductors are the part that is a picture; the boxes are
 * text and, here, controls.
 *
 * ## The other sources
 *
 * A `GRID_BACKUP` site draws a **mains source above its gensets**, on its own
 * contactor, onto the same bus. The frame has no such node — it draws only
 * gensets, which quietly makes every site look like it has nothing else feeding
 * it — and a page about *backup* power that never shows what is being backed up is
 * missing its subject.
 *
 * The two hybrid configurations add a **bank** the same way, and a solar hybrid adds
 * the **array**. That is the argument for putting all of them in one column rather
 * than inventing a second: a bus is a bus, so every source is a row, and every
 * measurement above applies to each of them unchanged. Four rows at a solar hybrid
 * with two sets is the same drawing as one row at a diesel-prime site with one —
 * taller, and not otherwise different.
 *
 * The array **was** the exception. It is DC-coupled rather than on the bus, so it was
 * drawn in a column of its own to the left, on one conductor into the battery, with
 * no isolator. That drawing was true and it read as an afterthought: the array sat
 * somewhere no other source stood, in the one configuration where it is the source
 * the whole site was built around.
 *
 * It is a row now, and the coupling it lost comes back as a **tie riser down the left
 * of the boxes** — the array into the bank, the bank into the sets. So the drawing
 * carries a vertical line on each side and they say different things: the right one
 * is the bus, what carries the tower; the left one is the DC tie, what charges the
 * bank. See `TIE_X`.
 *
 * The order down the column is the order the site uses its sources in: array, grid,
 * bank, then gensets. Reading it downwards is reading the control strategy, which is
 * why the bank sits above the machine that charges it and the array above everything
 * — it is the source that costs nothing to run.
 *
 * A `DIESEL_PRIME` site has no incomer and no plant, and draws exactly what it
 * drew before any of this existed.
 */

// ─── The design's measurements ───────────────────────────────────────────────

const NODE_W = 88;
const NODE_H = 74;
/** Node top to node top, vertically. */
const PITCH = 138;
/** Genset edge to isolator edge. */
const LEAD = 44;
const SWITCH_W = 64;
/** Isolator edge to the bus riser. */
const ELBOW = 47;
/** Bus to load edge. */
const TAP = 67;
/** Room under the bottom node for its two caption lines. */
const CAPTION = 30;

/**
 * What an alarm pill adds under a node, when the drawing is given counts to draw.
 *
 * The pill is `h-6` on the badge scale — 24px — plus the 4px that keeps it off the
 * power line above it. Both the pitch and the bottom margin take it, so the gap
 * between one node's last line and the next node's box is the one the design drew,
 * whether or not there is a pill in between.
 *
 * Reserved only when `alarms` is passed. The settings page renders this drawing twice
 * as a preview of a power role, with no counts and nothing to say about alarms; making
 * it carry 28px of empty band per row for a pill it will not draw would stretch a
 * preview to buy nothing.
 */
const PILL_ROOM = 28;

const SWITCH_X = NODE_W + LEAD;
const BUS_X = SWITCH_X + SWITCH_W + ELBOW;

/**
 * Where the load box sits, and therefore how wide the canvas is.
 *
 * Two arrangements, and the cabinet is what picks between them. Without one the tap
 * runs from the junction straight into the load, which is every drawing this file
 * has ever produced. With one the cabinet's **left edge stands on the junction** and
 * the tap runs from its right edge instead, so the load moves out by exactly the box
 * it now has to clear.
 *
 * The cabinet is not given a tap of its own on the way in. Standing it on the
 * junction is the claim — see `CABINET_X`.
 */
const LOAD_X_BARE = BUS_X + TAP;
const LOAD_X_CABINET = BUS_X + NODE_W + TAP;

const WIDTH_BARE = LOAD_X_BARE + NODE_W;
const WIDTH_CABINET = LOAD_X_CABINET + NODE_W;

/**
 * The DC tie a solar hybrid adds down its column.
 *
 * ## What a bus was getting wrong here
 *
 * Every other site type is honestly a bus: two or three AC sources, each on its own
 * switch, elbowing onto one riser that carries the tower. Reading it is reading a
 * changeover.
 *
 * A solar hybrid is not that. The array, the bank and the set are **coupled through
 * the bank** — the array charges it, the set charges it through its rectifier, and its
 * converter is what the load hangs off. Drawing them onto a shared riser said the
 * three were paralleled onto one node, which is the AC-coupled plant this site is
 * not. And it drew the relationship a reader most needs — *the array feeds the
 * battery* — as an incidental overlap between two riser segments.
 *
 * So at a solar hybrid the riser goes and two things take its place:
 *
 *  - a **tie down the boxes' own centreline**, box to box, so the array's line into
 *    the bank and the set's line into the bank are the two most visible marks in the
 *    drawing;
 *  - the **junction** stays what it was: every source elbows to one point on the
 *    drawing's centreline and one conductor runs from there into the load. See
 *    `JUNCTION_X_BARE` — with right angles and a single meeting point there is no other
 *    shape, and the array's run down to it and the set's run up to it overlap nowhere.
 *
 * Every other role keeps the bus, because for them it is the right drawing.
 *
 * ## The tie crosses the captions, deliberately
 *
 * The 64px between two boxes is where their caption lines live, so a tie down the
 * middle runs through `PV array` and `93% charged`. The captions therefore carry the
 * canvas colour behind them and the line breaks around the words — the label-over-a-
 * conductor treatment any wiring drawing uses. Routing the tie around them instead
 * would have meant either a line that starts 30px below the box it comes out of, or
 * captions moved out beside every node.
 */
const TIE_X = NODE_W / 2;

/**
 * Where every source's run meets, on the drawing's own centreline.
 *
 * ## One point, and what that forces
 *
 * Every conductor here is orthogonal, so each source arrives at the meeting place
 * **vertically**. Meeting at one point therefore puts every source's vertical at that
 * one x — there is no other arrangement. Spreading the arrivals 16px apart was the
 * previous attempt and it gave three dots on one line rather than the single junction
 * this drawing wants; converging with diagonals was the attempt before that, and it
 * broke the right angles.
 *
 * So each source elbows out of its isolator to `BUS_X` and runs to the junction, and
 * one conductor carries the design's 67px tap from there into the load.
 *
 * ## Why that is not the shared bus this drawing got rid of
 *
 * It looks close and it is not the same claim. The junction sits at the **midpoint of
 * the sources**, so at a solar hybrid the array's run comes down from above it and the
 * set's comes up from below: two verticals that touch at the point and overlap
 * nowhere. Each source owns its whole path, which is what a reader tracing one needs.
 *
 * With four or more sources the outer runs do pass through the stretch the inner ones
 * occupy, and that overlap is real — see `rows` on why the paint order is by liveness
 * rather than by position, so a dead run can never be left covering a live one.
 */
const JUNCTION_X_BARE = BUS_X;
/** Half a box further on, so a cabinet centred here still clears the isolators. */
const JUNCTION_X_CABINET = BUS_X + NODE_W / 2;

/**
 * The cabinet's left edge. Its **centre** stands on the junction — see below.
 *
 * ## Why it stands on the point rather than beside it
 *
 * The junction is not a place on the way to the cabinet — it **is** the cabinet's DC
 * bus. `SiteDiagram`'s own note on `JUNCTION_X_BARE` says every source arrives at one node
 * "the array through its SSUs, the bank through its BLVD, the set through the
 * rectifiers", and all three of those are modules in this box. So the honest drawing
 * puts the box *on* the point every source reaches, and the sources arrive **at the
 * cabinet** rather than at a dot that then feeds it.
 *
 * ## Centred on the meeting, not butted against it
 *
 * The first version put the box's left edge on the junction, which drew every source
 * stopping at the cabinet's face — three wires touching the outside of a box. Runs
 * into a DC plant do not stop at its skin; they land on a bar inside it, and that bar
 * is the meeting. Centring the box on the junction is that picture: the array's run
 * comes down through the top edge, the set's up through the bottom, the bank's in
 * through the left, and they meet where the reader cannot see them, which is exactly
 * where they meet in the cabinet.
 *
 * It costs nothing geometrically because the junction is a free parameter: pushing it
 * half a box to the right lengthens each source's horizontal by 44px and leaves every
 * angle square, the elbow's 47px of clearance off the isolators intact, and the tap
 * and the load box where they already were.
 *
 * The alternative — a dot, a tap, then a cabinet — draws two nodes where the plant
 * has one, which is the shared busbar this drawing removed in the first place,
 * reintroduced at 67px long.
 *
 * ## Why the dot goes with it
 *
 * On the bare drawing the dot is doing real work: without it, three conductors ending
 * on one invisible point in open space read as three lines that happen to cross. A
 * **box** makes that claim on its own — conductors landing on one point of one edge
 * are landing on one thing, and the thing is named in the box. Drawn as well, the dot
 * would sit half under the border and read as an artefact rather than a node, so the
 * cabinet takes over the job and the dot is drawn only where there is no cabinet.
 *
 * ## Only where the cabinet has a page
 *
 * `subrackCabinet` is defined at the instrumented site alone, and the box is a
 * control — drawing it at the other twenty-four would put a node in the circuit whose
 * click goes nowhere. The other twenty-four keep the drawing they had exactly.
 */
const CABINET_X = BUS_X;

/** Terminal centres inside the isolator, from the component's documentation. */
const SOURCE_TERMINAL = 18;
const LOAD_TERMINAL = 46;
const BLADE_LENGTH = LOAD_TERMINAL - SOURCE_TERMINAL - 7;
/** How far the blade lifts when the isolator is open. */
const BLADE_ANGLE = 35;

const RADIANS = Math.PI / 180;

// ─── Conductors ──────────────────────────────────────────────────────────────

/**
 * One run of conductor.
 *
 * A live run is drawn three times over: a wide, faint underlay for the glow the
 * design's teal wires carry, the conductor itself, and a dashed overlay animated
 * along the path so the direction of flow is visible without a legend. A dead run
 * is a single quiet stroke.
 *
 * The dash is decoration with a job: on a site where one set is feeding the bus
 * and another is isolated, "which of these two lines is doing something" is the
 * first question the diagram gets asked, and colour alone answers it only for a
 * reader who already knows teal means live.
 */
const Conductor = ({points, live}: {points: Array<[number, number]>; live: boolean}) => {
  const path = points.map(([x, y]) => `${x},${y}`).join(' ');

  if (!live) {
    return (
      <polyline
        points={path}
        fill="none"
        // The design paints a dead conductor white at 32%. `text-tertiary` is the
        // nearest token — a near-white at 40% — and using it keeps the diagram on
        // the same scale as every other de-emphasised mark in the app.
        className="stroke-current text-tertiary"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    );
  }

  return (
    <>
      <polyline
        points={path}
        fill="none"
        className="stroke-current text-teal opacity-20"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <polyline
        points={path}
        fill="none"
        className="stroke-current text-teal"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <polyline
        points={path}
        fill="none"
        className="power-flow stroke-current text-white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="4 8"
      />
    </>
  );
};

/**
 * The isolator — a knife switch, per the design's own component.
 *
 * `closed` and `live` stay separate inputs, and this still draws all three sensible
 * combinations. What changed is what reaches it: every source now reports the two as
 * one value, because a switch drawn closed under a source that is feeding nothing was
 * the shape of an answer contradicting the caption beside it. See `isolatorStateOf`.
 *
 * `open` + `live` remains impossible, and no producer can express it.
 */
const Isolator = ({y, closed, live}: {y: number; closed: boolean; live: boolean}) => {
  const sourceX = SWITCH_X + SOURCE_TERMINAL;
  const loadX = SWITCH_X + LOAD_TERMINAL;
  const bladeStartX = sourceX + 3.5;

  const bladeEnd = closed
    ? {x: bladeStartX + BLADE_LENGTH, y}
    : {
        x: bladeStartX + BLADE_LENGTH * Math.cos(BLADE_ANGLE * RADIANS),
        y: y - BLADE_LENGTH * Math.sin(BLADE_ANGLE * RADIANS),
      };

  const conductorClass = live ? 'text-teal' : 'text-tertiary';

  return (
    <g>
      {/* Both terminals. Filled while the set is live, hollow when it isn't —
          which is what makes an open isolator on a dead bus read as "nothing
          here is energised" rather than merely "a line is missing". */}
      {[sourceX, loadX].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r={3.5}
          className={cn('stroke-current', conductorClass)}
          strokeWidth={1.5}
          fill={live ? 'currentColor' : 'var(--canvas)'}
        />
      ))}

      {live && (
        <line
          x1={bladeStartX}
          y1={y}
          x2={bladeEnd.x}
          y2={bladeEnd.y}
          className="stroke-current text-teal opacity-20"
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <line
        x1={bladeStartX}
        y1={y}
        x2={bladeEnd.x}
        y2={bladeEnd.y}
        className={cn('stroke-current', conductorClass)}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
};

// ─── Nodes ───────────────────────────────────────────────────────────────────

/**
 * One box in the diagram — 88 × 74, straight off the design.
 *
 * HTML rather than SVG text, so the label sits on the app's type scale and its
 * tokens instead of a hand-set font size, and so the box reuses the same border,
 * surface and icon-tile treatment every other card on the page uses.
 */
const Node = ({
  icon: Icon,
  label,
  caption,
  /**
   * What is standing on this device, drawn as the app's alarm pill under the caption
   * — or `undefined` for a node that is not a device, and for the whole drawing when
   * it is rendered without counts.
   *
   * `StaticAlarmBadge` rather than `AlarmBadge`: a device node **is** a `<button>`,
   * and an anchor inside a button is invalid markup — the browser closes the button
   * and the node stops selecting. Nothing is lost, because a click on the node already
   * opens that device's card beside the drawing and the card's own pill is the link.
   */
  counts,
  /** The power line under the caption — a kW figure, or why there isn't one. */
  power,
  /** `false` dims the power line: it is a word about state, not a measurement. */
  powered,
  live,
  x,
  y,
  /**
   * What clicking this node picks, or `undefined` for a node that is not a device
   * and must therefore not look like a control. See the file header.
   */
  onSelect,
  selected = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  counts?: Record<AlertSeverity, number>;
  power: string;
  powered: boolean;
  /** `undefined` for the load — nothing reports its state, so it gets no dot. */
  live?: boolean;
  x: number;
  y: number;
  onSelect?: () => void;
  selected?: boolean;
  className?: string;
}) => {
  const body = (
    <>
      <div
        className={cn(
          // `bg-element` is unconditional, and that is the fix rather than a tidy-up:
          // this surface is what hides the conductors that run *underneath* a box. See
          // the hover/selection layer below.
          'relative flex h-[74px] w-[88px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-element pt-2.5 pb-2',
          // The border says whether the thing is *live*, so selection cannot use it
          // — a picked dead genset and a live one have to stay tellable apart. A ring
          // sits outside the border and is the one affordance orthogonal to it.
          live === true ? 'border-teal/40' : 'border-default',
          selected && 'ring-2 ring-strong',
          className,
        )}
      >
        {/* Hover and selection as a **layer over** the surface, never as the surface.

            `highlight` is an overlay token — 7% black, 8% white — and `colors.ts` says
            so in as many words: "Overlay — layer, don't replace." Set as this box's
            `bg-*` it did replace `bg-element`, because that is what tailwind-merge is
            for, and a picked box stopped being opaque.

            Every other node has nothing behind it and so never showed this. A source's
            run starts at its box's right edge, the tie between two of them runs through
            the gap where their captions are, and the tap stops dead on the load's left
            edge. The cabinet is the exception: it is **centred on the junction**, so
            every source's run comes down its own centreline and ends inside it.
            `CABINET_X` chose that geometry precisely so the meeting happens where a
            reader cannot see it — which holds only while the box is a solid. Picking it
            drew all three runs straight through the icon.

            One span serves both states because they are one appearance at one value;
            it sits first so the tile, the label and the state dot paint over it. */}
        {onSelect !== undefined && (
          <span
            className={cn(
              'absolute inset-0 transition-colors',
              selected ? 'bg-highlight' : 'group-hover:bg-highlight',
            )}
            aria-hidden="true"
          />
        )}

        <span
          className={cn(
            'relative flex size-8 items-center justify-center rounded-md',
            live === true ? 'bg-teal/16' : 'bg-highlight',
          )}
        >
          <Icon
            className={cn('size-[18px]', live === true ? 'text-teal' : 'text-primary')}
            aria-hidden="true"
          />
        </span>
        <p className="relative text-xs font-semibold whitespace-nowrap text-primary">
          {label}
        </p>
        {live !== undefined && (
          <span
            className={cn(
              'absolute top-[7px] left-[7px] size-[7px] rounded-full',
              live ? 'bg-teal' : 'bg-tertiary',
            )}
          />
        )}
      </div>
      {/* The two caption lines, on a ground of their own.

          `bg-canvas` is invisible everywhere except where it matters: at a solar
          hybrid the DC tie runs down this box's centreline and through this text, and
          the band is what breaks the conductor around the words instead of letting it
          strike through them. `w-fit` so the ground hugs the text rather than masking
          the full 88px — a 88px bar would put a visible gap in the tie the width of
          the box. See `TIE_X`. */}
      <div className="mx-auto w-fit bg-canvas px-1">
        <p className="pt-1 text-center text-[11px] leading-[13px] whitespace-nowrap text-secondary">
          {caption}
        </p>
        <p
          className={cn(
            'text-center text-[11px] leading-[13px] font-medium whitespace-nowrap',
            powered ? 'text-primary' : 'text-tertiary',
          )}
        >
          {power}
        </p>
      </div>

      {/* Outside the caption's `bg-canvas` band and centred on the box rather than on
          the text, so the four pills down a drawing line up with each other and can be
          read as a column. Drawn on every device node including a quiet one — a pill
          that appeared only where something was wrong would make its *absence* the
          signal, and an absence is what a node with no plant behind it looks like too.
          A severity with nothing standing draws a dash, so a healthy node is three
          quiet marks rather than three zeros. See `AlarmCounts`. */}
      {counts !== undefined && (
        <div className="mt-1 flex justify-center">
          <StaticAlarmBadge counts={counts} />
        </div>
      )}
    </>
  );

  if (onSelect === undefined) {
    return (
      <div className="absolute" style={{left: x, top: y, width: NODE_W}}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      // `aria-pressed` rather than a tablist: the boxes are laid out at measured
      // coordinates across two columns, and a tablist promises an order to arrow
      // through that this drawing does not have. A pressed toggle is the honest
      // reading — "show me this one" — and it is what the ring draws.
      aria-pressed={selected}
      // The caption lines are inside the target, not just the box: they are what
      // says *which* genset, so they are part of the thing being picked, and the
      // 88 × 104 that gets is a comfortable hit area at the scales this drawing
      // shrinks to.
      className="group absolute cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-outline"
      style={{left: x, top: y, width: NODE_W}}
    >
      {body}
    </button>
  );
};

/**
 * What a set is putting into the bus, written under its node.
 *
 * Only a connected, turning set gets a figure. The rest get a word, because the
 * alternative — `0 kW` — is a *measurement*, and claiming to have measured zero at
 * a machine that is unreachable is a stronger statement than the page is
 * entitled to make. `off-load` is the interesting one: the set is running, and
 * isolated, so it is producing nothing here by choice.
 */
const powerLabel = (runState: RunState, live: boolean, loadKw: number | null): string => {
  if (live && loadKw !== null) return amount(loadKw, 'kW');
  if (runState === 'RUNNING') return 'off-load';
  if (runState === 'IDLE') return 'stopped';
  return 'unavailable';
};

/**
 * The same sentence for the grid, in the same three words where they apply.
 *
 * `off-load` is doing real work here and it is the reason this whole file changed.
 * A healthy incomer sitting behind a set that has the load is **off-load** — present,
 * fine, not carrying — and that is the picture of a **test run**. `failed` is the
 * other case, and the two must never be drawn the same way: one is a chore somebody
 * scheduled, the other is why the site is on diesel.
 */
/**
 * What the cabinet is doing, written under its node.
 *
 * The same four states `cabinet.type.ts` gives `carrying`, and derived the same way
 * from `siteFeed` — an incomer and a set both arrive through the rectifiers, the
 * array through its SSUs, and the other two are the box converting nothing. They stay
 * separate for that file's reason: a bank carrying is a solar hybrid working exactly
 * as bought, every night, and an unserved tower is an outage.
 *
 * Derived here rather than read off an assembled `SubrackCabinet` so this component
 * stays a pure function of its props — see `hasCabinet`.
 */
export const cabinetPowerLabel = (source: SiteFeed['source']): string => {
  if (source === 'MAINS' || source === 'GENSET') return 'rectifiers';
  if (source === 'SOLAR') return 'SSUs';
  if (source === 'BATTERY') return 'bank carrying';
  return 'not served';
};

const mainsPowerLabel = (mains: MainsSupply, carrying: boolean): string => {
  if (!mains.live) return 'failed';
  if (!carrying) return 'off-load';
  // Carrying, so there is real power here and the incomer's own figure says how
  // much. The three words above are states of the supply; this is its reading.
  return amount(mains.kw, 'kW');
};

/**
 * One row of the diagram: a box, its switch, and its run onto the bus.
 *
 * The mains and a genset differ in exactly three things a reader can see — the
 * glyph, the two caption lines, and where the switch stands — so they are one shape
 * here rather than two branches through the render. Everything geometric is shared
 * by construction, which is what guarantees a conductor cannot land in mid-air on
 * one kind of source and not the other.
 */
export type DiagramSource = {
  key: string;
  icon: LucideIcon;
  /** The word inside the box — `MAINS` or `GENSET`, as the design writes them. */
  label: string;
  /** First caption line: which supply or which asset this is. */
  caption: string;
  /** Second caption line: what it is putting into the bus. */
  power: string;
  switchState: SwitchState;
  /**
   * Whether this source is **taking** power rather than giving it — the bank on
   * charge, and nothing else in this drawing.
   *
   * Here rather than recomputed where it is read, because it is the same fact the
   * `power` line and `switchState` above are already derived from, and one row
   * deciding its own state once is what keeps the two conductors that meet at this
   * box from disagreeing about which way the power is going. See `bankFlow`.
   */
  charging?: boolean;
};

/**
 * The device a source node stands for, or `undefined` if it is not a device.
 *
 * The mains is the `undefined` case and the only one: an incomer is a supply the
 * site is connected to, not a machine on this estate's books, so there is no device
 * card behind it and its node must not offer a click. Every other source key is
 * either the bank or a genset's own id.
 */
export const deviceOfSource = (key: string): SiteDeviceKey | undefined =>
  key === 'mains'
    ? undefined
    : key === 'battery'
      ? 'battery'
      : key === 'solar'
        ? 'solar'
        : gensetDeviceKey(key);

/** Everything the drawing needs to act as the page's device picker. */
export type SiteDiagramSelection = {
  /** The devices with a card behind them. Anything else stays inert. */
  devices: Array<SiteDeviceKey>;
  selected: SiteDeviceKey | undefined;
  onSelect: (device: SiteDeviceKey) => void;
};

/**
 * The click handler for one node, or `undefined` to leave it inert.
 *
 * The single place the three conditions meet: the caller wired a selection, this
 * node stands for a device, and that device is one the page can actually show.
 */
const selectHandler = (
  selection: SiteDiagramSelection | undefined,
  device: SiteDeviceKey | undefined,
): (() => void) | undefined =>
  selection === undefined || device === undefined || !selection.devices.includes(device)
    ? undefined
    : () => selection.onSelect(device);

/**
 * The array as a row, or nothing at a site without one.
 *
 * ## Why it now carries an isolator
 *
 * It did not before, and the note that argued against one was right about the drawing
 * it was in: the array had a single conductor into the battery and nothing else, so a
 * switch on it would have implied the array could be isolated and the bank carry on —
 * which is backwards, since it was the bank's converter the array reached the load
 * through.
 *
 * With the array on the bus in its own right, an isolator is the true statement. A PV
 * converter has a DC disconnect; pulling it takes the array off the plant and leaves
 * the bank and the sets carrying the tower, which is exactly what the drawing then
 * shows. The three rows being one shape is the secondary benefit — a row with no
 * switch between two rows that have one reads as a drawing that forgot something.
 *
 * ## `night` rather than `0 kW`
 *
 * A converter exporting nothing is off, not idling, and there is no third state. Same
 * rule the genset captions follow: a measurement of zero and an absence of one are
 * different claims, and only one of them is true after dark.
 */
const solarSource = (
  summary: SiteSummary,
  role: SitePowerRole,
): Array<DiagramSource> => {
  if (!hasSolar(role)) return [];

  const seed = siteSeed(summary.site.id);
  const solarKw = seed === undefined ? 0 : hybridState(seed, role).solarKw;
  const generating = solarKw > 0;

  return [
    {
      key: 'solar',
      icon: SunMediumIcon,
      label: 'SOLAR',
      caption: 'PV array',
      power: generating ? amount(solarKw, 'kW', 1) : 'night',
      /**
       * Open after dark, not closed onto a dead run.
       *
       * Physically the DC disconnect is not thrown at sunset, and the earlier drawing
       * said so. But the drawing answers *what is feeding this tower*, and a closed
       * switch under a dark array was the shape of an answer contradicting the words
       * beside it — see `isolatorStateOf`, which took the same decision for the sets.
       * The caption still says `night`, which is the honest version of the same fact.
       */
      switchState: {closed: generating, live: generating},
    },
  ];
};

/**
 * Which way the bank's power is going — and it is **one** of these, always.
 *
 * ## The standing rule
 *
 * A bank charges or it discharges. It never does both, and no drawing of one may
 * show both, because there is one set of terminals and the current through them has
 * one sign. That is not a stylistic preference about this diagram; it is the only
 * thing a reader can safely assume about a battery.
 *
 * The drawing broke it, and broke it in the ordinary case rather than an edge one.
 * Two conductors meet at this box — the DC tie coming down from the array, which is
 * what charges the bank, and the run out to the junction, which is what the bank
 * discharges through — and each decided its own state from a different figure. The
 * run read the sign of `batteryKw`; the tie read whether the array was generating.
 * At the shoulders of the day both said yes: at 08:00 here the roof makes 0.3 kW
 * against a 5 kW tower, so the bank is discharging *and* the array is generating, and
 * the drawing lit the tie into the bank and the run out of it at the same time. Five
 * hours of every day, at all four solar hybrids, drawn as a bank filling and emptying
 * at once.
 *
 * So the sign is read **once**, here, into one of three states, and both conductors
 * are derived from it. Charging lights the tie and kills the run; discharging does
 * the reverse; standby kills both. Two conductors cannot contradict each other about
 * a fact neither of them owns.
 *
 * ## Why `STANDBY` is a state and not a rounding of the other two
 *
 * Two cases reach it and both used to print `charging`, which was the wrong word for
 * each:
 *
 *  - **A set is carrying the tower.** The bank may be discharging on the model's
 *    figures, but it is not what is holding the tower up and must not be drawn doing
 *    so — this is the `!gensetCarrying` clause the run has always had. What changes is
 *    that failing that test no longer falls through to the word `charging`, which
 *    claimed the opposite of what the model said.
 *  - **A bank with no cycle**, where `bankCycle` answers zero. Nothing is moving, and
 *    a plant reporting no flow is not a plant on charge.
 */
type BankFlow = 'CHARGING' | 'DISCHARGING' | 'STANDBY';

const bankFlow = (batteryKw: number, gensetCarrying: boolean): BankFlow => {
  // The sign, and nothing else, decides between the two live states —
  // `HybridState.batteryKw` is positive discharging, negative charging.
  if (batteryKw < 0) return 'CHARGING';
  if (batteryKw > 0 && !gensetCarrying) return 'DISCHARGING';
  return 'STANDBY';
};

/**
 * Every source feeding this site's bus, top to bottom.
 *
 * ## The order, and what it says
 *
 * **Array, mains, bank, sets.** Reading the column downwards is reading the order
 * the site uses its sources in — which is why the bank sits above the machine that
 * charges it, and why the array, the one source that costs nothing to run, sits above
 * everything.
 *
 * The array is in this list at all as of the column rework; it used to be a shape of
 * its own in a column of its own. See `TIE_X` for what that cost and what came
 * back in its place.
 *
 * No site has both an incomer and an array today — `hasMains` is `GRID_BACKUP` only
 * and `hasSolar` is `SOLAR_HYBRID` only — so the relative order of those two is a
 * decision nothing currently exercises.
 */
export const sourcesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): Array<DiagramSource> => {
  const feed = siteFeed(summary, dutyId, role);
  const gensetCarrying = feed.source === 'GENSET';

  const gensets: Array<DiagramSource> = summary.gensets.map(({genset, detail}) => {
    const switchState = isolatorStateOf(genset.runState, genset.id === dutyId);
    return {
      key: genset.id,
      icon: BoomBoxIcon,
      label: 'GENSET',
      caption: genset.tag,
      power: powerLabel(genset.runState, switchState.live, detail.loadKw),
      switchState,
    };
  });

  const sources: Array<DiagramSource> = [];

  if (hasMains(role)) {
    sources.push({
      key: 'mains',
      icon: UtilityPoleIcon,
      label: 'MAINS',
      caption: 'Grid supply',
      power: mainsPowerLabel(
        summary.mains,
        mainsContactorStateOf(summary.mains, gensetCarrying).live,
      ),
      switchState: mainsContactorStateOf(summary.mains, gensetCarrying),
    });
  }

  if (hasBattery(role)) {
    const seed = siteSeed(summary.site.id);
    const state =
      seed === undefined ? {solarKw: 0, soc: 0, batteryKw: 0} : hybridState(seed, role);

    // Charging and discharging are one node and two directions, which is why the
    // caption carries the state of charge and the power line carries the sign. A
    // bank drawn as two nodes would suggest the site has two of them.
    //
    // And one node means one direction at a time. Every appearance of this row — the
    // word under it, whether its isolator is shut, and whether the tie coming into it
    // from above is carrying — comes off this single answer. See `bankFlow`.
    const flow = bankFlow(state.batteryKw, gensetCarrying);

    /**
     * The bank's run is now the **bank's own**, which it was not before.
     *
     * It used to be live whenever the array *or* the bank was delivering, because the
     * array had no path to the bus of its own — it reached the load through this
     * converter, so reading the run off the bank alone drew the tower unserved at two
     * in the afternoon with a full array beside it.
     *
     * The array has its own row and its own run now, so that borrowing is over: this
     * conductor is live when the bank is discharging and dead when it is charging,
     * which is the whole of what it claims. The afternoon-surplus case reads correctly
     * and more sharply than before — the solar row carries, the bank's row is dead,
     * and the caption says `charging`.
     */
    sources.push({
      key: 'battery',
      icon: BatteryChargingIcon,
      label: 'BATTERY',
      caption: `${Math.round(state.soc * 100)}% charged`,
      /* The reading when the bank is delivering, and a word when it is not. `standby`
         is the honest third answer rather than a fall-through to `charging`: a bank
         behind a running set, or one with nothing moving at all, is neither filling
         nor emptying, and this line used to say it was filling in both cases. */
      power:
        flow === 'DISCHARGING'
          ? amount(state.batteryKw, 'kW', 1)
          : flow === 'CHARGING'
            ? 'charging'
            : 'standby',
      // What the tie above this box reads to decide whether it is carrying, so that
      // the conductor into the bank and the conductor out of it can never both be
      // live. This is the standing rule, and `bankFlow` is where it is argued.
      charging: flow === 'CHARGING',
      // Open unless the bank is delivering. A bank taking charge is a load on the
      // plant rather than a source on it, and drawing its tie closed put a shut
      // switch on the one run in the drawing carrying nothing towards the tower.
      switchState: {closed: flow === 'DISCHARGING', live: flow === 'DISCHARGING'},
    });
  }

  return [...solarSource(summary, role), ...sources, ...gensets];
};

/**
 * How wide this site's canvas is, in the design's own pixels.
 *
 * A constant again, and kept as a function of the role on purpose.
 *
 * It has been three things: 398 for every site, then 530 at a solar hybrid when the
 * array had a column of its own, then 418 when that became a 20px tie gutter. The
 * array is a row and the tie runs down the boxes themselves, so there is no gutter and
 * every role is back to the design's 398. A solar hybrid's drawing is **taller** than
 * the others and no wider.
 *
 * Still exported, still takes the role: the site page grid-templates a column off it,
 * and the next thing that widens one role's canvas should be a change here rather than
 * a number to hunt for in a caller.
 */
/**
 * The canvas width, which the page needs before the drawing renders — it sizes the
 * grid track the diagram sits in.
 *
 * Takes whether the site has a cabinet rather than the site itself, so the settings
 * page's two live previews can ask for either arrangement without inventing a site.
 */
export const siteDiagramWidth = (_role: SitePowerRole, hasCabinet = false): number =>
  hasCabinet ? WIDTH_CABINET : WIDTH_BARE;

// ─── The diagram ─────────────────────────────────────────────────────────────

export const SiteDiagram = ({
  summary,
  /** The set the changeover has on the bus. Drives every isolator in the drawing. */
  dutyId,
  /**
   * `GRID_BACKUP` draws the mains above the gensets; `DIESEL_PRIME` draws gensets alone.
   *
   * Passed in rather than read from the config store here, so this stays a pure
   * function of its inputs — which is what lets the settings page render it twice,
   * once per role, as a live preview of a choice not yet made.
   */
  role,
  /**
   * Turns the drawing into the page's device picker — see the file header. Omitted
   * leaves every node inert.
   */
  selection,
  /**
   * What is standing on each device, so the drawing can say **which box has the
   * alarms** rather than only which box is feeding.
   *
   * Keyed by `SiteDeviceKey`, the same key `selection` picks by, so the node a reader
   * clicks and the pill under it are addressing one device by one name. A key that is
   * absent draws no pill, which is what keeps the mains and the load — neither of them
   * a device — clean.
   *
   * **Handed in rather than derived here**, for the reason `role` is: this stays a
   * pure function of its props, so the settings page can render it twice as a preview
   * of a role nobody has chosen yet. That preview passes no counts, and the drawing
   * then reserves no room for them — see `PILL_ROOM`.
   */
  alarms,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
  selection?: SiteDiagramSelection;
  alarms?: Partial<Record<SiteDeviceKey, Record<AlertSeverity, number>>>;
}) => {
  const sources = sourcesOf(summary, dutyId, role);
  const count = Math.max(1, sources.length);
  const feed = siteFeed(summary, dutyId, role);
  // Whether this site has a DC plant to draw — every solar hybrid, plus the
  // instrumented site whatever its role. `siteHasCabinet` rather than assembling the
  // cabinet itself, for the reason the site rail gives: this is a drawing deciding
  // whether to place a box, and it should not have to build the room behind it. It is
  // also the only form that keeps this component pure — `subrackCabinet` defaults its
  // clock to `Date.now()`, and the settings page renders this twice as a preview.
  //
  // Role-driven, so flipping a site to a solar hybrid on its Settings tab puts the
  // cabinet into this drawing at once, exactly as it does the array and the bank.
  const hasCabinet = siteHasCabinet(summary.site.id, role);
  // Who is feeding and how much are two questions, answered separately — see
  // `siteLoadKw`. `null` here means nothing is feeding the load at all.
  const loadKw = siteLoadKw(summary, dutyId, role);

  // The pitch and the bottom margin both open up by one pill's height when there are
  // pills to draw, so the drawing keeps the design's gap between a node's last line and
  // the next node's box either way. Every conductor in the drawing is derived from
  // these two, so nothing else has to know. See `PILL_ROOM`.
  const pillRoom = alarms === undefined ? 0 : PILL_ROOM;
  const pitch = PITCH + pillRoom;
  const caption = CAPTION + pillRoom;

  /** Centreline of source `index` — where its conductor leaves the box. */
  const centreline = (index: number) => index * pitch + NODE_H / 2;

  const height = (count - 1) * pitch + NODE_H + caption;
  // The point every source's run meets at: the cabinet's centre where there is one,
  // and the bare drawing's own elbow line where there is not. See `CABINET_X`.
  const junctionX = hasCabinet ? JUNCTION_X_CABINET : JUNCTION_X_BARE;
  const loadX = hasCabinet ? LOAD_X_CABINET : LOAD_X_BARE;
  const width = hasCabinet ? WIDTH_CABINET : WIDTH_BARE;
  const anyLive = sources.some((source) => source.switchState.live);

  /**
   * Whether this site's column carries the DC tie down the boxes' centreline.
   *
   * Keyed on the array rather than on the bank, and the reason is the coupling. A
   * `DIESEL_HYBRID` bank sits on the bus beside its sets and is charged off it, which
   * is what a bus draws correctly. A solar hybrid's array has no other way in — it is
   * DC-coupled through the bank's own converter — so the bank stops being a source
   * among several and becomes the node the other two hang off. See `TIE_X`.
   */
  const tied = hasSolar(role);
  const batteryIndex = Math.max(0, sources.findIndex((source) => source.key === 'battery'));

  /**
   * The drawing's own centreline: the junction, the tap and the load box all sit on it.
   *
   * The **midpoint of the top and bottom sources**, in both drawings, which is the
   * design's own arrangement — a single-source site's load lines up with its source and
   * a two-source site's is symmetric between them. It is also the only answer to
   * "centred between the array and the set" that stays true as sets are added; pinning
   * it to the bank's row instead put the load level with the bank and left it visibly
   * high at a two-set site.
   */
  const busY = (centreline(0) + centreline(count - 1)) / 2;

  /**
   * The tie between two neighbouring boxes, and whether it is carrying.
   *
   * Two conditions, and it needs both:
   *
   *  - **The bank is on charge.** This conductor's whole job is charging it — that is
   *    what `TIE_X` says it is for and what distinguishes it from the bus on the other
   *    side of the boxes — so a tie carrying while the bank discharges is a line drawn
   *    into a battery that is emptying. It used to do exactly that for five hours a
   *    day. See `bankFlow` for the rule and how the drawing came to break it.
   *  - **The source at the far end is delivering**, read off the row *further from the
   *    bank*, because a tie is about the thing on its other end: the array's tie is
   *    the array's, a set's tie is that set's. Without this the daylight window would
   *    light the tie up to a dark roof and the tie down to a stopped set at the same
   *    time, both claiming to be the thing doing the charging.
   *
   * What the pair buys is that the array's own run to the junction stays the only
   * place its output is drawn heading for the tower. The tie is charge and nothing
   * else, so at 08:00 — roof making 0.3 kW, tower drawing 5, bank covering the
   * difference — the array carries to the junction, the bank carries to the junction,
   * and the tie between them is dead. Which is what is happening.
   */
  const bankCharging = sources[batteryIndex]?.charging === true;

  const tieLive = (index: number): boolean => {
    if (!bankCharging) return false;

    const away =
      Math.abs(index - batteryIndex) >= Math.abs(index + 1 - batteryIndex) ? index : index + 1;
    return sources[away]?.switchState.live ?? false;
  };

  /**
   * The sources in **paint order: every dead run first, then every live one.**
   *
   * Not cosmetic. Each source elbows onto the bus riser at `BUS_X` and then runs
   * along it to the tap at `busY`, so with three or more sources those riser
   * segments *overlap* — an outer source's run passes straight through the stretch
   * an inner one occupies. In document order the later source wins, which means a
   * dead genset can paint a grey stub over the live mains riser above it and leave
   * the drawing showing a conductor that goes dead halfway to the load.
   *
   * Ordering by state instead of position makes that unrepresentable: a dead run can
   * never obscure a live one, whatever the source count or which of them is
   * carrying. The `y` is captured from the original index first, because paint order
   * must not move a box.
   */
  const rows = sources
    .map((source, index) => ({source, y: centreline(index)}))
    .sort((left, right) => Number(left.source.switchState.live) - Number(right.source.switchState.live));

  /**
   * How much of the canvas fits, and therefore what to scale it by.
   *
   * Measured rather than derived from a breakpoint, because the space this drawing
   * gets is not a function of the viewport: the site page gives it a whole line, the
   * settings page gives it half of one, and both can be any width. Only ever scaled
   * *down* — a 398px drawing stretched across a desktop column would be a different
   * design, not a larger one.
   *
   * `0` on the first render, before the ref is attached, which reads as scale 1 and
   * paints the drawing at full size for one frame. That is the right way round: the
   * alternative is a frame of nothing, and one frame at 1.0 in a container that turns
   * out to be narrower is invisible next to a flash of empty space.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const scale = available === 0 ? 1 : Math.min(1, available / width);

  return (
    <div
      ref={boxRef}
      // Takes the width it is given and reserves the *scaled* height, so the rest of
      // the page packs against the drawing's real size rather than the canvas's.
      //
      // Sized by `width` and `max-width` rather than a flex basis, and that is not a
      // style preference: a basis applies to the **main axis**, so the one value that
      // means "398px wide" in the site page's desktop row means "398px tall" in its
      // phone column — which is exactly the wrong number in the one place the height
      // is being computed. Width and max-width mean the same thing in both.
      className="relative w-full shrink"
      style={{maxWidth: width, height: height * scale}}
    >
      {/* The canvas: always the measured 398px wide, and scaled as one piece. Every
          coordinate below is therefore the design's, at every viewport width — which
          is the whole point of scaling rather than reflowing. */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{width, height, transform: `scale(${scale})`}}
      >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 overflow-visible"
        // The picture, and the whole block's description with it. On the `<svg>`
        // rather than the wrapper so the node buttons stay in the accessibility
        // tree — see the file header.
        role="img"
        aria-label={`${summary.site.name} single-line diagram: ${
          hasMains(role) ? 'mains supply, ' : ''
        }${hasSolar(role) ? 'PV array, ' : ''}${hasBattery(role) ? 'battery, ' : ''}${
          summary.gensets.length
        } genset${summary.gensets.length === 1 ? '' : 's'}, ${
          feed.source === 'GENSET'
            ? `${summary.gensets.find(({genset}) => genset.id === feed.gensetId)?.genset.tag} feeding the load`
            : feed.source === 'MAINS'
              ? 'on mains'
              : feed.source === 'SOLAR'
                ? 'on solar'
                : feed.source === 'BATTERY'
                  ? 'on battery'
                  : 'nothing feeding the load'
        }${loadKw === null ? '' : ` at ${amount(loadKw, 'kW')}`}`}
      >
        {/* The DC tie: one conductor per neighbouring pair, down the boxes' own
            centreline, from the lower edge of one to the upper edge of the next.

            Drawn per pair rather than as one riser because each pair is a separate
            claim — the array into the bank, then the bank into the set — and each is
            live or dead on its own. It passes behind the caption lines, which carry
            the canvas colour so the words break the line rather than the line striking
            the words. See `TIE_X`. */}
        {tied &&
          sources.slice(0, -1).map((source, index) => (
            <Conductor
              key={`tie-${source.key}`}
              points={[
                [TIE_X, index * pitch + NODE_H],
                [TIE_X, (index + 1) * pitch],
              ]}
              live={tieLive(index)}
            />
          ))}

        {rows.map(({source, y}) => {
          const {closed, live} = source.switchState;

          return (
            <g key={source.key}>
              {/* Source → switch. */}
              <Conductor
                points={[
                  [NODE_W, y],
                  [SWITCH_X + SOURCE_TERMINAL, y],
                ]}
                live={live}
              />

              <Isolator y={y} closed={closed} live={live} />

              {/* Switch → the junction, as the design's elbow: out to `junctionX`,
                  then along it to the point every source meets at. Square the whole
                  way — see `JUNCTION_X_BARE` for why one meeting point and right angles
                  together leave no other shape.

                  An open switch's run is drawn dead all the way, because nothing past
                  a lifted blade is energised. */}
              <Conductor
                points={[
                  [SWITCH_X + LOAD_TERMINAL, y],
                  [junctionX, y],
                  [junctionX, busY],
                ]}
                live={live}
              />
            </g>
          );
        })}

        {/* The junction → the load: the design's 67px tap, and the one conductor in
            the drawing that carries the tower. Live if anything at all is feeding.

            Where there is a cabinet it leaves that box's right edge instead of the
            junction, because the junction is now the box's left edge and a tap drawn
            from there would run underneath it. The run is the same length either way
            — see `CABINET_X`. */}
        <Conductor
          points={[
            [hasCabinet ? CABINET_X + NODE_W : junctionX, busY],
            [loadX, busY],
          ]}
          live={anyLive}
        />

        {/* The junction itself — one dot, where every source's run and the tap into
            the load all meet. Only where no cabinet stands on it: the box says the same
            thing better, and both together is a dot bisected by a border. See
            `CABINET_X`. */}
        {!hasCabinet && (
          <circle
            cx={junctionX}
            cy={busY}
            r={3.5}
            className={cn('stroke-current', anyLive ? 'text-teal' : 'text-tertiary')}
            strokeWidth={1.5}
            fill={anyLive ? 'currentColor' : 'var(--canvas)'}
          />
        )}
      </svg>

      {sources.map((source, index) => {
        const device = deviceOfSource(source.key);

        return (
          <Node
            key={source.key}
            icon={source.icon}
            label={source.label}
            caption={source.caption}
            counts={device === undefined ? undefined : alarms?.[device]}
            power={source.power}
            powered={source.switchState.live}
            live={source.switchState.live}
            x={0}
            y={index * pitch}
            onSelect={selectHandler(selection, device)}
            selected={device !== undefined && device === selection?.selected}
          />
        );
      })}

      {/* The DC plant, standing on the junction its sources arrive at. A control like
          the source boxes — clicking it opens the cabinet in the panel beside the
          drawing, which is the door this asset did not have. See `CABINET_X`. */}
      {hasCabinet && (
        <Node
          icon={ServerIcon}
          label="CABINET"
          caption="DC plant"
          counts={alarms?.cabinet}
          power={cabinetPowerLabel(feed.source)}
          // Dimmed unless the box is actually converting. `bank carrying` and `not
          // served` are both words about a shelf doing nothing, and the power line's
          // contract is that a bright value is a measurement.
          powered={feed.source !== 'BATTERY' && feed.source !== 'NONE'}
          // The bus is energised whenever anything is feeding the tower, including
          // off the bank — the BLVD is in this box too. That is a different question
          // from whether the *converters* are working, which the caption answers.
          live={anyLive}
          x={CABINET_X}
          y={busY - NODE_H / 2}
          onSelect={selectHandler(selection, 'cabinet')}
          selected={selection?.selected === 'cabinet'}
        />
      )}

      <Node
        icon={FactoryIcon}
        label="LOAD"
        // The site's draw, stated where the power actually arrives. On a site with
        // nothing feeding it, this is not "0 kW" — that would read as a load that
        // has gone away, when in fact it is a load nobody is currently serving.
        caption="Site draw"
        power={loadKw === null ? 'not served' : amount(loadKw, 'kW')}
        powered={anyLive}
        x={loadX}
        y={busY - NODE_H / 2}
      />
      </div>
    </div>
  );
};
