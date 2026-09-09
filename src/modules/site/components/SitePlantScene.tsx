import {useRef, useState} from 'react';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import {siteHasCabinet} from '@/modules/cabinet/data/shelf';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {EQUIPMENT, byDepth, isoX, isoY, placementBox, plantScene} from '../data/plantScene';
import type {Ground, ScenePlacement} from '../data/plantScene';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {
  cabinetPowerLabel,
  deviceOfSource,
  sourcesOf,
  type SiteDiagramSelection,
} from './SiteDiagram';

/**
 * The site's plant, drawn as the compound rather than as a circuit.
 *
 * ## What this is, next to `SiteDiagram`
 *
 * The same nodes, the same captions, the same click. The single-line diagram answers
 * *what is connected to what*; this answers *what is standing there*. A reader deciding
 * whether to send somebody out wants the second one, and a reader working out why the
 * bank is not charging wants the first, so the page carries both and neither is a
 * decoration of the other.
 *
 * Everything a node says here - its word, its caption, its reading, whether it is
 * carrying - comes from `sourcesOf`, which is the diagram's own source list. That is the
 * whole reason this is a second **view** and not a second model: the two drawings cannot
 * disagree about the site, because there is one answer and both read it.
 *
 * ## The geometry is `plantScene.ts`'s
 *
 * Objects, millimetre boxes, the projection and the layout all live in the data module,
 * with the argument for each. This file scales that scene into the space it is given,
 * draws the ground under it, and puts the words beside it.
 *
 * ## The labels live in the margins, on leaders
 *
 * They used to hang at each object's feet, and on a compound this tight they covered the
 * plant they were naming - which is the one thing a label must not do.
 *
 * So the labels are in **two gutters, one either side of the compound**, each joined to
 * its object by a thin leader line, which is how a technical illustration has always
 * solved this. Three things fall out of it and all three are improvements: a label can
 * never cover a drawing, because it is not over the drawing; labels cannot cover each
 * other, because within a gutter they are stacked and pushed apart to a minimum spacing;
 * and the plant gets the whole middle of the frame, so it is drawn bigger than it was when
 * the labels were competing with it for the same pixels.
 *
 * ## One node, several drawings
 *
 * The bank is three cabinets. So a node is not one image here: hovering or selecting
 * `battery` lifts every cabinet carrying that node, and the leader points at the one the
 * label is anchored to. That is what `node` and `chip` are for on a placement, and it is
 * why the highlight is keyed on the node rather than on the image.
 *
 * ## Why the label is the control, and not the drawing
 *
 * In an isometric scene the drawings' bounding boxes overlap heavily - the array's box
 * covers most of the yard, and a transparent hit area over it would swallow clicks meant
 * for the cabinets in front. Sorting the buttons by depth fixes the top-most case and
 * still leaves the array eating every click aimed between the frame's legs.
 *
 * So the **label is the button**: unambiguous at every depth, reachable by keyboard in a
 * sensible order, and already the thing carrying the reading a person is looking at.
 * Hovering or selecting it lifts the objects it names, so the drawing still answers the
 * pointer without having to be the target.
 *
 * ## Fixed canvas, uniform scale
 *
 * Same argument the diagram makes, for a stronger reason: these objects sit on one ground
 * plane at true relative size, and reflowing them would put a cabinet through the fence.
 * So the scene is measured in millimetres, then scaled uniformly to whatever width the
 * band gives it. Nothing moves relative to anything else; the whole compound just gets
 * smaller.
 */

/** The readable floor for the whole block, gutters included. */
const MIN_WIDTH = 460;

/** A label column either side of the compound, in pixels. */
const GUTTER = 128;

/**
 * Vertical room a stacked label needs before the next one starts.
 *
 * It has to clear the **box**, not the text: three lines at 11px and 13px, plus 12px of
 * padding, 4px of internal gaps and the border, come to about 56px. At 52 the stacker was
 * pitching them tighter than they are tall, so a run of labels in one gutter arrived as a
 * single block with hairlines through it. 66 leaves a clear gap between every pair.
 */
const LABEL_PITCH = 66;

