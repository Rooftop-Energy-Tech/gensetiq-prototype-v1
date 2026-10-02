import type maplibregl from 'maplibre-gl';

/** One ping, as the badges' `run-ping` keyframes run it: 1s, done by 75%. */
const PING_MS = 1000;

/** The ring image's side in CSS pixels — room for a ring at twice a 9px pin. */
const PING_SIZE = 48;

/**
 * The ring under every live pin — a running genset, a deployed job — the map's form
 * of `RunningPulse`. Drawn for a 9px pin; a layer scales it to others with
 * `icon-size`.
 *
 * An animated style image rather than a paint property set each frame: rewriting
 * `circle-radius` 60 times a second makes MapLibre re-evaluate the style every
 * frame, which stuttered the whole page. Here one small canvas is redrawn per frame
 * and the GPU places it under each pin. Bubbles do not ping: a zoomed-out map would
 * be a wall of motion.
 *
 * Under `prefers-reduced-motion` the image is drawn once, empty, and never moves.
 */
export const pingImage = (map: maplibregl.Map, color: string): maplibregl.StyleImageInterface => {
  const ratio = window.devicePixelRatio || 1;
  const size = Math.round(PING_SIZE * ratio);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let context: CanvasRenderingContext2D | null = null;
  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    onAdd() {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      context = canvas.getContext('2d', {willReadFrequently: true});
    },
    render() {
      if (context === null) return false;
      const phase = still ? 1 : Math.min((performance.now() % PING_MS) / PING_MS / 0.75, 1);
      // The badges' ease-out, grow and fade together.
      const eased = 1 - (1 - phase) ** 3;
      context.clearRect(0, 0, size, size);
      context.beginPath();
      context.arc(size / 2, size / 2, 9 * ratio * (1 + eased), 0, Math.PI * 2);
      context.fillStyle = color;
      context.globalAlpha = 0.6 * (1 - eased);
      context.fill();
      this.data = context.getImageData(0, 0, size, size).data as unknown as Uint8Array;
      if (!still) map.triggerRepaint();
      return true;
    },
  };
};
