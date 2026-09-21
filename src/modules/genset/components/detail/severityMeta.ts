import {ActivityIcon, CircleCheckIcon, CircleXIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {lightToken} from '@/styles/colors';
import type {AlertSeverity, GensetCondition} from '../../types/alert.type';

/**
 * How each severity is written and coloured.
 *
 * Unlike `runStateMeta.ts` — where the badge surface stays neutral and only the
 * glyph carries colour — severity colours the glyph *and* the text. Run state is
 * one of four mutually exclusive values a reader can learn once; severity is a
 * ranking, and a chip row mixing all three has to make the ordering visible
 * without being read left to right.
 *
 * `NEUTRAL` deliberately has no colour of its own. It is `text-primary`, the
 * same value the design exports on its neutral bell, because a neutral alert is
 * a note rather than a problem and giving it a hue would put it on the same
 * footing as the two that are.
 */
export const SEVERITY_META: Record<
  AlertSeverity,
  {
    label: string;
    textClassName: string;
    /**
     * The severity as a *surface* rather than as ink — background and the text
     * that sits on it — for the alarm pill's filled cell (`AlarmCounts`).
     *
     * Here rather than in the pill because it is the same colour as
     * `textClassName` and this file exists so those cannot be picked twice.
     * Named for the state it marks: a severity with alarms standing.
     */
    standingClassName: string;
    /**
     * The **edge** of a card or bay marked by a standing row of this severity, and
     * the surface behind it. A pair rather than two fields, because they are only
     * ever applied together and picking one without the other is the bug.
     *
     * ## Both take the hue, because a part is marked in one colour
     *
     * Three drawings mark a part from a row: the cabinet's shelf bays, its fallback
     * card grid, and the battery's module rack. All three used flat amber, and every
     * row any of them can assert is `CRITICAL` — so a critical fault was drawn in the
     * warning colour on three pages while the row itself was ranked red one tab
     * across.
     *
     * The edge moved to the row's severity first and the tint was left amber, on the
     * argument that the two answer different questions: the edge *how bad* and the
     * fill *something is asserted here*. Seen on the page that is a distinction
     * without a reader — a red-edged card with an amber middle looks like two marks
     * overlapping rather than one part flagged once, and the eye reads the larger area
     * first, so the amber was quietly outvoting the edge it was supposed to support.
     * Both now come from the same severity at the same opacities.
     *
     * `NEUTRAL` has no hue of its own here on purpose — a neutral alert is a note
     * rather than a problem — so it takes the achromatic version of the same pair: the
     * emphasis border, and `fill` at the weight the design uses for its own subtle
     * overlays. `fill` is the **inverted solid surface**, black on light and white on
     * dark, so 8% of it is a grey shade in both themes rather than a grey that goes
     * invisible in one of them. Not `bg-highlight`, which is documented as an overlay
     * to layer rather than a background to set.
     *
     * A marked part therefore always has an edge and a shade, at every severity, and
     * what varies is only whether they carry a hue. That is what lets the badge beside
     * them carry the severity **in words** — `Critical`, `Warning`, `Neutral` — without
     * a neutral row's card being left with no mark on it at all.
     */
    edgeClassName: string;
    tintClassName: string;
    strokeClassName: string;
    fillClassName: string;
  }
> = {
  CRITICAL: {
    label: 'Critical',
    textClassName: 'text-severity-critical',
    standingClassName: 'bg-severity-critical text-white',
    edgeClassName: 'border-severity-critical/60',
    tintClassName: 'bg-severity-critical/10',
    // The SVG pair, for the analysis chart's threshold lines. Tailwind resolves
    // `stroke-*` and `fill-*` from the same token as `text-*`, so an alarm line
    // and its caption cannot end up different shades of the same red.
    strokeClassName: 'stroke-severity-critical',
    fillClassName: 'fill-severity-critical',
  },
  WARNING: {
    label: 'Warning',
    textClassName: 'text-severity-warning',
    standingClassName: 'bg-severity-warning text-white',
    edgeClassName: 'border-severity-warning/60',
    tintClassName: 'bg-severity-warning/10',
    strokeClassName: 'stroke-severity-warning',
    fillClassName: 'fill-severity-warning',
  },
  NEUTRAL: {
    label: 'Neutral',
    textClassName: 'text-primary',
    // `bg-fill`, not `bg-primary`: the design fills this cell with the text
    // colour and writes on it in white, which inverts to white-on-white in dark
    // mode. `fill`/`fill-text` is the token pair for the inverted solid surface,
    // so the cell stays legible in both. See the note in `AlarmCounts.tsx`.
    standingClassName: 'bg-fill text-fill-text',
    // `border-strong` rather than a translucent `border-primary`, which is not a
    // token: the design expresses emphasis on an edge with the border scale, and this
    // is the top of it. `bg-fill/8` is the neutral answer to the other two's
    // `bg-severity-*/10` — see the note on the pair above.
    edgeClassName: 'border-strong',
    tintClassName: 'bg-fill/8',
    strokeClassName: 'stroke-primary',
    fillClassName: 'fill-primary',
  },
};

/**
 * The verdict above the alerts section, and the glyph that carries it.
 *
 * `OPTIMUM` gets a tick rather than the design's activity trace: the trace is the
 * section's icon in every state, so using it for the verdict too means the one
 * element that is supposed to change with the machine's health is the one that
 * looks the same whatever it says.
 *
 * `mapColor` is the same colour as a literal, for the sites map's pins — MapLibre
 * evaluates paint properties in a shader, where a CSS variable means nothing. It
 * lives here rather than in the site module for the reason `RUN_STATE_META`
 * carries the fleet map's: the pin and the badge are two readings of one verdict,
 * and a second copy of the colour is how they end up disagreeing.
 */
export const CONDITION_META: Record<
  GensetCondition,
  {label: string; icon: LucideIcon; textClassName: string; mapColor: string}
> = {
  OPTIMUM: {
    label: 'Optimum',
    icon: CircleCheckIcon,
    textClassName: 'text-severity-ok',
    mapColor: lightToken['severity-ok'],
  },
  ATTENTION: {
    label: 'Attention',
    icon: ActivityIcon,
    textClassName: 'text-severity-warning',
    mapColor: lightToken['severity-warning'],
  },
  CRITICAL: {
    label: 'Critical',
    icon: CircleXIcon,
    textClassName: 'text-severity-critical',
    mapColor: lightToken['severity-critical'],
  },
};