/** Breathing room above and below the plant. */
const PAD_Y = 20;

type SceneNode = {
  /** The diagram's key for this node - what a placement's `node` matches. */
  key: string;
  /** The placement the leader points at. */
  chip: ScenePlacement;
  /** The word in the label - `SOLAR`, `CABINET`, as the diagram writes them. */
  label: string;
  /** What this is: `PV array`, `DC plant`, a genset's tag. */
  caption: string;
  /** What it is doing, in the same words the diagram's second caption line uses. */
  power: string;
  /** Carrying, in the diagram's sense - drives the teal. */
  live: boolean;
  /** The device behind it, or `undefined` where the node is not one. */
  device: SiteDeviceKey | undefined;
};

const nodesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
  placements: ReadonlyArray<ScenePlacement>,
): Array<SceneNode> => {
  const sources = sourcesOf(summary, dutyId, role);
  const feed = siteFeed(summary, dutyId, role);
  const loadKw = siteLoadKw(summary, dutyId, role);
  const anyLive = sources.some((source) => source.switchState.live);

  return placements.flatMap((placement): Array<SceneNode> => {
    if (placement.chip !== true || placement.node === undefined) return [];
    const key = placement.node;

    if (key === 'load') {
      return [
        {
          key,
          chip: placement,
          label: 'LOAD',
          caption: 'Site draw',
          // `not served` rather than `0 kW`, for the reason the diagram's load node
          // gives: a site nobody is feeding is not a site whose load has gone away.
          power: loadKw === null ? 'not served' : amount(loadKw, 'kW'),
          live: anyLive,
          device: undefined,
        },
      ];
    }

    if (key === 'cabinet') {
      return [
        {
          key,
          chip: placement,
          label: 'CABINET',
          caption: 'DC plant',
          power: cabinetPowerLabel(feed.source),
          live: anyLive,
          device: 'cabinet',
        },
      ];
    }

    const source = sources.find((candidate) => candidate.key === key);
    // A placement with no source behind it is a site whose configuration changed under
    // the layout - an array on a site that is no longer a solar hybrid. Dropped rather
    // than drawn empty, which is the same call `SiteCircuit` makes about a stale selection.
    if (source === undefined) return [];

    return [
      {
        key,
        chip: placement,
        label: source.label,
        caption: source.caption,
        power: source.power,
        live: source.switchState.live,
        device: deviceOfSource(source.key),
      },
    ];
  });
};

/**
 * Stack a gutter's labels so none of them overlaps the next.
 *
 * Each label wants to sit level with the object it names. Where two objects are within a
 * label's height of each other - the cabinet line-up and the set beside it - the second
 * is pushed down to the minimum pitch. Sorted first, so pushing only ever moves a label
 * away from its neighbour and never past it.
 */
const stack = (wanted: Array<{key: string; y: number}>): Map<string, number> => {
  const placed = new Map<string, number>();
  let lowest = -Infinity;

  for (const {key, y} of [...wanted].sort((a, b) => a.y - b.y)) {
    const at = Math.max(y, lowest + LABEL_PITCH);
    placed.set(key, at);
    lowest = at;
  }

  return placed;
};

/**
 * The concrete pad, as a flat quad on the ground plane with a slab edge under it.
 *
 * Drawn rather than placed - see `Ground` in the data module. The top face is the pad
 * itself; the two visible edges are the slab's thickness, in the darker of the two tones,
 * so the pad reads as standing a little proud of the earth rather than painted on it.
 */
const Pad = ({
  ground,
  project,
  thickness,
}: {
  ground: Ground;
  project: (x: number, y: number) => {left: number; top: number};
  /** Slab depth, already in pixels. */
  thickness: number;
}) => {
  const corner = (x: number, y: number) => {
    const {left, top} = project(x, y);
    return `${left},${top}`;
  };

  const top = [
    corner(ground.x0, ground.y0),
    corner(ground.x1, ground.y0),
    corner(ground.x1, ground.y1),
    corner(ground.x0, ground.y1),
  ].join(' ');

  const near = project(ground.x1, ground.y1);
  const right = project(ground.x1, ground.y0);
  const left = project(ground.x0, ground.y1);
  const edge = (from: {left: number; top: number}) =>
    `${from.left},${from.top} ${near.left},${near.top} ${near.left},${near.top + thickness} ${
      from.left
    },${from.top + thickness}`;

  return (
    <g>
      <polygon points={top} className="fill-highlight" />
      <polygon points={edge(right)} className="fill-tertiary/25" />
      <polygon points={edge(left)} className="fill-tertiary/40" />
    </g>
  );
};

