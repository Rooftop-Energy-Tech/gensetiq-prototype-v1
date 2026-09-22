import {useId} from 'react';

/**
 * The yard's bulk tank: a horizontal cylinder on saddles, filled to its level.
 *
 * ## Why not the genset tank glyph
 *
 * `TankGlyph` draws a machine's belly tank — an upright box of eight segments, which
 * is what a skid-mounted set carries and what a reader has learned to read on every
 * genset page. A depot is not that object. It is a horizontal pressure vessel on
 * legs with a ladder up the middle, and drawing it as a tall box makes the page's
 * one *place* look like a thirty-ninth machine.
 *
 * ## Continuous, not segmented
 *
 * The genset glyph steps in eighths because it is small and a smooth fill at 46px
 * reads as a smudge. This is drawn large and the level is the subject, so it fills
 * continuously: at 200,000 L a segment would be 25,000 L, and rounding the yard's
 * stock to the nearest quarter of a tanker is not a rounding anybody wants.
 *
 * ## Construction
 *
 * Line art in `currentColor` at a single stroke weight, so it sits beside the Lucide
 * marks elsewhere without looking like a pasted-in asset. The fill is a plain rect
 * clipped to the vessel's own outline — the liquid is flat and the curve at each end
 * cuts it, which is what a horizontal cylinder actually does and the reason its
 * middle holds far more per centimetre than its ends.
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
  const top = 26;
  const bottom = 104;
  const height = bottom - top;
  const surface = bottom - height * filled;

  return (
    <svg
      viewBox="0 0 200 132"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={`Depot tank ${Math.round(filled * 100)}% full`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={14} y={top} width={172} height={height} rx={34} />
        </clipPath>
      </defs>

      {/* ## Two solid tones, as `TankGlyph` has
          The genset tank fills its segments in teal and leaves the rest in
          `tertiary` — a solid colour either way, so the reader sees a boundary
          between two materials rather than a shape with some paint in it. This drew
          its empty half as bare card, which read as an outline drawing that happened
          to have liquid in the bottom. */}
      <rect
        x={14}
        y={top}
        width={172}
        height={height}
        clipPath={`url(#${clipId})`}
        fill="currentColor"
        stroke="none"
        className="text-tertiary/45"
      />

      {/* The diesel over it. Both are drawn before every line of the vessel, so the
          outline and the seams sit on top of whichever tone they cross. */}
      <rect
        x={14}
        y={surface}
        width={172}
        height={bottom - surface}
        clipPath={`url(#${clipId})`}
        fill="currentColor"
        stroke="none"
        className="text-teal"
      />

      {/* Saddles and the base the vessel stands on. */}
      <path d="M40 104v14M60 104v14M140 104v14M160 104v14" />
      <path d="M24 118h152" />

      {/* The vessel, and the two seams that divide its ends from its barrel. */}
      <rect x={14} y={top} width={172} height={height} rx={34} />
      <path d="M72 26v78M128 26v78" />

      {/* The ladder up the middle, which is what makes it read as a yard tank
          rather than a capsule. */}
      <path d="M86 26v78M114 26v78" />
      <path d="M86 45h28M86 62h28M86 79h28M86 96h28" />

      {/* The two fill points on the crown. */}
      <path d="M44 26v-8a6 6 0 0 1 12 0v8M148 26v-8a6 6 0 0 1 12 0v8" />
    </svg>
  );
};
