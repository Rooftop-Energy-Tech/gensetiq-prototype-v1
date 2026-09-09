import {cn} from '@/lib/utils';

/**
 * The battery the design draws beside a state of charge: an outline, a bar that
 * scales, and a terminal nub.
 *
 * From Jeff's mock of the bank page's hero (2026-09-09). It is now the only battery in
 * the app, and there were three: `TankGlyph`'s blue vertical tank on the bank page and
 * its module cards, a hand-rolled SVG in `SiteTelemetry`'s `State of charge` frame, and
 * nothing at all on the site panel's battery card.
 *
 * The `SiteTelemetry` one is worth naming because it is how this kind of thing happens.
 * It arrived on another branch and drew the same horizontal battery from the same mock —
 * correctly — but separately, so it had no charging bolt and no low-charge colours, and
 * the site page ended up showing two batteries at the same percentage in the same state
 * where one had a bolt and one did not. Its measurements survive as the `xl` size.
 *
 * ## Why this is its own component and not a third `TankGlyph` tone
 *
 * Because it is a different shape, not a different colour. `TankGlyph` is a
 * **vertical** column of stacked bars filling from the bottom, and that shape is an
 * argument: it looks like a tank of liquid, and it quantises the level to eighths so
 * that a reader cannot squint at it and disagree with the figure printed beside it.
 * Both halves of that are right for diesel and neither survives here — this is a
 * horizontal battery with a continuous fill, which is the shape everybody already
 * reads as a battery.
 *
 * So the diesel tank keeps `TankGlyph` unchanged and storage gets this. That is two
 * components where there was one, and it is the right two: `TankGlyph`'s own note
 * argued against a *copy*, on the grounds that "the two would have drifted the moment
 * either design moved a radius". A copy is what you make when the shape is the same.
 *
 * ## Why the fill is continuous, against `TankGlyph`'s argument
 *
 * `TankGlyph` deliberately refuses this: "a continuous column would invite the eye to
 * measure it and disagree with the number by a percent." That is a real cost and it is
 * paid here, because the instruction was that the bar scale with the percentage and
 * because a segmented battery reads as a battery *icon* rather than as a battery. The
 * exact figure sits beside it in both places it is drawn, which is what makes the cost
 * affordable.
 */

/**
 * Where the fill stops being blue. **Both numbers are invented, and only for this
 * glyph.**
 *
 * That has to be said plainly, because this app has a rule about it. `BankAlarms`
 * records that the monitoring unit's poll table supplies **no state-of-charge
 * threshold at all** — half a dozen `0x5520`-block registers would, and they were
 * deliberately left out of the poll set because nobody can yet say whether their
 * index counts modules or distribution branches. Its conclusion was that "adding a
 * critical alarm under a possibly-wrong label is the worst outcome available".
 *
 * Nothing here is an alarm, which is what makes this allowable where a row would not
 * be: a colour on a glyph is a cue beside a figure a reader can check, and it raises
 * nothing, files nothing and appears in no queue. These constants must therefore stay
 * in this file — the moment a threshold like this reaches `plantAlarms.ts` it has
 * become the claim that file refuses to make.
 *
 * ## What each one fires on
 *
 * Measured over the estate at eight hours of one day rather than guessed. Pack charge
 * runs 39.8–76.6% and module charge 33.9–79.7%, because `hybridState` floors a bank
 * around a third full and never discharges it flat.
 *
 * - **`LOW_CHARGE` at 40%** fires: one pack and twenty-two module cards across that
 *   sweep. Rare, which is what a warning should be.
 * - **`CRITICAL_CHARGE` at 30%** does not fire on today's estate. It is kept at a
 *   figure that means something about a battery rather than moved up to wherever the
 *   mock's floor happens to sit — a threshold tuned until it lights up is a threshold
 *   describing the model instead of the hardware. A real bank reaches 30%; this
 *   dataset does not model one that does.
 */
const LOW_CHARGE = 0.4;
const CRITICAL_CHARGE = 0.3;

