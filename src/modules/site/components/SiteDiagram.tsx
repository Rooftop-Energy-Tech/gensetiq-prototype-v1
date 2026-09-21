import {useRef} from 'react';
import {useNavigate} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {FactoryIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SiteDeviceKey} from '../types/device.type';
import {fromSite} from '../types/fromSearch.type';
import {hasMains} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {deviceOfSource, deviceRoutes, sourcesOf} from '../data/siteSources';
import type {SiteSceneSelection} from '../data/siteSources';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';

/**
 * The site's single-line diagram: every genset, its isolator, the bus they share,
 * and the load at the end of it.
 *
 * ## It was removed, and it is back
 *
 * It came out when the telco plant did, on the argument that "a circuit of an
 * incomer, a bus and a set is a telco DC plant drawing, and with two roles left it
 * had two boxes and a wire to show". The plant scene was to answer the same question
 * by drawing the compound — and then the scene came out too, because a radio mast and
 * a row of equipment cabinets draw a *telco* site and this product posts a genset to a
 * yard. What was left was a pill picker, which draws nothing at all.
 *
 * So the schematic is the drawing that survives the change of product, and that is
 * the case for it rather than nostalgia: a set, its isolator and what it is feeding
 * is the *electrical* truth about a yard whatever the yard is there for — a
 * substation, a quarry, a construction compound. Nothing in it claims a telco site.
 * Tristan's call, 2026-09-21. It is restored stripped to what this product has: an
 * incomer where the role has one, one row per set, and the load. The array, the bank,
 * the DC tie and the subrack cabinet are gone with the plant they belonged to.
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
 * and it costs only type size: a 375px screen asks for 0.86 of the 398px canvas and
 * a legible 9.5px caption. Scrolling was the previous answer and it was worse: the
 * load node, the one thing the whole drawing points at, started off screen.
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
 * style choice: the `role="img"` and its long description sit on the `<svg>`
 * rather than on the whole block. `role="img"` tells a screen reader to treat a
 * subtree as one opaque image, so leaving it outside would have made the node
 * buttons unreachable. The conductors are the part that is a picture; the boxes are
 * text and, here, controls.
 *
 * ## The mains row
 *
 * A `GRID_BACKUP` site draws a **mains source above its gensets**, on its own
 * contactor, onto the same bus. The frame has no such node — it draws only
 * gensets, which quietly makes every site look like it has nothing else feeding
 * it — and a page about *backup* power that never shows what is being backed up is
 * missing its subject. A bus is a bus, so it is a row like any other and every
 * measurement below applies to it unchanged.
 *
 * A `DIESEL_PRIME` site has no incomer, and draws its sets alone.
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
 * The band the alarm pill occupies **inside** a device's box — 24px of pill under 4px
 * of padding, straight off the design (node `3890:5629`, container at y=65, h=28).
 *
 * The first cut of this hung the pill *below* the two caption lines, outside the box.
 * The design puts it inside, directly under the label, and it is the better drawing for
 * a reason worth writing down: the box is the device, and the captions are a note about
 * it set on the canvas behind. A pill floating under the captions belonged to neither.
 *
 * A box carrying one therefore stands 102px rather than 74px, which is the design's own
 * pair of heights.
 *
 * Reserved only when `alarms` is passed. The settings page renders this drawing twice as
 * a preview of a power role, with no counts and nothing to say about alarms; making it
 * carry 28px of empty box per row for a pill it will not draw would stretch a preview to
 * buy nothing.
 */
const PILL_ROOM = 28;

/**
 * Where a conductor meets a box, measured from the box's top — and **not** half its
 * height, which is what it used to be.
 *
 * The two stopped being the same thing when a box grew to hold a pill. The mains and
 * the load carry none and stay 74px; every set stands 102px. Attaching at each box's
 * own centre would step the bus down 14px as it passed a device, which is a drawing
 * with a kink in it for a reason no reader could name.
 *
 * So it is a constant: half the box a node has *always* been, which is the height of
 * the part every node still shares — the icon tile and the label. The conductor arrives
 * beside the glyph, the pill hangs under it inside the same box, and boxes of two
 * heights still line up on the one line that matters.
 */
const ATTACH = NODE_H / 2;

const SWITCH_X = NODE_W + LEAD;
const BUS_X = SWITCH_X + SWITCH_W + ELBOW;

/** Where the load box sits, and therefore how wide the canvas is. */
const LOAD_X = BUS_X + TAP;
const WIDTH = LOAD_X + NODE_W;

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
 * The junction sits at the **midpoint of the sources**, so each source owns its own run
 * down or up to it. With three or more sources the outer runs do pass through the
 * stretch the inner ones occupy, and that overlap is real — see `rows` on why the paint
 * order is by liveness rather than by position, so a dead run can never be left
 * covering a live one.
 */
