import arrayShelter from '@/assets/equipment/ground-mount-telco-iso-light.svg';
import batteryRack from '@/assets/equipment/telco-battery-rack-iso-light.svg';
import gensetCanopy from '@/assets/equipment/genset-canopy-small-iso-light.svg';
import linePole from '@/assets/equipment/overhead-line-pole-iso-light.svg';
import powerCabinet from '@/assets/equipment/telco-power-cabinet-iso-light.svg';
import tower from '@/assets/equipment/lattice-tower-iso-light.svg';

import type {SitePowerRole} from '../types/site.type';
import {hasBattery, hasMains, hasSolar} from '../types/site.type';

/**
 * The site as **plant standing on the ground**, rather than as a circuit.
 *
 * The single-line diagram in `SiteDiagram` says what is connected to what. This says
 * what a technician would see walking through the gate: the array on its frame, the
 * cabinet, the bank, the set, and the tower the whole compound exists to keep up.
 * Same nodes, same click, same captions — a second projection of one site, not a
 * second model of it.
 *
 * ## Where the drawings come from
 *
 * Every asset is an SVG out of the vault's `render-equipment` skill, copied into
 * `src/assets/equipment/`. They are **label-free by that skill's rule 3** — no `<text>`
 * is ever emitted into one — so every word on this scene is the app's own, in HTML,
 * where it stays reviewable. That is also what makes them usable here at all: a caption
 * baked into the drawing could not carry a live reading.
 *
 * They are authored in **millimetres** and projected on the skill's own isometric,
 * `iso(x, y, z) = [(x - y) * cos30, (x + y) / 2 - z]`, with the viewer at (+1, +1, +1).
 * Two consequences this file leans on:
 *
 *  - **Real dimensions compose.** Because each file's viewBox is in millimetres, laying
 *    the assets out on one ground plane at one scale puts them at their true relative
 *    size. The 13.4 m array shelter really is seven times the 1.9 m cabinet, and the
 *    scene reads as a site rather than as an icon row, without a single hand-tuned
 *    offset.
 *  - **A larger `x + y` is nearer**, so that sum is the paint order. Nothing here needs
 *    a z-index by hand.
 *
 * ## Why the boxes are written down rather than read
 *
 * Placement needs each drawing's viewBox: the object's own origin `(0, 0, 0)` projects
 * to `(0, 0)` in the file's coordinates, which sits at `(-minX, -minY)` from the image's
 * top-left corner. An `<img>` does not expose its viewBox, and inlining the SVGs
 * instead would walk into the collision the skill's embedding contract warns about —
 * an SVG `<style>` block is not scoped to its own SVG, so two inlined drawings fight
 * over `.o`/`.p`/`.d`.
 *
 * So the boxes are measured from the files and recorded here, and
 * `scripts/check-equipment-boxes.mjs` re-measures them against the shipped SVGs and
 * fails if any has drifted. That check is the point: the skill's generators are
 * dimension-driven, so an upstream correction to a real dimension — a cabinet that
 * turns out to be 600 mm deeper than it was drawn — legitimately changes the viewBox,
 * and this scene would otherwise place it silently wrong.
 */

/** A drawing's viewBox, in millimetres, as the file declares it. */
type Box = {minX: number; minY: number; w: number; h: number};

type Equipment = {
  url: string;
  box: Box;
  /**
   * What the drawing is, for the `alt` text.
   *
   * The node's own label — `SOLAR`, `CABINET` — is the site's vocabulary and comes
   * from the diagram's sources. This is the equipment: a reader on a screen reader
   * hears "ground-mount solar array on a walk-under frame", which is the thing in the
   * picture, and the label and reading beside it are separate text they also get.
   */
  alt: string;
};

export type EquipmentId =
  | 'arrayShelter'
  | 'batteryRack'
  | 'gensetCanopy'
  | 'linePole'
  | 'powerCabinet'
  | 'tower';

export const EQUIPMENT: Record<EquipmentId, Equipment> = {
  arrayShelter: {
    url: arrayShelter,
    box: {minX: -11966.42, minY: -4933.2, w: 13350.71, h: 10810.49},
    alt: 'Ground-mount solar array on a walk-under frame',
  },
  batteryRack: {
    url: batteryRack,
    box: {minX: -517.44, minY: -642.63, w: 1037.14, h: 1199.25},
    alt: 'Open 19-inch battery rack loaded with rack-mount modules',
  },
  gensetCanopy: {
    url: gensetCanopy,
    box: {minX: -962.31, minY: -1109.12, w: 2877.24, h: 2654.48},
    alt: 'Canopied diesel generating set on a plinth',
  },
  linePole: {
    url: linePole,
    box: {minX: -6329.5, minY: -13645.24, w: 12659, h: 14314.73},
    alt: 'Overhead line pole carrying the incoming supply',
  },
  powerCabinet: {
    url: powerCabinet,
    box: {minX: -780.03, minY: -2118.45, w: 1949.77, h: 3162.52},
    alt: 'Outdoor DC power cabinet',
  },
  tower: {
    url: tower,
    box: {minX: -7501.34, minY: -31660.46, w: 15002.69, h: 36495.92},
    alt: 'Lattice tower carrying the site’s radio equipment',
  },
};

const COS30 = Math.cos(Math.PI / 6);

/** The skill's own projection, ground plane only — every asset stands at `z = 0`. */
export const isoX = (x: number, y: number): number => (x - y) * COS30;
export const isoY = (x: number, y: number): number => (x + y) / 2;

