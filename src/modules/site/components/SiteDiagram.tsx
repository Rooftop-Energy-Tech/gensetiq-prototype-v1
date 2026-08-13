import {BoomBoxIcon, FactoryIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {RunState} from '@/modules/genset/types/genset.type';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {isolatorStateOf} from '../types/site.type';
import {siteDrawKw} from '../data/sites';
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
 * 88 × 74 nodes, a 54px lead to a 64 × 40 isolator, a 56px elbow onto the bus,
 * and a 73px tap from the bus to the load. The switch's internals follow the
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
 * *which* set is open. Each node is therefore captioned with its asset tag, and
 * the load with the site's draw. Both are additive: the boxes keep their designed
 * 88 × 74 and the captions sit in the gap beneath them.
 */

// ─── The design's measurements ───────────────────────────────────────────────

const NODE_W = 88;
const NODE_H = 74;
/** Node top to node top, vertically. */
const PITCH = 106;
/** Genset edge to isolator edge. */
const LEAD = 54;
const SWITCH_W = 64;
/** Isolator edge to the bus riser. */
const ELBOW = 56;
/** Bus to load edge. */
const TAP = 73;
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

// ─── The diagram ─────────────────────────────────────────────────────────────

export const SiteDiagram = ({
  summary,
  /** The set the changeover has on the bus. Drives every isolator in the drawing. */
  dutyId,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
}) => {
  const {gensets} = summary;
  const count = Math.max(1, gensets.length);
  const drawKw = siteDrawKw(summary, dutyId);

  /** Centreline of genset `index` — where its conductor leaves the box. */
  const centreline = (index: number) => index * PITCH + NODE_H / 2;
  // The load taps the bus at the midpoint of the sets feeding it, which is what
  // puts a single-genset site's load on the same line as its genset and keeps a
  // two-set site's symmetric — the design's arrangement in both cases.
  const busY = (centreline(0) + centreline(count - 1)) / 2;

  const height = (count - 1) * PITCH + NODE_H + CAPTION;
  const anyLive = gensets.some(
    ({genset}) => isolatorStateOf(genset.runState, genset.id === dutyId).live,
  );

  return (
    <div
      className="relative shrink-0"
      style={{width: WIDTH, height}}
      role="img"
      aria-label={`${summary.site.name} single-line diagram: ${gensets.length} genset${
        gensets.length === 1 ? '' : 's'
      }, ${summary.runningCount} feeding the load`}
    >
      <svg
        width={WIDTH}
        height={height}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="absolute inset-0 overflow-visible"
        aria-hidden="true"
      >
        {gensets.map(({genset}, index) => {
          const y = centreline(index);
          const {closed, live} = isolatorStateOf(genset.runState, genset.id === dutyId);

          return (
            <g key={genset.id}>
              {/* Genset → isolator. */}
              <Conductor
                points={[
                  [NODE_W, y],
                  [SWITCH_X + SOURCE_TERMINAL, y],
                ]}
                live={live}
              />

              <Isolator y={y} closed={closed} live={live} />

              {/* Isolator → bus, as the design's elbow: out, then along the
                  riser to the tap. An open isolator's run is drawn dead all the
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

      {gensets.map(({genset, detail}, index) => {
        const {live} = isolatorStateOf(genset.runState, genset.id === dutyId);

        return (
          <Node
            key={genset.id}
            icon={BoomBoxIcon}
            label="GENSET"
            caption={genset.tag}
            power={powerLabel(genset.runState, live, detail.loadKw)}
            powered={live}
            live={live}
            x={0}
            y={index * PITCH}
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
        power={drawKw === null ? 'not served' : amount(drawKw, 'kW')}
        powered={anyLive}
        x={LOAD_X}
        y={busY - NODE_H / 2}
      />
    </div>
  );
};