/**
 * The state's four surfaces, and they are one hue each rather than a mix.
 *
 * The outline and the nub are the fill at 60%, which is the same relationship
 * `SEVERITY_META` draws between a marked part's edge and its fill, and it means a
 * state cannot end up with a blue outline round an amber bar. The mock's outline is
 * the lighter `battery-tip`; 60% of the base lands in the same place and extends to
 * the two severity hues, which have no tip token and should not gain one for this.
 *
 * `stroke` is the bolt's outline — see `Bolt`.
 */
const CHARGE_STATES = {
  OK: {
    fill: 'bg-battery',
    edge: 'border-battery/60',
    nub: 'bg-battery/60',
    stroke: 'stroke-battery',
  },
  LOW: {
    fill: 'bg-severity-warning',
    edge: 'border-severity-warning/60',
    nub: 'bg-severity-warning/60',
    stroke: 'stroke-severity-warning',
  },
  CRITICAL: {
    fill: 'bg-severity-critical',
    edge: 'border-severity-critical/60',
    nub: 'bg-severity-critical/60',
    stroke: 'stroke-severity-critical',
  },
} as const;

const chargeState = (fraction: number): keyof typeof CHARGE_STATES =>
  fraction < CRITICAL_CHARGE ? 'CRITICAL' : fraction < LOW_CHARGE ? 'LOW' : 'OK';

/**
 * Three sizes, one per place a battery is drawn at.
 *
 * `xl` is the site page's telemetry frame, where the battery is the frame's subject.
 * `lg` is the pack's, beside the hero figure and on the site panel's battery card.
 * `sm` is the module card's, repeated once per module in a rack of up to eighteen.
 *
 * `track` is the recessed interior. `bg-inset` rather than the mock's white, which is
 * a light-mode colour rather than a token: the design's own recessed tier is one step
 * from `element` in whichever direction the theme runs, so an empty battery reads as
 * a channel on both grounds instead of vanishing into the card on one of them.
 */
const SIZES = {
  /**
   * The telemetry frame's, and the only one that is a *hero* rather than a mark
   * beside a figure.
   *
   * Its measurements come from the hand-rolled SVG this replaced in
   * `SiteTelemetry` — 104 × 44 overall — so consolidating the two drawings onto
   * one component changed nothing a reader can see except that the bolt and the
   * charge colours arrived.
   */
  xl: {
    body: 'h-11 w-[92px] rounded-lg border-2 p-1',
    nub: 'h-4 w-2 rounded-r-sm',
    gap: 'gap-[3px]',
    bar: 'rounded-[4px]',
    bolt: 'size-6',
  },
  lg: {
    body: 'h-8 w-[60px] rounded-md border-2 p-[3px]',
    nub: 'h-3 w-1 rounded-r-sm',
    gap: 'gap-[2px]',
    bar: 'rounded-[3px]',
    // 16px inside a 28px padding box. 13px read as a speck at the real size rather
    // than at the 3x everything gets checked at.
    bolt: 'size-4',
  },
  /**
   * The module card's, repeated once per module in a rack of up to eighteen.
   *
   * **44 × 22, up from 34 × 18, and the bolt is why.** At the smaller size a bolt
   * comes out 8px inside a 14px channel and is a speck rather than a glyph — which is
   * the reason this size originally had none. Growing the body 10px is what buys a
   * 14px bolt, and the card affords it easily: the glyph and its percentage come to
   * about 91px inside a 10rem card's 136px, so nothing else on the card moves.
   */
  sm: {
    body: 'h-[22px] w-11 rounded-md border p-[2px]',
    nub: 'h-[9px] w-[3px] rounded-r-[1.5px]',
    gap: 'gap-px',
    bar: 'rounded-[3px]',
    bolt: 'size-3.5',
  },
} as const;

