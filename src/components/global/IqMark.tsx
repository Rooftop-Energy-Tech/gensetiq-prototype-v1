/**
 * The GensetIQ mark, inline rather than an `<img src={…svg}>`.
 *
 * It used to be `assets/iq-mark.svg`, whose two off-white paths were baked at
 * `#F0F2F5` — the *dark* value of `text-sidebar-strong`. An external `<img>`
 * can't be restyled from CSS, so on a light sidebar the mark went near-invisible
 * and only the teal chevron survived. Inlining it lets the wordmark strokes take
 * `currentColor` and follow the token like every other glyph in the rail.
 *
 * The chevron stays on `--brand` because GensetIQ's teal is deliberately
 * mode-invariant (see the `brand` token's `divergent` note in `colors.ts`), and
 * it is the one mark on screen that must not shift with the theme.
 *
 * Geometry is byte-identical to the export; only the two `fill` attributes moved.
 */
export const IqMark = ({className}: {className?: string}) => (
  <svg
    width="36.5"
    height="27.2"
    viewBox="0 0 37.0011 27.1941"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="GensetIQ"
    className={className}
  >
    <path d="M0 0H5.86548V25.6407H0V0Z" fill="currentColor" />
    <path
      d="M22.4847 16.691L26.6323 12.6619L37.0011 22.7345L32.8535 26.7636L22.4847 16.691Z"
      fill="var(--brand)"
    />
    <path
      d="M35.6808 12.8204C35.6808 10.2847 34.9068 7.80605 33.4567 5.69775C32.0065 3.58946 29.9454 1.94624 27.5339 0.975897C25.1224 0.00555485 22.4689 -0.248331 19.9088 0.246345C17.3488 0.741022 14.9973 1.96204 13.1516 3.755C11.3059 5.54796 10.049 7.83233 9.53976 10.3192C9.03054 12.8061 9.29189 15.3839 10.2908 17.7265C11.2896 20.0691 12.9812 22.0714 15.1515 23.4801C17.3218 24.8888 19.8733 25.6407 22.4835 25.6407V19.8716C21.0479 19.8716 19.6445 19.458 18.4509 18.6832C17.2572 17.9084 16.3269 16.8072 15.7775 15.5187C15.2281 14.2303 15.0844 12.8125 15.3644 11.4447C15.6445 10.0769 16.3358 8.82054 17.351 7.83442C18.3661 6.84829 19.6594 6.17673 21.0674 5.90465C22.4755 5.63258 23.9349 5.77222 25.2612 6.30591C26.5875 6.8396 27.7212 7.74337 28.5187 8.90293C29.3163 10.0625 29.742 11.4258 29.742 12.8204H35.6808Z"
      fill="currentColor"
    />
  </svg>
);
