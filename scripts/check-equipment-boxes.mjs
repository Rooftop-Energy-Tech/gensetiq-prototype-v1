// Re-measure the equipment drawings against the boxes `plantScene.ts` places them by.
//
// The scene lays its assets out on one ground plane in millimetres, and to do that it
// needs each drawing's viewBox: the object's origin `(0, 0, 0)` projects to `(0, 0)` in
// the file's own coordinates, which sits at `(-minX, -minY)` from the image's top-left
// corner. An `<img>` does not expose a viewBox, so those numbers are written down in
// `EQUIPMENT` — and a written-down measurement of a file that can change is a silent
// fault waiting to happen.
//
// It can change, and legitimately: the drawings come from the vault's `render-equipment`
// skill, whose generators are dimension-driven, so a corrected real dimension — a
// cabinet that turns out to be deeper than it was drawn — moves the viewBox. The scene
// would go on placing the object by the old origin and nothing would look broken enough
// to notice.
//
//   bun run check:equipment
//
// Exits non-zero on any drift, naming the asset and both boxes.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const ASSETS = join(import.meta.dirname, '..', 'src', 'assets', 'equipment');
const SCENE = join(import.meta.dirname, '..', 'src', 'modules', 'site', 'data', 'plantScene.ts');

/** `viewBox="minX minY w h"`, the only thing this cares about in an SVG. */
const viewBoxOf = (svg) => {
  const match = /viewBox="([-\d. ]+)"/.exec(svg);
  if (match === null) return undefined;

  const [minX, minY, w, h] = match[1].trim().split(/\s+/).map(Number);
  return {minX, minY, w, h};
};

// The scene's own table, read as text rather than imported: importing it would pull in
// the SVG imports, which only Vite resolves.
const scene = readFileSync(SCENE, 'utf8');

const declared = new Map();
for (const block of scene.matchAll(
  /(\w+):\s*\{\s*url:\s*(\w+),\s*box:\s*\{minX:\s*(-?[\d.]+),\s*minY:\s*(-?[\d.]+),\s*w:\s*(-?[\d.]+),\s*h:\s*(-?[\d.]+)\}/g,
)) {
  const [, id, urlBinding, minX, minY, w, h] = block;
  declared.set(id, {
    urlBinding,
    box: {minX: Number(minX), minY: Number(minY), w: Number(w), h: Number(h)},
  });
}

if (declared.size === 0) {
  console.error('check:equipment — found no EQUIPMENT entries in plantScene.ts. Has the table moved?');
  process.exit(1);
}

// Each entry's `url` binding is an import of the file, so the import line is what maps
// an id to a filename.
const fileOf = (binding) => {
  const match = new RegExp(`import ${binding} from '@/assets/equipment/([^']+)'`).exec(scene);
  return match === null ? undefined : match[1];
};

const problems = [];
const present = new Set(readdirSync(ASSETS));

for (const [id, {urlBinding, box}] of declared) {
  const file = fileOf(urlBinding);

  if (file === undefined) {
    problems.push(`${id}: no import found for binding \`${urlBinding}\``);
    continue;
  }
  if (!present.has(file)) {
    problems.push(`${id}: ${file} is not in src/assets/equipment/`);
    continue;
  }

  const measured = viewBoxOf(readFileSync(join(ASSETS, file), 'utf8'));
  if (measured === undefined) {
    problems.push(`${id}: ${file} declares no viewBox`);
    continue;
  }

  for (const key of ['minX', 'minY', 'w', 'h']) {
    // Exact, not approximate. These are the generator's own emitted numbers, not a
    // measurement with a tolerance, so a difference of any size is a real change.
    if (measured[key] !== box[key]) {
      problems.push(
        `${id} (${file}): ${key} is ${measured[key]} in the file, ${box[key]} in plantScene.ts`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('check:equipment — the scene places assets by boxes that no longer match:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nUpdate EQUIPMENT in src/modules/site/data/plantScene.ts to the measured values,',
  );
  console.error('then look at the scene: a changed origin moves where the object stands.');
  process.exit(1);
}

console.log(`check:equipment — ${declared.size} equipment boxes match their drawings.`);