/** One placed drawing. */
const SceneObject = ({
  placement,
  left,
  top,
  width,
  height,
  active,
  dimmed,
}: {
  placement: ScenePlacement;
  left: number;
  top: number;
  width: number;
  height: number;
  active: boolean;
  dimmed: boolean;
}) => {
  const {url, alt} = EQUIPMENT[placement.equipment];

  return (
    <img
      src={url}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
      className={cn(
        'pointer-events-none absolute transition-[filter,opacity] duration-150',
        // Everything is drawn at full strength until something is picked out, and then it
        // is the *others* that recede. Dimming is the only way to single an object out in
        // a scene this dense that does not mean redrawing it: a ring around an isometric
        // object is a rectangle around a diamond, and a tint changes what the drawing is
        // saying, since colour in these assets is material rather than state.
        dimmed && 'opacity-40',
        active && 'drop-shadow-[0_0_10px_var(--color-teal)]',
      )}
      style={{
        left,
        top,
        width,
        height,
        transform: placement.flipX === true ? 'scaleX(-1)' : undefined,
      }}
    />
  );
};

const Label = ({
  node,
  side,
  selected,
  onSelect,
  onHover,
}: {
  node: SceneNode;
  side: 'left' | 'right';
  selected: boolean;
  onSelect: (() => void) | undefined;
  onHover: (key: string | undefined) => void;
}) => {
  const body = (
    <>
      <span className={cn('flex items-center gap-1.5', side === 'left' && 'flex-row-reverse')}>
        <span
          className={cn('size-1.5 shrink-0 rounded-full', node.live ? 'bg-teal' : 'bg-tertiary')}
        />
        <span className="text-[11px] leading-none font-semibold text-primary">{node.label}</span>
      </span>
      <span className="text-[10px] leading-[13px] whitespace-nowrap text-secondary">
        {node.caption}
      </span>
      <span
        className={cn(
          'text-[10px] leading-[13px] font-medium whitespace-nowrap',
          node.live ? 'text-primary' : 'text-tertiary',
        )}
      >
        {node.power}
      </span>
    </>
  );

  const shell = cn(
    'flex w-full flex-col gap-0.5 rounded-md border bg-element px-2 py-1.5',
    side === 'left' ? 'items-end text-right' : 'items-start text-left',
    node.live ? 'border-teal/40' : 'border-default',
    selected && 'ring-2 ring-teal ring-offset-1 ring-offset-canvas',
  );

  if (onSelect === undefined) {
    return <span className={shell}>{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        // The block behind this clears the selection; a click on a label is a selection.
        event.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => onHover(node.key)}
      onMouseLeave={() => onHover(undefined)}
      onFocus={() => onHover(node.key)}
      onBlur={() => onHover(undefined)}
      className={cn(shell, 'cursor-pointer transition-colors hover:bg-highlight')}
    >
      {body}
    </button>
  );
};

