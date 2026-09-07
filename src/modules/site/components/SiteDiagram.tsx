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
 * The two hybrid configurations add a **bank** the same way, and that is the
 * argument for putting all of them in this column rather than inventing a second
 * one: a bus is a bus, so every source is a row, and every measurement above
 * applies to each of them unchanged. Three sources at a solar hybrid with two sets
 * is the same drawing as one source at a diesel-prime site with one — taller, and
 * not otherwise different.
 *
 * The **array** is the one thing that is not a row, because it is not on the bus.
 * It is DC-coupled: it charges the bank and reaches the load through the same
 * converter the bank does, so it is drawn where it actually sits — in its own
 * column to the left, on one conductor into the battery. Giving it an isolator of
 * its own said something false, that the array could carry the tower with the bank
 * disconnected.
 *
 * The order down the column is the order the site uses its sources in: grid, bank,
 * then gensets. Reading it downwards is reading the control strategy, which is why
 * the bank sits above the machine that charges it.
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
 * The array's own column, to the left of the bank it charges.
 *
 * Reusing `LEAD` rather than measuring a new gap: the array's run into the battery
 * is the same length as every genset's run into its isolator, so the drawing keeps
 * one horizontal rhythm whatever the site is made of. Sites without an array pay
 * nothing for this — the gutter is zero and the canvas is the design's 398px.
 */
const SOLAR_GUTTER = NODE_W + LEAD;

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
 * `closed` and `live` are separate inputs because they are separate facts: a
 * standby set sits closed onto a dead bus waiting for a mains failure, so a
 * closed-and-dead switch is the most common state at a healthy site, not an
 * inconsistency. Only `open` + `live` is impossible, and `switchStateOf` is what
 * guarantees it never reaches here.
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
  key === 'mains' ? undefined : key === 'battery' ? 'battery' : gensetDeviceKey(key);

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
 * The array beside the bank, on the two lines a node carries.
 *
 * Not a `DiagramSource`, and the difference is the whole point: a source has a
 * switch and a place on the bus, and the array has neither. It has a state — making
 * something, or not — and that state drives one conductor into the battery.
 */
type DiagramSolar = {
  caption: string;
  power: string;
  /** Is it making anything. Its node's dot and its conductor both read this. */
  generating: boolean;
};

/**
 * Every source feeding this site's bus, top to bottom, and the array beside the bank.
 *
 * Mains first, and not arbitrarily: at a standby site it is the *normal* supply and
 * the gensets are what sit under it waiting. Reading the column downwards then
 * follows the order the site actually uses its sources in.
 */
const sourcesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): {sources: Array<DiagramSource>; solar: DiagramSolar | undefined} => {
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
  let solar: DiagramSolar | undefined;

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

    if (hasSolar(role)) {
      // An array is connected whenever it is making anything, and disconnected at
      // night. There is no third state: a PV converter that is exporting nothing is
      // off, not idling, so `night` is the word rather than `0 kW`. The same rule
      // the genset captions follow — a measurement of zero and an absence of one
      // are different claims.
      const generating = state.solarKw > 0;
      solar = {
        caption: 'PV array',
        power: generating ? amount(state.solarKw, 'kW', 1) : 'night',
        generating,
      };
    }

    // Charging and discharging are one node and two directions, which is why the
    // caption carries the state of charge and the power line carries the sign. A
    // bank drawn as two nodes would suggest the site has two of them.
    const discharging = state.batteryKw > 0 && !gensetCarrying;
    // This one run is the **whole plant's** tie to the bus, not the bank's alone —
    // the array reaches the load through the same converter — so it is live whenever
    // either of them is delivering. Reading it off the bank by itself would draw the
    // tower unserved at two in the afternoon, with an array beside it making more
    // than the tower draws. That surplus is exactly the case where the bank is
    // charging and the load is nonetheless being carried.
    const delivering = !gensetCarrying && (discharging || state.solarKw > 0);
    sources.push({
      key: 'battery',
      icon: BatteryChargingIcon,
      label: 'BATTERY',
      caption: `${Math.round(state.soc * 100)}% charged`,
      power: gensetCarrying
        ? 'charging'
        : discharging
          ? amount(state.batteryKw, 'kW', 1)
          : 'charging',
      switchState: {closed: true, live: delivering},
    });
  }

  return {sources: [...sources, ...gensets], solar};
};

