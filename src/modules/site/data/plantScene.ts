import arrayShelter from '@/assets/equipment/ground-mount-telco-shelter-iso-light.svg';
import fenceRun from '@/assets/equipment/chainlink-fence-iso-light.svg';
import telcoCabinet from '@/assets/equipment/bts-radio-cabinet-telco-iso-light.svg';
import gensetCanopy from '@/assets/equipment/genset-canopy-small-iso-light.svg';
import linePole from '@/assets/equipment/overhead-line-pole-iso-light.svg';
import powerCabinet from '@/assets/equipment/telco-power-cabinet-iso-light.svg';
import shrub from '@/assets/equipment/landscape-shrub-iso-light.svg';
import tower from '@/assets/equipment/lattice-tower-iso-light.svg';
import tree from '@/assets/equipment/landscape-tree-iso-light.svg';

import type {SitePowerRole} from '../types/site.type';
import {hasMains} from '../types/site.type';

/**
 * The site as **plant standing on the ground**.
 *
 * This says what a technician would see walking through the gate: the pad, the cabinet
 * line-up, the set beside it, the tower the whole compound exists to keep up, and the
 * jungle on the other side of the fence.
 *
 * It was one of two projections. The other was `SiteDiagram`, a single-line circuit
 * saying what is connected to what, and it has been removed: a schematic of an incomer,
 * a bus and a set is a telco DC plant drawing, and this product puts a genset in a
 * yard. What a reader arriving at a site is asking is what is standing there.
 *
 * ## Where the drawings come from
 *
 * Every object is an SVG out of the vault's `render-equipment` skill, copied into
 * `src/assets/equipment/`. They are **label-free by that skill's rule 3** - no `<text>`
 * is ever emitted into one - so every word on this scene is the app's own, in HTML,
 * where it stays reviewable. That is also what makes them usable here at all: a caption
 * baked into a drawing could not carry a live reading.
 *
 * They are authored in **millimetres** and projected on the skill's own isometric,
 * `iso(x, y, z) = [(x - y) * cos30, (x + y) / 2 - z]`, with the viewer at (+1, +1, +1).
 * Two consequences this file leans on:
 *
 *  - **Real dimensions compose.** Because each file's viewBox is in millimetres, laying
 *    the objects out on one ground plane at one scale puts them at their true relative
 *    size. A 650 mm cabinet really is a quarter of the 2.6 m line-up it stands in and a
 *    twentieth of the array frame beside it, with no hand-tuned offsets.
 *  - **A larger `x + y` is nearer**, so that sum is the paint order. Nothing here needs
 *    a z-index by hand.
 *
 * ## The arrangement is a real site, corrected
 *
 * The first version of this scene had the bank as a separate open 19-inch rack standing
 * in the yard, the objects spread out across the compound to keep their labels apart,
 * and no ground under any of it. All three were wrong, per Lucas:
 *
 *  - **The battery is in the power cabinet.** A telco site does not stand an open rack
 *    outdoors. There are usually **three or four cabinets in a line**: one carries the
 *    subrack and some battery modules, the rest are all battery modules. So `cabinet`
 *    and `battery` are not two objects here, they are two *readings on one line-up* -
 *    the subrack cabinet, and the battery cabinets beside it. A5's open rack is out of
 *    the scene; it belongs indoors.
 *  - **The plant is close together.** The set, the cabinets, the array and the load sit
 *    within metres of each other, because the runs between them are copper and short.
 *    Spreading them to make room for labels drew a compound nobody builds.
 *  - **A site has ground, a fence, and jungle behind it.** Objects floating on white read
 *    as a catalogue page. The pad is what they stand on, the fence is the site boundary,
 *    and the planting behind it is what is actually there.
 *
 * ## Known overlap, and the fix that belongs upstream
 *
 * `ground-mount-telco` (D5) draws **its own generic cabinet line-up** under the frame -
 * `CAB = {w: 700, d: 500, h: 1700}` in that generator - because the asset was written to
 * stand alone in a deck, where an array sheltering nothing looks unfinished. Here that
 * line-up is a second set of cabinets next to the real one, which no site has.
 *
 * The scene keeps the array clear of the cabinet row so the two do not sit on top of each
 * other, which makes the frame's own cabinets read as part of that drawing rather than as
 * duplicate plant. **The proper fix is a `cabinets` count on D5, defaulting to what it
 * draws today**, so a composition can ask for the frame alone - exactly the shape of
 * change that skill already made for `gensets` on F1 and `tilt` on D5 itself. Left undone
 * deliberately: that folder is a shared submodule and another session is drawing in it.
 *
 * ## Why the boxes are written down rather than read
 *
 * Placement needs each drawing's viewBox: the object's own origin `(0, 0, 0)` projects to
 * `(0, 0)` in the file's coordinates, which sits at `(-minX, -minY)` from the image's
 * top-left corner. An `<img>` does not expose a viewBox, and inlining the SVGs instead
 * would walk into the collision the skill's embedding contract warns about - an SVG
 * `<style>` block is not scoped to its own SVG, so two inlined drawings fight over
 * `.o`/`.p`/`.d`.
 *
 * So the boxes are measured from the files and recorded here, and
 * `scripts/check-equipment-boxes.mjs` re-measures them against the shipped SVGs and fails
 * if any has drifted. That check is the point: the skill's generators are dimension-driven,
 * so an upstream correction to a real dimension - a cabinet that turns out to be 600 mm
 * deeper than it was drawn - legitimately changes the viewBox, and this scene would
 * otherwise place it silently wrong.
 */

