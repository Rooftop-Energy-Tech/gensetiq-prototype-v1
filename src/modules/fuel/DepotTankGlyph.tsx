import {useId} from 'react';

/**
 * The yard's bulk tank: a horizontal cylinder on saddles, filled to its level.
 *
 * ## Why not the genset tank glyph
 *
 * `TankGlyph` draws a machine's belly tank — an upright box of eight segments, which
 * is what a skid-mounted set carries and what a reader has learned to read on every
 * genset page. A depot is not that object. It is a horizontal vessel on saddles, and
 * drawing it as a tall box makes the page's one *place* look like a thirty-ninth
 * machine.
 *
 * ## Silhouette, not line art
 *
 * This was first drawn as an outline — a 4px round-capped stroke, a full capsule
 * radius, a rung ladder up the middle and two filler hooks on the crown — and every
 * one of those is a cartooning device on its own. Together they made the yard's tank
 * the most illustrated object in the app.
 *
 * So there is no stroke here at all: the vessel is a solid mass in the page's grey
 * and the diesel is a solid mass inside it, which is how the filled Lucide marks
 * elsewhere are built. Stroke weight is what makes line art look drawn, and a
 * silhouette has none to get wrong. The saddles are drawn *before* the shell so the
 * shell's own shape cuts their tops off, rather than being fitted to its curve.
 *
 * ## Continuous, not segmented
 *
 * The genset glyph steps in eighths because it is small and a smooth fill at 46px
 * reads as a smudge. This is drawn large and the level is the subject, so it fills
 * continuously: at 200,000 L a segment would be 25,000 L, and rounding the yard's
 * stock to the nearest quarter of a tanker is not a rounding anybody wants.
 *
 * The liquid is a plain rect clipped to the vessel's own outline, so the curve at
 * each end cuts it — which is what a horizontal cylinder actually does, and the
 * reason its middle holds far more per centimetre than its ends.
 */
export const DepotTankGlyph = ({
  fraction,
  className,
}: {
  /** `0`–`1`. Clamped, so a caller handing over 1.02 draws a full tank. */
  fraction: number;
  className?: string;
}) => {
  // Unique per instance: two of these on one page sharing a clip id would both take
  // whichever rendered last, and the second tank would draw the first one's level.
  const clipId = useId();
  const filled = Math.min(1, Math.max(0, fraction));

  // The vessel's own box, inside the viewBox. The fill is measured against these.
  const top = 28;
  const bottom = 104;
  const surface = bottom - (bottom - top) * filled;

  return (
    <svg
      viewBox="0 0 200 132"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={`Depot tank ${Math.round(filled * 100)}% full`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={12} y={top} width={176} height={bottom - top} rx={20} />
        </clipPath>
      </defs>

      {/* Saddles and the base, under the shell so it overlaps them. */}
      <g className="text-tertiary/55">
        <rect x={40} y={96} width={9} height={20} rx={2} />
        <rect x={151} y={96} width={9} height={20} rx={2} />
        <rect x={26} y={114} width={148} height={4} rx={2} />
      </g>

      {/* Two solid tones, as `TankGlyph` has: the reader sees a boundary between two
          materials rather than a shape with some paint in it. */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={12} y={top} width={176} height={bottom - top} className="text-tertiary/35" />
        <rect x={12} y={surface} width={176} height={bottom - surface} className="text-teal" />
      </g>
    </svg>
  );
};
