import {useRef} from 'react';
import {
  BatteryChargingIcon,
  BoomBoxIcon,
  FactoryIcon,
  SunMediumIcon,
  UtilityPoleIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {RunState} from '@/modules/genset/types/genset.type';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import {gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasBattery, hasMains, hasSolar, isolatorStateOf, mainsContactorStateOf} from '../types/site.type';
import type {MainsSupply, SitePowerRole, SwitchState} from '../types/site.type';
import {hybridState} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';

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

const SWITCH_X = NODE_W + LEAD;
const BUS_X = SWITCH_X + SWITCH_W + ELBOW;
const LOAD_X = BUS_X + TAP;
const WIDTH = LOAD_X + NODE_W;

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
 *    `JUNCTION_X` — with right angles and a single meeting point there is no other
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
const JUNCTION_X = BUS_X;

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
          'relative flex h-[74px] w-[88px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-element pt-2.5 pb-2',
          // The border says whether the thing is *live*, so selection cannot use it
          // — a picked dead genset and a live one have to stay tellable apart. A ring
          // sits outside the border and is the one affordance orthogonal to it.
          live === true ? 'border-teal/40' : 'border-default',
          onSelect !== undefined && 'transition-colors group-hover:bg-highlight',
          selected && 'bg-highlight ring-2 ring-strong',
          className,
        )}
      >
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-md',
            live === true ? 'bg-teal/16' : 'bg-highlight',
          )}
        >
          <Icon
            className={cn('size-[18px]', live === true ? 'text-teal' : 'text-primary')}
            aria-hidden="true"
          />
        </span>
        <p className="text-xs font-semibold whitespace-nowrap text-primary">{label}</p>
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
type DiagramSource = {
  key: string;
  icon: LucideIcon;
  /** The word inside the box — `MAINS` or `GENSET`, as the design writes them. */
  label: string;
  /** First caption line: which supply or which asset this is. */
  caption: string;
  /** Second caption line: what it is putting into the bus. */
  power: string;
  switchState: SwitchState;
};

/**
 * The device a source node stands for, or `undefined` if it is not a device.
 *
 * The mains is the `undefined` case and the only one: an incomer is a supply the
 * site is connected to, not a machine on this estate's books, so there is no device
 * card behind it and its node must not offer a click. Every other source key is
 * either the bank or a genset's own id.
 */
const deviceOfSource = (key: string): SiteDeviceKey | undefined =>
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
const sourcesOf = (
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
    const discharging = state.batteryKw > 0 && !gensetCarrying;

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
      power: discharging ? amount(state.batteryKw, 'kW', 1) : 'charging',
      // Open while charging. A bank taking charge is a load on the plant rather than a
      // source on it, and drawing its tie closed put a shut switch on the one run in
      // the drawing that was carrying nothing towards the tower.
      switchState: {closed: discharging, live: discharging},
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
export const siteDiagramWidth = (_role: SitePowerRole): number => WIDTH;

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
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
  selection?: SiteDiagramSelection;
}) => {
  const sources = sourcesOf(summary, dutyId, role);
  const count = Math.max(1, sources.length);
  const feed = siteFeed(summary, dutyId, role);
  // Who is feeding and how much are two questions, answered separately — see
  // `siteLoadKw`. `null` here means nothing is feeding the load at all.
  const loadKw = siteLoadKw(summary, dutyId, role);

  /** Centreline of source `index` — where its conductor leaves the box. */
  const centreline = (index: number) => index * PITCH + NODE_H / 2;

  const height = (count - 1) * PITCH + NODE_H + CAPTION;
  const width = WIDTH;
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
   * Live is read off the row **further from the bank**, which is the one thing this
   * conductor is actually about: the array's tie carries when the array is making
   * something, and a set's tie carries when that set is running onto the plant.
   * Reading it off either row would light the array's tie at midnight, the moment the
   * bank started discharging — a line drawn as though power were flowing up to a dark
   * roof.
   */
  const tieLive = (index: number): boolean => {
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
                [TIE_X, index * PITCH + NODE_H],
                [TIE_X, (index + 1) * PITCH],
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
            the drawing that carries the tower. Live if anything at all is feeding. */}
        <Conductor
          points={[
            [JUNCTION_X, busY],
            [LOAD_X, busY],
          ]}
          live={anyLive}
        />

        {/* The junction itself — one dot, where every source's run and the tap into
            the load all meet. */}
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

        return (
          <Node
            key={source.key}
            icon={source.icon}
            label={source.label}
            caption={source.caption}
            power={source.power}
            powered={source.switchState.live}
            live={source.switchState.live}
            x={0}
            y={index * PITCH}
            onSelect={selectHandler(selection, device)}
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
        y={busY - NODE_H / 2}
      />
      </div>
    </div>
  );
};