/** A drawing's viewBox, in millimetres, as the file declares it. */
type Box = {minX: number; minY: number; w: number; h: number};

type Equipment = {
  url: string;
  box: Box;
  /**
   * What the thing actually stands on, in millimetres, relative to its own origin.
   *
   * The `box` above is the **projected** extent - the drawing, including its roof, its
   * shadow and whatever sky it carries above itself - and it is no use for deciding where
   * the concrete has to reach. This is the plan footprint, off each generator's own
   * dimension table, so the slab can be derived from what is standing on it rather than
   * drawn as a rectangle somebody guessed and then had to keep re-guessing.
   *
   * The signs matter: most objects run positive in both axes from their origin, because
   * `drawBox` puts the origin at the far corner and the near vertical edge at `(w, d)`.
   * The array frame is the exception - it rakes back in `-x` from its front posts - and
   * the tower's foundation pad is centred on its own axis.
   */
  foot: {x0: number; y0: number; x1: number; y1: number};
  /**
   * What the drawing is, for the `alt` text.
   *
   * The node's own label - `SOLAR`, `CABINET` - is the site's vocabulary and comes from
   * the diagram's sources. This is the equipment: a reader on a screen reader hears
   * "ground-mount solar array on a walk-under frame", which is the thing in the picture,
   * and the label and reading beside it are separate text they also get. Scenery carries
   * an empty string and drops out of the tree, because a fence post is not information.
   */
  alt: string;
};

export type EquipmentId =
  | 'arrayShelter'
  | 'fenceRun'
  | 'gensetCanopy'
  | 'linePole'
  | 'powerCabinet'
  | 'shrub'
  | 'telcoCabinet'
  | 'tower'
  | 'tree';

