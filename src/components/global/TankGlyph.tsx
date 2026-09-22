import {cn} from '@/lib/utils';

/**
 * The little segmented tank the design draws beside a level of **diesel**.
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
 * ## Why it is not `FuelTank` any more, and is nearly one again
 *
 * It was, and it lived in the genset module, because a tank of diesel was the only
 * level the app drew. The battery page's Figma frame then specified **the same glyph
 * at the same 46 × 60 with the same eight bars**, in blue — so the choice was a second
 * copy of thirty lines or one component with a tone, and a copy would have been the
 * third time this shape was maintained by hand (see `DetailBand`).
 *
 * That is over: storage moved to `BatteryGlyph`, a horizontal battery with a
 * continuous bar, because a later mock changed the *shape* rather than the colour.
 * Both of this component's arguments are diesel arguments and neither survived the
 * move — a vertical column looks like a tank of liquid, and eighths stop a reader
 * squinting at the glyph and disagreeing with the litres beside it.
 *
 * So the `battery` tone is gone, deliberately rather than left as a spare: a caller
 * that could still ask for it would get the old shape on a page that has replaced it,
 * which is the drift this file's own note warns about. What is left is a one-member
 * enum, and `tone` stays a prop for the reason it was one — the token pair is not a
 * caller's choice to make, `fuel`/`fuel-tip` being two halves of one scale, and the
 * rule the whole app follows is that a mark is coloured by *what it measures*. The
 * next level anybody draws lands here as a second member.
 */
const TONES = {
  fuel: {fill: 'bg-fuel', tip: 'bg-fuel-tip'},
  // The teal every bar on the genset page's output card is drawn in. Added
  // 2026-09-22 — Afifah's call — so the tank beside them fills in the same colour
  // as the lines it shares a band with.
  //
  // ⚠️ It crosses the rule the note above states: hue says *what kind of job it is*,
  // violet for diesel and teal for the electrical side, so a tank drawn teal is a
  // fuel figure wearing the electrical colour. The tank on `/fuel`, the droplets on
  // the fleet cards and the fuel badges are all still violet, so the same machine's
  // level is now two colours on two screens. Worth settling in one direction.
  teal: {fill: 'bg-teal', tip: 'bg-teal/70'},
} as const;

/**
 * Four sizes, and the same argument `TickGauge` makes for having a fixed few.
 *
 * `lg` is the design's: 46 × 60 with eight bars, the tank beside a genset's fuel
 * figures. `sm` was the battery module tile's and now has no caller — it is kept
 * because it is the same measured geometry as `lg` and the argument below is the
 * record of how it was arrived at, not because anything draws it today.
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
  // `2xl` is the fuel card once the band became three cards of equal height: the
  // card stretches to the tallest of the three, and a 46px tank in a card that deep
  // sat in its own corner. 98 × 128 holds `lg`'s proportions to within a percent
  // (0.766 against 0.767), so it is still the same object drawn larger, and the bar
  // column still divides: 128 − 16 = 112, which is 8 × 14.
  '2xl': {
    segments: 8,
    box: 'h-32 w-[98px] rounded-xl px-3 py-2',
    bar: 'h-3.5 rounded-[7px]',
  },
  // `xl` is the genset page's fuel column, where the tank is the one mark a reader
  // takes in without reading and the three figures beside it are what they read
  // second. 72 × 96 keeps `lg`'s proportions almost exactly (46/60 against 72/96,
  // within a percent) so it is the same object drawn larger rather than a second
  // shape, and it holds eight segments because the geometry works: 96 − 16 = 80,
  // which is 8 × 10.
  xl: {
    segments: 8,
    box: 'h-24 w-[72px] rounded-lg px-2 py-2',
    bar: 'h-2.5 rounded-[5px]',
  },
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