const JUNCTION_X = BUS_X;

/** Terminal centres inside the isolator, from the component's documentation. */
const SOURCE_TERMINAL = 18;
const LOAD_TERMINAL = 46;
const BLADE_LENGTH = LOAD_TERMINAL - SOURCE_TERMINAL - 7;
/** How far the blade lifts when the isolator is open. */
const BLADE_ANGLE = 35;

const RADIANS = Math.PI / 180;

/**
 * The canvas width, which the page needs before the drawing renders — it sizes the
 * grid track the diagram sits in.
 *
 * A constant, and still a function: the next thing that widens the canvas should be a
 * change here rather than a number to hunt for in a caller.
 */
export const siteDiagramWidth = (): number => WIDTH;

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
 * combinations. What changed is what reaches it: every source reports the two as
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
   * The pill is a **link to that device's own Alarms tab**, which is why the node
   * below is a `<div role="button">` and not a `<button>`: an anchor inside a button
   * is invalid markup — the browser closes the button, and the node stops selecting.
   * A div is not interactive content, so it may hold one.
   */
  counts,
  /** Where that pill goes. Absent with `counts`, present with it. */
  alarmsLink,
  /** What a double-click opens — this device's own page. Inert without a selection. */
  onOpen,
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
  alarmsLink?: {to: LinkProps['to']; params: LinkProps['params']; search: LinkProps['search']};
  onOpen?: () => void;
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
          // `pb-2` on the box rather than on the block below, so it is the *last* thing
          // in the box that clears the edge — the label where there is no pill, the pill
          // where there is. That is the design's pair of heights: 66 + 8 = 74 bare, and
          // 66 + 28 + 8 = 102 with a band.
          'relative flex w-[88px] flex-col items-center overflow-hidden rounded-lg border bg-element pb-2',
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
            for, and a picked box stopped being opaque — which matters here because a
            node's surface is what hides the conductor running under it.

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

        {/* The glyph and the name, in the 74px every box has always been — held at that
            height whether or not a pill hangs under it, so a node that carries one and a
            node that does not still line their labels up. 66px and not 74: the box's own
            `pb-2` is the eighth of those pixels, and it has to come *after* whatever is
            last in the box. `ATTACH` is measured against the box, not against this. */}
        <div className="flex h-[66px] shrink-0 flex-col items-center justify-center gap-2 pt-2.5">
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
        </div>

        {/* The pill, inside the box and under the name — the design's 28px band, 4px of
            padding over a 24px pill. Drawn on every device node including a quiet one, so
            its *absence* never becomes the signal; a severity with nothing standing draws
            a dash rather than a `0`. See `PILL_ROOM` and `AlarmCounts`.

            Both or neither: the caller looks the counts up and builds the link off the
            same device key, so a pill with nowhere to go cannot arise. */}
        {counts !== undefined && alarmsLink !== undefined && (
          <div className="relative flex h-[28px] w-full shrink-0 items-start justify-center pt-1">
            {/* `stopPropagation` so opening the queue does not also move the selection
                onto a device on a drawing we are in the middle of leaving — the split
                every table in this app makes between its row and its pill. */}
            <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
              <AlarmBadge
                counts={counts}
                to={alarmsLink.to}
                params={alarmsLink.params}
                search={alarmsLink.search}
              />
            </span>
          </div>
        )}

        {live !== undefined && (
          <span
            className={cn(
              'absolute top-[7px] left-[7px] size-[7px] rounded-full',
              live ? 'bg-teal' : 'bg-tertiary',
            )}
          />
        )}
      </div>
      {/* The two caption lines, on a ground of their own. `bg-canvas` so the words sit
          on the page's own colour rather than on whatever passes behind them, and
          `w-fit` so that ground hugs the text rather than masking the full 88px. */}
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
    /**
     * A `div` with the button role, not a `<button>`.
     *
     * A `<button>` may not contain an anchor — the browser closes the button at the
     * `<a>` and the rest of the node stops being clickable — and this node holds the
     * alarm pill, which is a link. A `div` is not interactive content, so it may hold
     * one, and the role and the key handling put back what the element gave away for
     * free.
     *
     * ## One click selects, two opens
     *
     * A single click puts this device in the card beside the drawing — the drawing's
     * job as the page's picker. A **double-click opens the device's own page**, which
     * is the gesture a reader already expects from a box in a diagram. The double-click
     * fires the select twice on its way through, which costs nothing: selecting the
     * same device twice is selecting it.
     *
     * ⚠️ Double-click is a mouse gesture and has no keyboard equivalent here. Enter and
     * Space select, and the card they open carries a link to the device's page — so the
     * keyboard route to it is one element further on rather than missing. The pill is
     * separately focusable and is a real link.
     */
    <div
      role="button"
      tabIndex={0}
      // `stopPropagation` because the canvas behind this box clears the selection —
      // without it every click would select and then immediately deselect. See
      // `onClear` on the diagram.
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // Space scrolls the page under the drawing otherwise.
        event.preventDefault();
        onSelect();
      }}
      // `aria-pressed` rather than a tablist: the boxes are laid out at measured
      // coordinates across two columns, and a tablist promises an order to arrow
      // through that this drawing does not have. A pressed toggle is the honest
      // reading — "show me this one" — and it is what the ring draws.
      aria-pressed={selected}
      // The caption lines are inside the target, not just the box: they are what
      // says *which* genset, so they are part of the thing being picked, and the
      // 88 × 134 that gets is a comfortable hit area at the scales this drawing
      // shrinks to. `select-none` so a double-click highlights nothing.
      className="group absolute cursor-pointer rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-outline"
      style={{left: x, top: y, width: NODE_W}}
    >
      {body}
    </div>
  );
};

