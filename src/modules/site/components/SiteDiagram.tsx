import {BoomBoxIcon, FactoryIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {RunState} from '@/modules/genset/types/genset.type';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {isolatorStateOf, mainsContactorStateOf} from '../types/site.type';
import type {MainsSupply, SitePowerRole, SwitchState} from '../types/site.type';
import {siteFeed} from '../data/sites';
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
 * ## Why the geometry is fixed
 *
 * Same reason as `PowerFlowDiagram`: the conductors have to *land* on the boxes.
 * A flex or grid arrangement that reflows leaves a wire ending in mid-air at some
 * viewport width, and a diagram with a conductor pointing at nothing is worse than
 * one that needs a scrollbar. So the block is a fixed pixel canvas and the card
 * centres it.
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
 * ## The mains
 *
 * A `STANDBY` site draws a **mains source above its gensets**, on its own contactor,
 * onto the same bus. The frame has no such node — it draws only gensets, which
 * quietly makes every site look like it has nothing else feeding it — and a page
 * about *backup* power that never shows what is being backed up is missing its
 * subject.
 *
 * It costs no new geometry, and that is the argument for putting it in this column
 * rather than opposite the gensets: a transfer switch **is** a changeover between
 * two sources onto one bus, so the mains is a source row like any other and every
 * measurement above applies to it unchanged. A `PRIME` site has no incomer and draws
 * exactly what it drew before this existed.
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
  className?: string;
}) => (
  <div className="absolute" style={{left: x, top: y, width: NODE_W}}>
    <div
      className={cn(
        'relative flex h-[74px] w-[88px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-element pt-2.5 pb-2',
        live === true ? 'border-teal/40' : 'border-default',
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
  </div>
);

/**
 * What a set is putting into the bus, written under its node.
 *
 * Only a connected, turning set gets a figure. The rest get a word, because the
 * alternative — `0 kW` — is a *measurement*, and claiming to have measured zero at
 * a machine that is faulted or unreachable is a stronger statement than the page is
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
  if (carrying && mains.drawKw !== null) return amount(mains.drawKw, 'kW');
  return mains.live ? 'off-load' : 'failed';
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
 * Every source feeding this site's bus, top to bottom.
 *
 * Mains first, and not arbitrarily: at a standby site it is the *normal* supply and
 * the gensets are what sit under it waiting. Reading the column downwards then
 * follows the order the site actually uses its sources in.
 */
const sourcesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): Array<DiagramSource> => {
  const gensetCarrying = siteFeed(summary, dutyId, role).source === 'GENSET';

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

  if (role === 'PRIME') return gensets;

  return [
    {
      key: 'mains',
      icon: UtilityPoleIcon,
      label: 'MAINS',
      caption: 'Grid supply',
      power: mainsPowerLabel(summary.mains, mainsContactorStateOf(summary.mains, gensetCarrying).live),
      switchState: mainsContactorStateOf(summary.mains, gensetCarrying),
    },
    ...gensets,
  ];
};

// ─── The diagram ─────────────────────────────────────────────────────────────

export const SiteDiagram = ({
  summary,
  /** The set the changeover has on the bus. Drives every isolator in the drawing. */
  dutyId,
  /**
   * `STANDBY` draws the mains above the gensets; `PRIME` draws gensets alone.
   *
   * Passed in rather than read from the config store here, so this stays a pure
   * function of its inputs — which is what lets the settings page render it twice,
   * once per role, as a live preview of a choice not yet made.
   */
  role,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
}) => {
  const sources = sourcesOf(summary, dutyId, role);
  const count = Math.max(1, sources.length);
  const feed = siteFeed(summary, dutyId, role);

  /** Centreline of source `index` — where its conductor leaves the box. */
  const centreline = (index: number) => index * PITCH + NODE_H / 2;
  // The load taps the bus at the midpoint of the sources feeding it, which is what
  // puts a single-source site's load on the same line as its source and keeps a
  // two-source site's symmetric — the design's arrangement in both cases.
  const busY = (centreline(0) + centreline(count - 1)) / 2;

  const height = (count - 1) * PITCH + NODE_H + CAPTION;
  const anyLive = sources.some((source) => source.switchState.live);

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

  return (
    <div
      className="relative shrink-0"
      style={{width: WIDTH, height}}
      role="img"
      aria-label={`${summary.site.name} single-line diagram: ${
        role === 'STANDBY' ? 'mains supply and ' : ''
      }${summary.gensets.length} genset${summary.gensets.length === 1 ? '' : 's'}, ${
        feed.source === 'GENSET'
          ? `${summary.gensets.find(({genset}) => genset.id === feed.gensetId)?.genset.tag} feeding the load at ${amount(feed.drawKw, 'kW')}`
          : feed.source === 'MAINS'
            ? `on mains at ${amount(feed.drawKw, 'kW')}`
            : 'nothing feeding the load'
      }`}
    >
      <svg
        width={WIDTH}
        height={height}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="absolute inset-0 overflow-visible"
        aria-hidden="true"
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
      </svg>

      {sources.map((source, index) => (
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
        />
      ))}

      <Node
        icon={FactoryIcon}
        label="LOAD"
        // The site's draw, stated where the power actually arrives. On a site with
        // nothing feeding it, this is not "0 kW" — that would read as a load that
        // has gone away, when in fact it is a load nobody is currently serving.
        caption="Site draw"
        power={feed.source === 'NONE' ? 'not served' : amount(feed.drawKw, 'kW')}
        powered={anyLive}
        x={LOAD_X}
        y={busY - NODE_H / 2}
      />
    </div>
  );
};
