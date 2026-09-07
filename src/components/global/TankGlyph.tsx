import {cn} from '@/lib/utils';

/**
 * The little segmented tank the design draws beside a level.
 *
 * Stacked bars filling from the bottom, which quantises the level to eighths —
 * and that is the point rather than a limitation. Next to it sits the exact
 * figure ("1,763 L | 72%", "61 %"); the glyph's job is the at-a-glance read, and
 * a continuous column would invite the eye to measure it and disagree with the
 * number by a percent.
 *
 * The topmost filled segment is one step lighter — a meniscus. It comes straight
 * from the design and it earns its place: it marks *where* the level is, which a
 * flat column of one colour leaves you counting bars to find.
 *
 * ## Why it is not `FuelTank` any more
 *
 * It was, and it lived in the genset module, because a tank of diesel was the only
 * level the app drew. The battery page's Figma frame then specified **the same
 * glyph at the same 46 × 60 with the same eight bars**, in blue — so the choice was
 * a second copy of thirty lines or one component with a tone. A copy would have
 * been the third time this shape was maintained by hand (see `DetailBand`), and the
 * two would have drifted the moment either design moved a radius.
 *
 * `tone` rather than a pair of class names, because the token pair is not a caller's
 * choice to make: `fuel`/`fuel-tip` and `battery`/`battery-tip` are two halves of one
 * scale each, and a caller free to mix them could draw a violet tank with a blue
 * meniscus. The rule the whole app follows is that a mark is coloured by *what it
 * measures*, and this enumerates the things that can be measured.
 */
const TONES = {
  fuel: {fill: 'bg-fuel', tip: 'bg-fuel-tip'},
  battery: {fill: 'bg-battery', tip: 'bg-battery-tip'},
} as const;

/**
 * Two sizes, and the same argument `TickGauge` makes for having exactly two.
 *
 * `lg` is the design's: 46 × 60 with eight bars, the tank beside a genset's fuel
 * figures and the battery beside a bank's charge. `sm` is the module tile's, where
 * the same glyph is repeated once per module in a bank and has to survive at a
 * third of the area.
 *
 * `sm` drops to six segments rather than shrinking eight. Eight 3px bars inside a
 * 30px column would put the gaps below a device pixel at any non-integer zoom, and
 * a glyph whose bars merge is a solid block — which is the one thing this shape
 * must not become. Six at 5px hold their separation, and the tile prints the exact
 * percentage underneath in any case.
 *
 * The paddings are the design's `px-[5px] py-1.5` scaled to keep the bar column an
 * exact multiple of the bar height: 60 − 12 = 48 = 8 × 6, and 38 − 8 = 30 = 6 × 5.
 * That is what makes `justify-between` produce a flush stack rather than a column
 * with a stray half-pixel gap at one end.
 */
const SIZES = {
  lg: {
    segments: 8,
    box: 'h-15 w-[46px] rounded-md px-[5px] py-1.5',
    bar: 'h-1.5 rounded-[3px]',
  },
  sm: {
    segments: 6,
    box: 'h-[38px] w-[26px] rounded-[5px] px-[3px] py-1',
    bar: 'h-[5px] rounded-[2.5px]',
  },
} as const;

export const TankGlyph = ({
  fraction,
  tone,
  size = 'lg',
  label,
}: {
  /** `0`–`1`. Clamped, so a caller that hands over 1.02 draws a full tank. */
  fraction: number;
  tone: keyof typeof TONES;
  size?: keyof typeof SIZES;
  /**
   * What a screen reader should call it, or nothing.
   *
   * Nothing is the common case and the right default: wherever this glyph sits
   * beside its own figure — the fuel panel, the battery hero — the number is real
   * text and the glyph is a second rendering of it, so announcing both reads the
   * level twice. The module tiles pass one, because there the glyph is the only
   * thing carrying its module's identity above a bare percentage.
   */
  label?: string;
}) => {
  const scale = SIZES[size];
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * scale.segments);

  return (
    <div
      className={cn('flex flex-col-reverse justify-between overflow-hidden', scale.box)}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined || undefined}
    >
      {Array.from({length: scale.segments}, (_, index) => (
        <div
          key={index}
          className={cn(
            'w-full',
            scale.bar,
            index < filled ? TONES[tone].fill : 'bg-tertiary',
            // `index + 1 === filled` is the surface — of the diesel, or of the charge.
            index + 1 === filled && TONES[tone].tip,
          )}
        />
      ))}
    </div>
  );
};