export type PlantPlacement = {
  /**
   * The node this drawing stands for, in the **diagram's** own key vocabulary —
   * `solar`, `battery`, `cabinet`, `mains`, `load`, or a genset's id.
   *
   * Deliberately the same strings `sourcesOf` returns, so the scene and the
   * single-line diagram cannot disagree about which box a reader clicked. `load` is
   * the one key that is not a source: it is the tower, and like the diagram's load
   * node it is not a device and offers no click.
   */
  key: string;
  equipment: EquipmentId;
  /** Ground position of the drawing's own origin, in millimetres. */
  x: number;
  y: number;
  /**
   * Which side of the object its label hangs on.
   *
   * The chips would otherwise all sit under their objects' feet and collide, since the
   * objects themselves are inches apart on a compound this size. This is the one part
   * of the scene that is composed by eye rather than derived, and it is a label
   * position rather than a geometry, so it cannot put a drawing in the wrong place.
   */
  anchor: 'left' | 'right' | 'below';
  /**
   * A deliberate departure from true scale, where one is unavoidable.
   *
   * Only the tower carries one. A real lattice tower is 30 m and up — the asset is
   * 36.5 m tall — and at true scale beside a 1.9 m cabinet it is the whole picture and
   * everything a reader came to click is a smudge along the bottom edge. The
   * `render-equipment` skill's own site-scene compositions make exactly this
   * concession, drawing their backdrop tower as a scaled-down lattice shaft, and this
   * follows them.
   *
   * It is one number on one asset and it is written down here rather than baked into a
   * layout offset, so the scene says out loud which single object is not to scale.
   */
  scale?: number;
};

/**
 * Where each thing stands, in millimetres on the compound's ground plane.
 *
 * Ground coordinates rather than screen offsets, so the layout survives a change of
 * scale, a change of viewport, and a corrected dimension upstream. Reading the compound
 * from the back: the tower, the array on its frame, then the DC plant and the bank, with
 * the sets forward of everything on their own access. The one place this gives up a
 * piece of site truth for legibility is noted against the cabinet.
 */
export const plantLayout = (
  role: SitePowerRole,
  gensetIds: ReadonlyArray<string>,
  hasCabinet: boolean,
): Array<PlantPlacement> => {
  const placements: Array<PlantPlacement> = [
    // Furthest back, and the only object not at true scale — see `scale`.
    {key: 'load', equipment: 'tower', x: 0, y: 3000, scale: 0.3, anchor: 'left'},
  ];

  if (hasSolar(role)) {
    // The frame's origin is the near-right corner of the array, not its centre: its
    // viewBox runs almost entirely negative in x, so the drawing extends left and up
    // from the point named here.
    placements.push({key: 'solar', equipment: 'arrayShelter', x: 12000, y: 1000, anchor: 'right'});
  }

  if (hasMains(role)) {
    placements.push({key: 'mains', equipment: 'linePole', x: 2000, y: 0, scale: 0.45, anchor: 'left'});
  }

  // The cabinet and the bank stand **forward of the array frame**, not under it.
  // Under it is where the group actually builds them — the `render-equipment` skill
  // records the correction, off a JENDELA site acceptance photo, that a telco
  // ground-mount array is built tall enough to shelter the site's own cabinets like a
  // carport. Drawn that way from this angle the panels sit over them and the two things
  // a reader most often opens are behind a roof. So the arrangement gives up that one
  // piece of site truth to keep both objects visible and clickable, and says so here
  // rather than in a layout offset nobody would read.
  if (hasCabinet) {
    placements.push({key: 'cabinet', equipment: 'powerCabinet', x: 13000, y: 11000, anchor: 'below'});
  }

  if (hasBattery(role)) {
    placements.push({key: 'battery', equipment: 'batteryRack', x: 15200, y: 8800, anchor: 'right'});
  }

  // Sets forward of the plant, in a row running towards the viewer so a second one
  // never hides behind the first.
  //
  // How far forward depends on whether there is an array, and that is a real difference
  // rather than a layout tweak: the array frame is 13 m of the compound, and a site
  // without one is a physically smaller yard. Kept at the array's distance regardless,
  // a grid-backed site's sets stand alone in the middle of a compound that is not there.
  const front = hasSolar(role) ? {x: 8000, y: 16000} : {x: 3600, y: 8000};

  gensetIds.forEach((id, index) => {
    placements.push({
      key: id,
      equipment: 'gensetCanopy',
      x: front.x,
      y: front.y + index * 4200,
      // Alternating, because sets are the one node a site can have several of, and
      // their chips carry the same word — stacked on one side they read as one label
      // over two machines.
      anchor: index % 2 === 0 ? 'left' : 'right',
    });
  });

  return placements;
};

/** The projected extent of a placed drawing, in millimetres, ready to be scaled. */
export const placementBox = (placement: PlantPlacement): Box => {
  const {box} = EQUIPMENT[placement.equipment];
  const s = placement.scale ?? 1;

  return {
    minX: isoX(placement.x, placement.y) + box.minX * s,
    minY: isoY(placement.x, placement.y) + box.minY * s,
    w: box.w * s,
    h: box.h * s,
  };
};

/** Nearest last, so the paint order is the depth order — see the file header. */
export const byDepth = (a: PlantPlacement, b: PlantPlacement): number =>
  a.x + a.y - (b.x + b.y);