export const EQUIPMENT: Record<EquipmentId, Equipment> = {
  arrayShelter: {
    url: arrayShelter,
    box: {minX: -13257.59, minY: -6006.42, w: 14775.31, h: 11980.44},
    foot: {x0: -3924, y0: 0, x1: 155, y1: 9787}, // D5 at rows 3: the frame rakes back in -x from its front posts
    alt: 'Ground-mount solar array on a walk-under frame',
  },
  fenceRun: {
    url: fenceRun,
    box: {minX: -1817.88, minY: -2463.83, w: 19224.22, h: 12779.16},
    foot: {x0: 0, y0: 0, x1: 18000, y1: 70},
    alt: '',
  },
  gensetCanopy: {
    url: gensetCanopy,
    box: {minX: -962.31, minY: -1109.12, w: 2877.24, h: 2654.48},
    foot: {x0: 0, y0: 0, x1: 2100, y1: 1000}, // 1900 x 800 canopy plus the skid overhang
    alt: 'Canopied diesel generating set on a plinth',
  },
  linePole: {
    url: linePole,
    box: {minX: -6329.5, minY: -13645.24, w: 12659, h: 14314.73},
    foot: {x0: -400, y0: -400, x1: 400, y1: 400},
    alt: 'Overhead line pole carrying the incoming supply',
  },
  powerCabinet: {
    url: powerCabinet,
    box: {minX: -727.18, minY: -1661.83, w: 1454.36, h: 2440.4},
    foot: {x0: 0, y0: 0, x1: 650, y1: 795}, // the ICC330-HA1-C10, 650 wide x 795 deep including the door a/c
    alt: 'Outdoor DC power cabinet',
  },
  shrub: {
    url: shrub,
    box: {minX: -1108.27, minY: -670.5, w: 2216.54, h: 1341.01},
    foot: {x0: -520, y0: -520, x1: 520, y1: 520},
    alt: '',
  },
  tower: {
    url: tower,
    box: {minX: -7501.34, minY: -31660.46, w: 15002.69, h: 36495.92},
    foot: {x0: -3167, y0: -3167, x1: 3167, y1: 3167}, // A12's foundation pad, 1.9 x a 3,333 base, centred on the axis
    alt: 'Lattice tower carrying the site radio equipment',
  },
  tree: {
    url: tree,
    box: {minX: -2024.72, minY: -2711.73, w: 4049.45, h: 3936.69},
    foot: {x0: -950, y0: -950, x1: 950, y1: 950},
    alt: '',
  },
  telcoCabinet: {
    url: telcoCabinet,
    box: {minX: -366.35, minY: -938.08, w: 992.5, h: 1469.91},
    foot: {x0: 0, y0: 0, x1: 600, y1: 300}, // A9, 600 x 300
    alt: '',
  },
};

const COS30 = Math.cos(Math.PI / 6);

/** The skill's own projection, ground plane only - every object stands at `z = 0`. */
export const isoX = (x: number, y: number): number => (x - y) * COS30;
export const isoY = (x: number, y: number): number => (x + y) / 2;