/**
 * The charging bolt, and the whole difficulty is that it sits on two backgrounds.
 *
 * It is centred in the body, so at a low charge it lies on the empty track and at a
 * high one on the fill — and at most levels it straddles the boundary. A solid white
 * bolt reads on `bg-battery` and disappears on `bg-inset`; a solid coloured one does
 * the opposite. Neither works, and clipping the bolt to the filled part would hide it
 * exactly when the bank most needs watching.
 *
 * So it is **knocked out and outlined**: filled in the card's own `element` and
 * stroked in the state's colour. Over the bar the fill carries it; over the track the
 * outline does. One element, legible at every percentage and in both themes.
 *
 * Drawn at **every** size, which took a change to the smallest one. `sm` was 34 × 18
 * and had no bolt, because a bolt inside an 18px body is 8px and 8px of bolt with a 1px
 * outline is a smudge; the body is 44 × 22 now and the bolt is 14px, which reads. See
 * `SIZES.sm`.
 *
 * The other argument for leaving it off `sm` was that a module has no direction of its
 * own — every module in a rack charges when the pack does — so a rack draws thirteen
 * identical bolts. That is true and it is not a reason: the module cards exist to be
 * *little packs*, and a rack of batteries that all disagreed with the pack above them
 * about whether anything was charging is the shape breaking, not thirteen facts.
 */
const Bolt = ({stroke, box}: {stroke: string; box: string}) => (
  <svg
    viewBox="0 0 24 24"
    /* A **square** class rather than a height and an implied width. It was
       `h-[13px]` plus `aspect-ratio: 1/1`, and it drew nothing: an `<svg>` with a
       viewBox has an intrinsic *ratio* but no intrinsic *dimensions*, so `width:
       auto` on an absolutely positioned one is not reliably resolved from the
       height — the element came out with no width, was dutifully centred by
       `-translate-x-1/2`, and occupied nothing. Setting both removes the guess. */
    className={cn('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', box)}
    aria-hidden="true"
  >
    <path
      d="M13 2 L4 14 h6 l-1 8 9-12 h-6 z"
      className={cn('fill-element', stroke)}
      /* 2 units in a 24 viewBox drawn at 16px is about 1.3 device pixels. Enough to
         hold the shape where the bolt lies on the empty track and the outline is the
         only thing carrying it; below that the outline breaks up and the knock-out
         disappears into the channel. */
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export const BatteryGlyph = ({
  fraction,
  size = 'lg',
  charging = false,
  label,
}: {
  /** `0`–`1`. Clamped, so a caller that hands over 1.02 draws a full battery. */
  fraction: number;
  size?: keyof typeof SIZES;
  /** Whether the pack is taking charge — draws the bolt, at `lg` only. */
  charging?: boolean;
  /**
   * What a screen reader should call it, or nothing.
   *
   * `TankGlyph`'s rule exactly: nothing wherever the glyph sits beside its own figure
   * in real text, because announcing both reads the level twice. The module cards pass
   * one, because there the glyph is the only thing carrying its module's identity
   * above a bare percentage.
   */
  label?: string;
}) => {
  const scale = SIZES[size];
  const level = Math.min(1, Math.max(0, fraction));
  const state = CHARGE_STATES[chargeState(level)];

  return (
    <div
      className={cn('flex shrink-0 items-center', scale.gap)}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined || undefined}
    >
      <div className={cn('relative bg-inset', scale.body, state.edge)}>
        {/* The bar. A width in percent rather than a flex basis, so the one thing this
            glyph exists to do is a single number a reader can verify against the
            figure beside it — and `min-w-[2px]` so a nearly-flat pack is a sliver
            rather than nothing, which would read as a glyph that had failed to draw
            rather than as a battery with almost nothing in it. */}
        <div
          className={cn('h-full', scale.bar, state.fill)}
          style={{width: `${level * 100}%`, minWidth: level > 0 ? '2px' : undefined}}
        />

        {charging && <Bolt stroke={state.stroke} box={scale.bolt} />}
      </div>

      {/* The terminal, detached, as the mock draws it. Its own element rather than a
          pseudo-element so it takes the state's colour from the same object the
          outline does. */}
      <div className={cn(scale.nub, state.nub)} />
    </div>
  );
};