export const SitePlantScene = ({
  summary,
  dutyId,
  role,
  selection,
  onClear,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
  selection?: SiteDiagramSelection;
  /**
   * Clicking the yard rather than a thing standing in it.
   *
   * The page's answer to that is the site's own overview, so the scene has to be able to
   * say "nothing" as well as which object - a drawing that can only ever select is a
   * drawing a reader cannot back out of.
   */
  onClear?: () => void;
}) => {
  const track = useRef<HTMLDivElement>(null);
  const {width} = useElementSize(track);
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  const {placements, platform} = plantScene(
    summary.site.id,
    role,
    summary.gensets.map(({genset}) => genset.id),
    siteHasCabinet(summary.site.id, role),
  );
  const nodes = nodesOf(summary, dutyId, role, placements);

  // What the view is fitted to: the **plant**, in millimetres. Derived rather than
  // declared, so adding an object to the layout cannot leave it clipped.
  //
  // Scenery is left out on purpose. The fence run is 18 m and the treeline sits outside
  // it, so fitting those in would shrink the equipment to a fraction of the frame to get a
  // boundary into the same box. Framed on the plant instead, the fence and the trees run
  // off the edges the way they do in a site photograph, and the block crops them.
  const plant = placements.filter((placement) => placement.scenery !== true).map(placementBox);
  const xs = plant.flatMap((box) => [box.minX, box.minX + box.w]);
  const ys = plant.flatMap((box) => [box.minY, box.minY + box.h]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const plantMm = {w: Math.max(...xs) - minX, h: Math.max(...ys) - minY};

  // The gutters take their width off the top, so the plant is fitted to what is left.
  // `useElementSize` reports 0 until the ref attaches, one layout effect away, which the
  // floor covers along with a genuinely narrow column.
  const frame = Math.max(MIN_WIDTH, width);
  const s = (frame - GUTTER * 2) / plantMm.w;
  const height = plantMm.h * s + PAD_Y * 2;

  /** A projected millimetre point, in the block's own pixels. */
  const at = (mmX: number, mmY: number) => ({
    left: GUTTER + (mmX - minX) * s,
    top: PAD_Y + (mmY - minY) * s,
  });

  /** A ground position, straight to pixels - the pad's corners come this way. */
  const ground = (x: number, y: number) => at(isoX(x, y), isoY(x, y));

  /** The device a node key names, in the selection's own vocabulary. */
  const deviceOf = (key: string): SiteDeviceKey | undefined =>
    key === 'cabinet' ? 'cabinet' : key === 'load' || key === 'mains' ? undefined : deviceOfSource(key);

  const selectHandler = (key: string): (() => void) | undefined => {
    const device = deviceOf(key);
    if (selection === undefined || device === undefined || !selection.devices.includes(device)) {
      return undefined;
    }
    return () => selection.onSelect(device);
  };

  const activeNode = (key: string | undefined): boolean => {
    if (key === undefined) return false;
    if (hovered === key) return true;

    // The selection is in **device** keys and a placement carries a **source** key, and
    // for gensets those differ - `genset:JHB5503` against `JHB5503`. So the comparison
    // goes through `deviceOf`, the same translation the diagram's own nodes make, rather
    // than comparing two vocabularies directly and quietly never matching a set.
    const device = deviceOf(key);
    return device !== undefined && device === selection?.selected;
  };

  // Which gutter each label goes in, and what its leader points at. The anchor is a point
  // on the object itself rather than its feet, so a leader arriving from the side lands on
  // the thing and not on the ground in front of it.
  const anchored = nodes.map((node) => {
    const box = placementBox(node.chip);
    const point = at(box.minX + box.w / 2, box.minY + box.h * 0.62);
    const middle = GUTTER + (plantMm.w * s) / 2;

    return {node, point, side: point.left < middle ? ('left' as const) : ('right' as const)};
  });

  const stacked = {
    left: stack(
      anchored.filter((entry) => entry.side === 'left').map(({node, point}) => ({
        key: node.key,
        y: point.top,
      })),
    ),
    right: stack(
      anchored.filter((entry) => entry.side === 'right').map(({node, point}) => ({
        key: node.key,
        y: point.top,
      })),
    ),
  };

  // A stacked label can be pushed below the plant's own bottom edge, so the block grows to
  // whichever is taller. Measured rather than guessed, so a site with four sets does not
  // clip its last label.
  const lowestLabel = Math.max(
    0,
    ...[...stacked.left.values(), ...stacked.right.values()].map((y) => y + LABEL_PITCH),
  );

  return (
    <div ref={track} className="w-full">
      {/* Clicking the yard clears the selection, which is how a reader gets back to the
          site's own overview. The drawings are `pointer-events: none`, so a click that is
          not on a hit area or a label lands here. */}
      <div
        className="relative overflow-hidden"
        onClick={onClear}
        style={{width: frame, height: Math.max(height, lowestLabel + PAD_Y)}}
      >
        {/* The treeline, always behind - see `backdrop` in the data module. */}
        {[...placements]
          .filter((placement) => placement.backdrop === true)
          .sort(byDepth)
          .map((placement) => {
            const box = placementBox(placement);
            const corner = at(box.minX, box.minY);

            return (
              <SceneObject
                key={`backdrop-${placement.id}`}
                placement={placement}
                left={corner.left}
                top={corner.top}
                width={box.w * s}
                height={box.h * s}
                active={false}
                dimmed={hovered !== undefined}
              />
            );
          })}

        {/* The ground, over the treeline and under the plant. Its own layer rather than an
            item in the depth sort: nothing in the compound is ever behind the pad it
            stands on. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <Pad ground={platform} project={ground} thickness={Math.max(2, 140 * s)} />
        </svg>

        {[...placements]
          .filter((placement) => placement.backdrop !== true)
          .sort(byDepth)
          .map((placement) => {
            const box = placementBox(placement);
            const corner = at(box.minX, box.minY);
            const active = activeNode(placement.node);

            return (
              <SceneObject
                key={`object-${placement.id}`}
                placement={placement}
                left={corner.left}
                top={corner.top}
                width={box.w * s}
                height={box.h * s}
                active={active}
                dimmed={hovered !== undefined && !active}
              />
            );
          })}

        {/* Clicking the object itself, not only its label.
            
            One transparent hit area per node, over that node's own drawing, and they are
            **stacked largest first** so the small things win: the array frame's box covers
            the whole yard, and in DOM order a later, smaller rect sits over it. That is
            what makes a cabinet standing in the frame's shade clickable at all - it is a
            650 mm box inside a 14 m one.
            
            The labels remain controls too, and for two reasons that have not gone away: a
            hit area is a rectangle around a diamond, so it always claims a little ground
            that is not the object, and the label is the only version of this a keyboard
            reaches in a sensible order. So these carry `tabIndex={-1}` and no accessible
            name - they are a pointer convenience over a control that already exists,
            rather than a second copy of it in the tab order. */}
        {[...placements]
          .filter((placement) => placement.node !== undefined)
          .map((placement) => ({placement, box: placementBox(placement)}))
          .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
          .map(({placement, box}) => {
            const key = placement.node ?? '';
            const onSelect = selectHandler(key);
            if (onSelect === undefined) return null;
            const corner = at(box.minX, box.minY);

            return (
              <button
                key={`hit-${placement.id}`}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                }}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(undefined)}
                className="absolute cursor-pointer"
                style={{left: corner.left, top: corner.top, width: box.w * s, height: box.h * s}}
              />
            );
          })}

        {/* The leaders, over the plant and under the labels. Two segments: out of the
            object horizontally, then a short run to the label's own edge, which keeps every
            leader reading as a pointer rather than as a wire in the drawing. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          {anchored.map(({node, point, side}) => {
            const y = stacked[side].get(node.key) ?? point.top;
            const edge = side === 'left' ? GUTTER - 6 : frame - GUTTER + 6;
            const active = activeNode(node.key);

            return (
              <polyline
                key={`leader-${node.key}`}
                points={`${point.left},${point.top} ${edge},${point.top} ${edge},${y + 8}`}
                fill="none"
                strokeWidth={1}
                className={cn('stroke-current', active ? 'text-teal' : 'text-tertiary')}
              />
            );
          })}
        </svg>

        {anchored.map(({node, point, side}) => {
          const y = stacked[side].get(node.key) ?? point.top;
          const device = node.device;
          const onSelect =
            selection === undefined || device === undefined || !selection.devices.includes(device)
              ? undefined
              : () => selection.onSelect(device);

          return (
            <div
              key={`label-${node.key}`}
              className="absolute"
              style={{
                left: side === 'left' ? 0 : frame - GUTTER + 6,
                top: y,
                width: GUTTER - 6,
              }}
            >
              <Label
                node={node}
                side={side}
                selected={device !== undefined && device === selection?.selected}
                onSelect={onSelect}
                onHover={setHovered}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
