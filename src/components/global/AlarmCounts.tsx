import {BellIcon} from 'lucide-react';

import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';

/**
 * The alarm pill's contents: a bell, then `Critical · Warning · Neutral` — and a
 * filled cell behind any of the three that is standing.
 *
 * ## Why the fill, when the number already changed
 *
 * Because the number changing is the whole signal, and it is 12px wide. A count
 * going `0` → `1` is a one-glyph difference on a chip a reader is scanning past,
 * and on a page carrying three of these beside three run-state badges it is not a
 * difference the eye catches. The design's answer is to make the *cell* change,
 * not the digit: a solid block of the severity's own colour, which reads as a
 * shape before it reads as a number. A reader can tell a site has something wrong
 * without having parsed a single figure.
 *
 * A zero stays as it always was — coloured text on the bare pill — so a healthy
 * asset still shows three quiet zeros rather than three blocks.
 *
 * ## Why the cells are flush and the pill has no padding
 *
 * The fill has to reach the pill's edge, or it is a floating square inside a chip
 * rather than a segment of it. That is why `alarmPillClassName` strips the badge's
 * `px` and `gap` and why every cell is a fixed 20px stretched to full height: the
 * three of them tile the pill, the last one runs into the rounded end and gets
 * clipped by it, and the pill still reads as one object.
 *
 * Fixed 20px rather than content width so the three cells do not resize as counts
 * cross into double figures — a pill that changes width when an alarm clears would
 * shift everything beside it.
 *
 * ## Why `NEUTRAL` is `bg-fill` and not the design's literal
 *
 * The design fills the neutral cell with `text-primary` and writes on it in
 * `#FFFFFF`. That pair only works in light mode: `text-primary` is near-*white* in
 * dark mode, and white text on it is invisible. `bg-fill`/`text-fill-text` is this
 * app's themed name for exactly what the design drew — the inverted solid surface
 * and the text that sits on it — so the neutral cell stays black-on-light and
 * flips to white-on-dark instead of disappearing.
 */
export const AlarmCounts = ({counts}: {counts: Record<AlertSeverity, number>}) => (
  <>
    {/* Its own 20px cell rather than a bare icon, so the bell is measured on the
        same grid as the three counts and the row of them cannot drift. */}
    <span className="flex h-full w-5 shrink-0 items-center justify-center">
      {/* Sized here rather than by the badge's `[&>svg]:size-3`, which only reaches
          direct children and no longer applies now that the bell is boxed. */}
      <BellIcon className="size-3 text-secondary" aria-hidden="true" />
    </span>
    {ALERT_SEVERITIES.map((severity) => (
      <span
        key={severity}
        className={`flex h-full w-5 shrink-0 items-center justify-center ${
          counts[severity] > 0
            ? SEVERITY_META[severity].standingClassName
            : SEVERITY_META[severity].textClassName
        }`}
      >
        {counts[severity]}
      </span>
    ))}
  </>
);

/**
 * What a `Badge` has to give up to hold `AlarmCounts` — the padding and the gap
 * the cells tile over, plus the explicit height the badge normally gets from its
 * own `py`.
 *
 * `h-6` keeps the pill on the badge scale (see `badge.tsx`), so it still lines up
 * with the run-state and condition chips it sits beside. The design draws the
 * component at 20px in isolation, where there is nothing to line up with.
 *
 * `border-0` because the badge's own `border-transparent` is a 1px inset the fill
 * cannot cross: a full-height cell inside it stops 1px short of the pill's top and
 * bottom and leaves a pale hairline around the colour. The border is invisible on
 * this variant anyway, and `h-6` holds the height that would otherwise change.
 *
 * Exported as a class string rather than wrapped in a component because its two
 * callers need different badge *elements* — a plain span under a tooltip, and a
 * `Link` — and a component that took both shapes would be a worse seam than this.
 */
export const alarmPillClassName = 'h-6 gap-0 border-0 px-0 py-0';