/**
 * How wide this site's canvas is, in the design's own pixels.
 *
 * Exported because the site page sizes the column it hands the drawing, and that
 * width is not a constant: an array adds its own column to the left of the bank.
 * Asked here rather than recomputed there so the drawing stays the only thing that
 * decides how wide it is — a caller that guessed 398 would clip every solar hybrid.
 *
 * Reads the role rather than running `sourcesOf`, and the two agree by
 * construction: `solar` is set exactly when `hasSolar(role)` holds, since that
 * implies `hasBattery` and the array is built inside that branch.
 */
export const siteDiagramWidth = (role: SitePowerRole): number =>
  (hasSolar(role) ? SOLAR_GUTTER : 0) + WIDTH;

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
  const {sources, solar} = sourcesOf(summary, dutyId, role);
  const count = Math.max(1, sources.length);
  const feed = siteFeed(summary, dutyId, role);
  // Who is feeding and how much are two questions, answered separately — see
  // `siteLoadKw`. `null` here means nothing is feeding the load at all.
  const loadKw = siteLoadKw(summary, dutyId, role);

  /** Centreline of source `index` — where its conductor leaves the box. */
  const centreline = (index: number) => index * PITCH + NODE_H / 2;
  // The load taps the bus at the midpoint of the sources feeding it, which is what
  // puts a single-source site's load on the same line as its source and keeps a
  // two-source site's symmetric — the design's arrangement in both cases.
  const busY = (centreline(0) + centreline(count - 1)) / 2;

  const height = (count - 1) * PITCH + NODE_H + CAPTION;
  const anyLive = sources.some((source) => source.switchState.live);

  /**
   * The array's column, and the row it sits on.
   *
   * Everything else in the drawing shifts right by the gutter, which is why it is a
   * translate on one group rather than a term in each coordinate: the design's
   * measurements stay literal, and a site with no array pays nothing — the gutter is
   * zero and the canvas is the 398px it always was.
   *
   * The array is drawn on the **battery's own row**, so the run between them is a
   * straight horizontal line rather than a dogleg. `hasSolar` implies `hasBattery`,
   * so the row is always there to find; the fallback is for a caller that ever
   * breaks that, and puts the array on the top row rather than off the canvas.
   */
  const gutter = solar === undefined ? 0 : SOLAR_GUTTER;
  const width = gutter + WIDTH;
  const batteryIndex = sources.findIndex((source) => source.key === 'battery');
  const solarY = centreline(Math.max(0, batteryIndex));

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
        }${hasBattery(role) ? (hasSolar(role) ? 'PV array into the battery, ' : 'battery, ') : ''}${
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
        {/* The array's run into the battery: one conductor, no switch, drawn in the
            gutter's own coordinates before everything else is shifted out of it. */}
        {solar !== undefined && (
          <Conductor
            points={[
              [NODE_W, solarY],
              [gutter, solarY],
            ]}
            live={solar.generating}
          />
        )}

        <g transform={`translate(${gutter},0)`}>
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

              {/* Switch → bus, as the design's elbow: out, then along the
                  riser to the tap. An open switch's run is drawn dead all the
                  way, because nothing past a lifted blade is energised. */}
              <Conductor
                points={[
                  [SWITCH_X + LOAD_TERMINAL, y],
                  [BUS_X, y],
                  [BUS_X, busY],
                ]}
                live={live}
              />
            </g>
          );
        })}

        {/* Bus → load. Live if anything at all is feeding the bus. */}
        <Conductor
          points={[
            [BUS_X, busY],
            [LOAD_X, busY],
          ]}
          live={anyLive}
        />

        <circle
          cx={BUS_X}
          cy={busY}
          r={3.5}
          className={cn('stroke-current', anyLive ? 'text-teal' : 'text-tertiary')}
          strokeWidth={1.5}
          fill={anyLive ? 'currentColor' : 'var(--canvas)'}
        />
        </g>
      </svg>

      {solar !== undefined && (
        <Node
          icon={SunMediumIcon}
          label="SOLAR"
          caption={solar.caption}
          power={solar.power}
          powered={solar.generating}
          live={solar.generating}
          x={0}
          y={solarY - NODE_H / 2}
          onSelect={selectHandler(selection, 'solar')}
          selected={selection?.selected === 'solar'}
        />
      )}

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
            x={gutter}
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
        x={gutter + LOAD_X}
        y={busY - NODE_H / 2}
      />
      </div>
    </div>
  );
};
