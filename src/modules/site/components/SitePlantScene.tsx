import {useRef, useState} from 'react';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import {siteHasCabinet} from '@/modules/cabinet/data/shelf';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {
  EQUIPMENT,
  byDepth,
  isoX,
  isoY,
  placementBox,
  plantLayout,
} from '../data/plantScene';
import type {PlantPlacement} from '../data/plantScene';
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
 * Everything a node says here — its word, its caption, its reading, whether it is
 * carrying — comes from `sourcesOf`, which is the diagram's own source list. That is
 * the whole reason this is a second **view** and not a second model: the two drawings
 * cannot disagree about the site, because there is one answer and both read it.
 *
 * ## The geometry is `plantScene.ts`'s
 *
 * Assets, millimetre boxes, the projection and the layout all live in the data module,
 * with the argument for each. This file scales that scene into the space it is given
 * and puts the words on it.
 *
 * ## Why the label is the control, and not the drawing
 *
 * In an isometric scene the drawings' bounding boxes overlap heavily — the array's box
 * covers the cabinet standing under it, and a transparent hit area over either one
 * would swallow clicks meant for the other. Sorting the buttons by depth would fix the
 * top-most case and still leave the array eating every click aimed at the frame's own
 * legs.
 *
 * So the **label chip beside each object is the button**, which is unambiguous at every
 * depth, reachable by keyboard in a sensible order, and already the thing carrying the
 * reading a person is looking at. Hovering or selecting it lifts the object it names, so
 * the drawing still answers the pointer without having to be the target.
 *
 * ## Fixed canvas, uniform scale
 *
 * Same argument the diagram makes, for a stronger reason: these objects sit on one
 * ground plane at true relative size, and reflowing them would put a cabinet through
 * the frame sheltering it. So the scene is measured in millimetres, then scaled
 * uniformly to whatever width the band gives it. Nothing moves relative to anything
 * else; the whole compound just gets smaller.
 */

/** Millimetres of plant per pixel is set by the fit; this is the readable floor. */
const MIN_WIDTH = 320;

/** Room for the labels, which sit outside the drawings' own extent. */
const PAD = {x: 96, y: 26};

/**
 * Where a chip sits relative to the point its object stands on.
 *
 * `below` is centred under the feet; `left` and `right` sit beside them and slightly
 * above, which is where a label can go on an isometric object without covering the
 * object next to it.
 */
const CHIP_OFFSET: Record<PlantPlacement['anchor'], {dx: number; dy: number}> = {
  below: {dx: 0, dy: 8},
  left: {dx: -8, dy: -22},
  right: {dx: 8, dy: -22},
};

type SceneNode = {
  placement: PlantPlacement;
  /** The word inside the chip — `SOLAR`, `CABINET`, as the diagram writes them. */
  label: string;
  /** What this is: `PV array`, `DC plant`, a genset's tag. */
  caption: string;
  /** What it is doing, in the same words the diagram's second caption line uses. */
  power: string;
  /** Carrying, in the diagram's sense — drives the teal. */
  live: boolean;
  /** The device behind it, or `undefined` where the node is not one. */
  device: SiteDeviceKey | undefined;
};

const nodesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): Array<SceneNode> => {
  const sources = sourcesOf(summary, dutyId, role);
  const feed = siteFeed(summary, dutyId, role);
  const loadKw = siteLoadKw(summary, dutyId, role);
  const hasCabinet = siteHasCabinet(summary.site.id, role);
  const anyLive = sources.some((source) => source.switchState.live);

  const gensetIds = summary.gensets.map(({genset}) => genset.id);
  const placements = plantLayout(role, gensetIds, hasCabinet);

  return placements.flatMap((placement): Array<SceneNode> => {
    if (placement.key === 'load') {
      return [
        {
          placement,
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

    if (placement.key === 'cabinet') {
      return [
        {
          placement,
          label: 'CABINET',
          caption: 'DC plant',
          power: cabinetPowerLabel(feed.source),
          live: anyLive,
          device: 'cabinet',
        },
      ];
    }

    const source = sources.find((candidate) => candidate.key === placement.key);
    // A placement with no source behind it is a site whose configuration changed under
    // the layout — an array on a site that is no longer a solar hybrid. Dropped rather
    // than drawn empty, which is the same call `SiteCircuit` makes about a stale
    // selection.
    if (source === undefined) return [];

    return [
      {
        placement,
        label: source.label,
        caption: source.caption,
        power: source.power,
        live: source.switchState.live,
        device: deviceOfSource(source.key),
      },
    ];
  });
};

const Chip = ({
  node,
  selected,
  onSelect,
  onHover,
}: {
  node: SceneNode;
  selected: boolean;
  onSelect: (() => void) | undefined;
  onHover: (key: string | undefined) => void;
}) => {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            node.live ? 'bg-teal' : 'bg-tertiary',
          )}
        />
        <span className="text-[11px] leading-none font-semibold text-primary">
          {node.label}
        </span>
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
    'flex flex-col items-start gap-0.5 rounded-md border bg-element/95 px-2 py-1.5 text-left backdrop-blur-sm',
    node.live ? 'border-teal/40' : 'border-default',
    selected && 'ring-2 ring-teal ring-offset-1 ring-offset-canvas',
  );

  if (onSelect === undefined) {
    return <span className={shell}>{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(node.placement.key)}
      onMouseLeave={() => onHover(undefined)}
      onFocus={() => onHover(node.placement.key)}
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
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
  selection?: SiteDiagramSelection;
}) => {
  const track = useRef<HTMLDivElement>(null);
  const {width} = useElementSize(track);
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  const nodes = nodesOf(summary, dutyId, role);

  // The scene's own extent, in millimetres: the union of every placed drawing's
  // projected box. Derived rather than declared, so adding an object to the layout
  // cannot leave it clipped.
  const boxes = nodes.map((node) => placementBox(node.placement));
  const minX = Math.min(...boxes.map((box) => box.minX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxX = Math.max(...boxes.map((box) => box.minX + box.w));
  const maxY = Math.max(...boxes.map((box) => box.minY + box.h));

  const sceneMm = {w: maxX - minX, h: maxY - minY};

  // Millimetres per pixel, from whatever width the band gave us. The padding is taken
  // out first, because the labels sit outside the drawings and would otherwise be the
  // part that gets clipped.
  // `useElementSize` reports 0 until the ref attaches, which is one layout effect
  // away; the floor covers that first pass as well as a genuinely narrow column.
  const available = Math.max(MIN_WIDTH, width) - PAD.x * 2;
  const s = available / sceneMm.w;

  const px = (mmX: number, mmY: number) => ({
    left: PAD.x + (mmX - minX) * s,
    top: PAD.y + (mmY - minY) * s,
  });

  return (
    <div ref={track} className="w-full">
      <div
        className="relative"
        style={{
          width: sceneMm.w * s + PAD.x * 2,
          height: sceneMm.h * s + PAD.y * 2,
        }}
      >
        {[...nodes].sort((a, b) => byDepth(a.placement, b.placement)).map((node) => {
          const box = placementBox(node.placement);
          const at = px(box.minX, box.minY);
          const active =
            hovered === node.placement.key ||
            (node.device !== undefined && node.device === selection?.selected);

          return (
            <img
              key={`asset-${node.placement.key}`}
              src={EQUIPMENT[node.placement.equipment].url}
              alt={EQUIPMENT[node.placement.equipment].alt}
              draggable={false}
              className={cn(
                'pointer-events-none absolute transition-[filter,opacity] duration-150',
                // Everything is drawn at full strength until something is picked out,
                // and then it is the *others* that recede. Dimming is the only way to
                // single an object out in a scene this dense that does not mean
                // redrawing it: a ring around an isometric object is a rectangle
                // around a diamond, and a tint changes what the drawing is saying,
                // since colour in these assets is material rather than state.
                hovered !== undefined && !active && 'opacity-40',
                active && 'drop-shadow-[0_0_10px_var(--color-teal)]',
              )}
              style={{
                left: at.left,
                top: at.top,
                width: box.w * s,
                height: box.h * s,
              }}
            />
          );
        })}

        {nodes.map((node) => {
          // The chip hangs off the object's own ground origin, which is the point the
          // thing actually stands on — not its box's corner, which drifts with however
          // much sky the drawing happens to include above it.
          const at = px(
            isoX(node.placement.x, node.placement.y),
            isoY(node.placement.x, node.placement.y),
          );
          const device = node.device;
          const onSelect =
            selection === undefined ||
            device === undefined ||
            !selection.devices.includes(device)
              ? undefined
              : () => selection.onSelect(device);

          return (
            <div
              key={`chip-${node.placement.key}`}
              className={cn(
                'absolute',
                node.placement.anchor === 'below' && '-translate-x-1/2',
                node.placement.anchor === 'left' && '-translate-x-full',
              )}
              style={{
                left: at.left + CHIP_OFFSET[node.placement.anchor].dx,
                top: at.top + CHIP_OFFSET[node.placement.anchor].dy,
              }}
            >
              <Chip
                node={node}
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