export type ScenePlacement = {
  /** Unique within a scene, for React's key. Several placements can share a node. */
  id: string;
  /**
   * The node this drawing stands for, in the **diagram's** own key vocabulary -
   * `solar`, `battery`, `cabinet`, `mains`, `load`, or a genset's id. Absent on scenery.
   *
   * Deliberately the same strings `sourcesOf` returns, so the scene and the single-line
   * diagram cannot disagree about which box a reader clicked. `load` is the one key that
   * is not a source: it is the tower, and like the diagram's load node it is not a device
   * and offers no click.
   *
   * **Several placements may carry the same node.** The battery cabinets are three
   * drawings and one reading, and hovering or selecting the node lifts all three, because
   * the bank *is* those three cabinets.
   */
  node?: string;
  /**
   * The one placement of a node that carries its label. Exactly one per node.
   *
   * On the battery line-up it is the middle cabinet, so the chip sits over the run rather
   * than off one end of it.
   */
  chip?: true;
  /** Which side of the object the label hangs on - only read where `chip` is set. */
  anchor?: 'left' | 'right' | 'below';
  equipment: EquipmentId;
  /** Ground position of the drawing's own origin, in millimetres. */
  x: number;
  y: number;
  /**
   * A deliberate departure from true scale.
   *
   * Two things carry one, and both say so out loud rather than hiding it in a layout
   * offset:
   *
   *  - **The tower.** A real lattice tower is 30 m and up, and the asset is 36.5 m. At
   *    true scale beside a 1.85 m cabinet it is the entire picture and everything a reader
   *    came to click is a smudge along the bottom edge. The `render-equipment` skill's own
   *    site-scene compositions make exactly this concession, drawing their backdrop tower
   *    as a scaled-down lattice shaft.
   *  - **The planting.** A20's tree is a 3.5 m sapling, which behind a 1.8 m fence reads
   *    as scrub rather than as the jungle these sites actually sit in. Scaled up, with
   *    per-tree variation, so a treeline reads as a treeline.
   */
  scale?: number;
  /**
   * Mirror the drawing horizontally, which turns a run along `x` into a run along `y`.
   *
   * Exact rather than approximate, and it is the projection that makes it so: `iso(x, 0)`
   * is `(x*cos30, x/2)` and `iso(0, y)` is `(-y*cos30, y/2)`, so the two axes' projections
   * are mirror images of each other. A fence run drawn along `x` therefore becomes a
   * correct run along `y` under `scaleX(-1)`, which is how the compound gets two sides out
   * of one asset. Anything whose own detail is handed - a door, a badge - must not use it.
   */
  flipX?: true;
  /**
   * Not a control: no node, no chip, no place in the accessibility tree.
   *
   * Two quite different things carry it, which is why it does **not** also mean "not on
   * the slab" - see `offSlab`. The fence and the planting are scenery because they are the
   * setting. The telco equipment cabinets, and the power cabinet at a site with no cabinet
   * page, are scenery because this app has no readings for them: they are unmistakably
   * plant standing on the concrete, and only their data is missing.
   */
  scenery?: true;
  /**
   * Outside the compound: the fence line itself, and the trees beyond it.
   *
   * This is what the slab and the frame are derived from, and it has to be its own flag
   * rather than a reading of `scenery`. Conflating the two put every unlabelled cabinet
   * outside the concrete - a diesel-prime site's whole cabinet line-up stood on grass,
   * because the pad was computed from the tower and the sets alone.
   *
   * The rule is physical, not editorial: if it stands inside the fence, the slab reaches
   * it and the view frames it, whether or not the app can say anything about it.
   */
  offSlab?: true;
  /**
   * Always behind the plant, whatever the depth sort would say.
   *
   * The treeline wraps the compound, and in a true depth sort the trees off the near
   * corners land in *front* of the equipment and hide it. A backdrop is what a treeline
   * is being used as here, so it is drawn as one: its own layer, before the ground.
   */
  backdrop?: true;
};

/**
 * A rectangle on the ground, in millimetres: the concrete pad, and the fence line.
 *
 * The pad is drawn by the scene rather than placed as an asset, because it is the one
 * element whose extent has to follow the layout - a fixed-size pad drawing would either
 * float inside the fence or run out under it, and the `render-equipment` catalogue is for
 * objects with real dimensions of their own rather than for ground that is however big the
 * site is. It is also two flat quads and an edge, which is not an asset's worth of geometry.
 */
export type Ground = {x0: number; y0: number; x1: number; y1: number};

export type PlantScene = {
  placements: Array<ScenePlacement>;
  platform: Ground;
  compound: Ground;
};

/**
 * Cabinets stand bolted side by side at their own width, plus a seam.
 *
 * 650 mm is the ICC330-HA1-C10's real width, off the datasheet in the dyna Engineering
 * drive - the generator was drawing 1100 until that cross-check, and a line-up pitched at
 * the old figure would leave 500 mm of daylight between every cabinet.
 */
const CABINET_PITCH = 690;

/**
 * How far the slab reaches past the plant standing on it, in millimetres.
 *
 * Access, not decoration: a technician opens a cabinet door and stands in front of it, and
 * a set needs room to be worked on. 1.2 m is about the walkway the group's own site
 * photographs show around a cabinet line-up.
 */
