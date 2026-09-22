import type {SVGProps} from 'react';

/**
 * An oil can with a drip — the mark the reference controller UI uses for oil
 * pressure, drawn here because Lucide has no equivalent.
 *
 * Every other reading on this band takes a Lucide glyph, and one hand-drawn SVG in
 * that company has to match them or it reads as a pasted-in asset: 24×24 viewBox,
 * 2px strokes, round caps and joins, `currentColor` throughout, no fills. Those are
 * Lucide's own construction rules, so this sits on the same optical weight as the
 * thermometer beside it.
 *
 * A droplet stood here until 2026-09-22 and was the wrong mark twice over — it is
 * what the fuel rows use, so oil and diesel shared a glyph, and a drop says
 * *lubricant* where the reading is *pressure*. The can says which system.
 */
export const OilCanIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* The body: a squat reservoir sitting on a base. */}
    <path d="M3 17v-4a2 2 0 0 1 2-2h6v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    {/* The spout, rising from the shoulder and reaching right. */}
    <path d="M11 12.5 16 9l5 2" />
    {/* The handle over the top. */}
    <path d="M5 11V9a2 2 0 0 1 2-2h2" />
    {/* The drip, falling clear of the spout's tip. */}
    <path d="M20.5 14.5a1.5 1.5 0 1 1-3 0c0-1 1.5-2.5 1.5-2.5s1.5 1.5 1.5 2.5Z" />
  </svg>
);