/**
 * The click handler for one node, or `undefined` to leave it inert.
 *
 * The single place the three conditions meet: the caller wired a selection, this
 * node stands for a device, and that device is one the page can actually show.
 */
const selectHandler = (
  selection: SiteSceneSelection | undefined,
  device: SiteDeviceKey | undefined,
): (() => void) | undefined =>
  selection === undefined || device === undefined || !selection.devices.includes(device)
    ? undefined
    : () => selection.onSelect(device);

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
  /**
   * Clicking the canvas rather than a box — the way back to the site's own figures.
   *
   * Every box in this drawing is a device, so without it a reader who has picked one
   * has no gesture that returns the card beside it to the site as a whole. The plant
   * scene carried the same handler for the same reason before it was removed. Omitted
   * — the settings preview — the background is inert.
   */
  onClear,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
  selection?: SiteSceneSelection;
  alarms?: Partial<Record<SiteDeviceKey, Record<AlertSeverity, number>>>;
  onClear?: () => void;
}) => {
  /**
   * What a double-click on a device box does — see the note on the node element.
   *
   * A hook rather than a prop, and it does not cost this component its purity in the
   * sense that matters: `useNavigate` is the router's, not this site's, so the drawing
   * is still a pure function of `(summary, dutyId, role)` for everything it *draws*.
   * The settings page's preview passes no `selection`, and a box with nothing to select
   * gets nothing to open either.
   */
  const navigate = useNavigate();

  const sources = sourcesOf(summary, dutyId, role);
  const count = Math.max(1, sources.length);
  const feed = siteFeed(summary, dutyId, role);
  // Who is feeding and how much are two questions, answered separately — see
  // `siteLoadKw`. `null` here means nothing is feeding the load at all.
  const loadKw = siteLoadKw(summary, dutyId, role);

  // A device's box grows by the pill's band, and the pitch grows with it so the gap
  // between one node's captions and the next node's box is the one the design drew
  // either way. The bottom margin is unchanged — the captions are the same two lines,
  // and the pill is inside the box above them. Every conductor is derived from these,
  // so nothing else has to know. See `PILL_ROOM`.
  const pillRoom = alarms === undefined ? 0 : PILL_ROOM;
  const pitch = PITCH + pillRoom;
  /** How tall a box carrying a pill stands — what the canvas measures from. */
  const boxH = NODE_H + pillRoom;

  /**
   * The two ways out of a device box: double-click for its page, the pill for its
   * alarms. `undefined` for a node that is not a device, and for the whole drawing
   * when there is no selection to make — a preview must not navigate.
   */
  const opener = (device: SiteDeviceKey | undefined) => {
    if (device === undefined || selection === undefined) return undefined;
    const {page, params} = deviceRoutes(device);
    return () => void navigate({to: page, params, search: fromSite(summary.site.id)});
  };

  const alarmsLinkFor = (device: SiteDeviceKey | undefined) => {
    if (device === undefined) return undefined;
    const {alarms: to, params} = deviceRoutes(device);
    return {to, params, search: fromSite(summary.site.id)};
  };

  /** Where source `index`'s conductor leaves its box — see `ATTACH`. */
  const centreline = (index: number) => index * pitch + ATTACH;

  const height = (count - 1) * pitch + boxH + CAPTION;
  const anyLive = sources.some((source) => source.switchState.live);

  /**
   * The drawing's own centreline: the junction, the tap and the load box all sit on it.
   *
   * The **midpoint of the top and bottom sources**, which is the design's own
   * arrangement — a single-source site's load lines up with its source and a two-source
   * site's is symmetric between them. It is also the only answer to "centred between
   * the incomer and the sets" that stays true as sets are added.
   */
  const busY = (centreline(0) + centreline(count - 1)) / 2;

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
    .sort(
      (left, right) =>
        Number(left.source.switchState.live) - Number(right.source.switchState.live),
    );

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
  const scale = available === 0 ? 1 : Math.min(1, available / WIDTH);

  const gensetCount = summary.gensets.length;

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
      style={{maxWidth: WIDTH, height: height * scale}}
      // The canvas away from the boxes puts the selection down — see `onClear`. On the
      // wrapper rather than on a backdrop element so it covers the drawing's whole
      // footprint; a node stops the event, so a click only reaches here if it missed
      // every box.
      onClick={onClear}
    >
      {/* The canvas: always the measured 398px wide, and scaled as one piece. Every
          coordinate below is therefore the design's, at every viewport width — which
          is the whole point of scaling rather than reflowing. */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{width: WIDTH, height, transform: `scale(${scale})`}}
      >
        <svg
          width={WIDTH}
          height={height}
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="absolute inset-0 overflow-visible"
          // The picture, and the whole block's description with it. On the `<svg>`
          // rather than the wrapper so the node buttons stay in the accessibility
          // tree — see the file header.
          role="img"
          aria-label={`${summary.site.name} single-line diagram: ${
            hasMains(role) ? 'mains supply, ' : ''
          }${gensetCount} genset${gensetCount === 1 ? '' : 's'}, ${
            feed.source === 'GENSET'
              ? `${summary.gensets.find(({genset}) => genset.id === feed.gensetId)?.genset.tag} feeding the load`
              : feed.source === 'MAINS'
                ? 'on mains'
                : 'nothing feeding the load'
          }${loadKw === null ? '' : ` at ${amount(loadKw, 'kW')}`}`}
        >
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

                {/* Switch → the junction, as the design's elbow: out to `JUNCTION_X`,
                    then along it to the point every source meets at. Square the whole
                    way — see `JUNCTION_X` for why one meeting point and right angles
                    together leave no other shape.

                    An open switch's run is drawn dead all the way, because nothing past
                    a lifted blade is energised. */}
                <Conductor
                  points={[
                    [SWITCH_X + LOAD_TERMINAL, y],
                    [JUNCTION_X, y],
                    [JUNCTION_X, busY],
                  ]}
                  live={live}
                />
              </g>
            );
          })}

          {/* The junction → the load: the design's 67px tap, and the one conductor in
              the drawing that carries the site. Live if anything at all is feeding. */}
          <Conductor
            points={[
              [JUNCTION_X, busY],
              [LOAD_X, busY],
            ]}
            live={anyLive}
          />

          {/* The junction itself — one dot, where every source's run and the tap into
              the load all meet. Without it, conductors ending on one invisible point in
              open space read as lines that happen to cross. */}
          <circle
            cx={JUNCTION_X}
            cy={busY}
            r={3.5}
            className={cn('stroke-current', anyLive ? 'text-teal' : 'text-tertiary')}
            strokeWidth={1.5}
            fill={anyLive ? 'currentColor' : 'var(--canvas)'}
          />
        </svg>

        {sources.map((source, index) => {
          const device = deviceOfSource(source.key);
          const select = selectHandler(selection, device);

          return (
            <Node
              key={source.key}
              icon={source.icon}
              label={source.label}
              caption={source.caption}
              counts={device === undefined ? undefined : alarms?.[device]}
              alarmsLink={alarmsLinkFor(device)}
              onOpen={opener(device)}
              power={source.power}
              powered={source.switchState.live}
              live={source.switchState.live}
              x={0}
              y={index * pitch}
              onSelect={select}
              selected={device !== undefined && device === selection?.selected}
            />
          );
        })}

        <Node
          icon={FactoryIcon}
          label="LOAD"
          // The site's draw, stated where the power actually arrives. On a site with
          // nothing feeding it, this is not "0 kW" — that would read as a load that
          // has gone away, when in fact it is a load nobody is currently serving.
          caption="Site draw"
          power={loadKw === null ? 'not served' : amount(loadKw, 'kW')}
          powered={anyLive}
          x={LOAD_X}
          y={busY - ATTACH}
        />
      </div>
    </div>
  );
};