const PAD_MARGIN = 1200;

/**
 * A small deterministic generator, seeded off the site id.
 *
 * The treeline is a scatter and a scatter needs randomness, but a scene that re-scatters
 * on every render is a scene that flickers when a reading updates, and these components
 * re-render on the site's own clock. Seeded, the same site always grows the same trees.
 */
const lcg = (seed: number) => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const seedOf = (siteId: string): number => {
  let hash = 7;
  for (const character of siteId) hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  return hash;
};

/**
 * Where everything stands, in millimetres on the compound's ground plane.
 *
 * Ground coordinates rather than screen offsets, so the layout survives a change of scale,
 * a change of viewport, and a corrected dimension upstream.
 */
export const plantScene = (
  siteId: string,
  role: SitePowerRole,
  gensetIds: ReadonlyArray<string>,
): PlantScene => {
  const placements: Array<ScenePlacement> = [];

  // A yard is as big as what stands in it, and what stands in one here is a set, the
  // cabinets and the tower — an 11 m plot. It was 18 m at a site carrying an array
  // frame over the equipment; with no array to leave room for, the smaller compound
  // is the only one. The fence asset is a fixed 18 m run, so it simply carries on past
  // the far corners, which is what a fence does.
  const size = 11000;
  const compound: Ground = {x0: 0, y0: 0, x1: size, y1: size};

  // Behind the fence: the treeline. Outside the compound on the two far sides, which are
  // the two the viewer can see past. A backdrop layer rather than an item in the depth
  // sort - see `backdrop`.
  const random = lcg(seedOf(siteId));
  for (let index = 0; index < 16; index++) {
    const alongX = index % 2 === 0;
    const along = -1500 + random() * (size - 2000);
    const back = 900 + random() * 3200;

    placements.push({
      id: `planting-${index}`,
      equipment: random() > 0.3 ? 'tree' : 'shrub',
      x: alongX ? along : -back,
      y: alongX ? -back : along,
      scale: 1.6 + random() * 1.1,
      scenery: true,
      backdrop: true,
      offSlab: true,
    });
  }

  // The fence: one asset, two runs - see `flipX`.
  placements.push({
    id: 'fence-x',
    equipment: 'fenceRun',
    x: compound.x0,
    y: compound.y0,
    scenery: true,
    offSlab: true,
  });
  placements.push({
    id: 'fence-y',
    equipment: 'fenceRun',
    x: compound.x0,
    y: compound.y0,
    flipX: true,
    scenery: true,
    offSlab: true,
  });

  // The tower, at the back of the pad and clear of the frame.
  placements.push({
    id: 'tower',
    node: 'load',
    chip: true,
    anchor: 'left',
    equipment: 'tower',
    x: 3400,
    y: 3200,
    scale: 0.3,
  });

  if (hasMains(role)) {
    // Outside the fence, where an incomer actually terminates.
    placements.push({
      id: 'mains',
      node: 'mains',
      chip: true,
      anchor: 'right',
      equipment: 'linePole',
      x: size + 1200,
      y: 1600,
      scale: 0.45,
    });
  }

  // The array frame, with the cabinets standing in its shade.
  //
  // Where the cabinets stand: on the open pad. **Every** site has cabinets, whatever
  // supplies it.
  const line = {x: 6400, y: 4000};

  // **The DC plant is always drawn**, because every site has one — and it is scenery,
  // because this product has no readings for it. It carries no node, no label and no
  // click: a reader sees what stands on the slab, and the scene does not imply data it
  // does not have. Same contract as the telco equipment cabinets below.
  placements.push({
    id: 'cabinet-0',
    scenery: true,
    equipment: 'powerCabinet',
    x: line.x,
    y: line.y,
  });

  // The telco equipment cabinets, at the end of the same run and in the same shade.
  //
  // **Unlabelled, and deliberately.** A telco site carries two kinds of cabinet: the power
  // cabinets, which are this product's subject, and the operator's own transmission and
  // radio equipment, which is not. Every site has both, so leaving the second kind out
  // draws a compound that is missing half of what is on the pad - but this app has no
  // readings for them, because they belong to the telco side. So they stand in the scene
  // as plant and carry no node, no label and no click: a reader sees what is there, and
  // the scene does not imply data it does not have.
  //
  // They are the **darker grey** build of A9 rather than the default, because the default
  // and the power cabinet are both bodied in `shell` and at this scale that made them one
  // kind of thing - size and detail are gone by the time the compound fits in a card, and
  // colour is what is left. The skill carries the variant, so this is a differently
  // finished enclosure rather than a tint applied here.
  const telcoAt = line.y + 1.6 * CABINET_PITCH;
  for (let index = 0; index < 2; index++) {
    placements.push({
      id: `telco-cabinet-${index}`,
      equipment: 'telcoCabinet',
      x: line.x - 60,
      y: telcoAt + index * 900,
      scenery: true,
    });
  }

  // The sets, forward of the plant and on their own access.
  //
  // **Never under the array.** A set needs its exhaust, its radiator air and a crane over
  // it, so it is not built in the frame's shade, and drawing it there would be a claim
  // about how these sites go together that is simply wrong.
  gensetIds.forEach((id, index) => {
    placements.push({
      id: `genset-${id}`,
      node: id,
      chip: true,
      // Alternating, because sets are the one node a site can have several of and their
      // chips carry the same word - stacked on one side they read as one label over two
      // machines.
      anchor: index % 2 === 0 ? 'left' : 'right',
      equipment: 'gensetCanopy',
      x: 3200,
      y: 7600 + index * 2800,
    });
  });

  // The slab is **derived from what stands on it**, not drawn as a rectangle and then
  // kept in step by eye. Every object's plan footprint, plus a working margin for the
  // access around it, and the union is the concrete.
  //
  // It is derived because the alternative kept failing: the pad was two hardcoded
  // rectangles, one per compound size, and every time the layout moved something the
  // equipment ended up standing on grass. Lucas caught the sets doing exactly that on a
  // grid-connected site. A slab that follows the plant cannot fall out of step with it.
  const feet = placements
    .filter((placement) => placement.offSlab !== true)
    .map((placement) => {
      const {foot} = EQUIPMENT[placement.equipment];
      const scale = placement.scale ?? 1;
      return {
        x0: placement.x + foot.x0 * scale,
        y0: placement.y + foot.y0 * scale,
        x1: placement.x + foot.x1 * scale,
        y1: placement.y + foot.y1 * scale,
      };
    });

  const platform: Ground = {
    x0: Math.min(...feet.map((foot) => foot.x0)) - PAD_MARGIN,
    y0: Math.min(...feet.map((foot) => foot.y0)) - PAD_MARGIN,
    x1: Math.max(...feet.map((foot) => foot.x1)) + PAD_MARGIN,
    y1: Math.max(...feet.map((foot) => foot.y1)) + PAD_MARGIN,
  };

  return {placements, platform, compound};
};

/** The projected extent of a placed drawing, in millimetres, ready to be scaled. */
export const placementBox = (placement: ScenePlacement): Box => {
  const {box} = EQUIPMENT[placement.equipment];
  const s = placement.scale ?? 1;
  const originX = isoX(placement.x, placement.y);
  const originY = isoY(placement.x, placement.y);

  // A mirrored drawing's box mirrors with it: what was `minX` to the left of the origin
  // ends up the same distance to its right.
  const minX = placement.flipX === true ? -(box.minX + box.w) * s : box.minX * s;

  return {minX: originX + minX, minY: originY + box.minY * s, w: box.w * s, h: box.h * s};
};

/** Nearest last, so the paint order is the depth order - see the file header. */
export const byDepth = (a: ScenePlacement, b: ScenePlacement): number =>
  a.x + a.y - (b.x + b.y);
