import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
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
 * It **was** exported, on the grounds that "its two callers need different badge
 * *elements* — a plain span under a tooltip, and a `Link` — and a component that took
 * both shapes would be a worse seam than this". That stopped being true when the strip
 * became a link too (2026-09-09): both callers want the same element now, so the
 * element is `AlarmBadge` below and this is private to it.
 */
const alarmPillClassName = 'h-6 gap-0 border-0 px-0 py-0';

/**
 * `Critical 2 · Warning 0 · Neutral 0` — the pill's numbers as a sentence.
 *
 * Both pills carry it as their `title` **and** their accessible name, so the three
 * figures announce as words rather than as `2 0 0`, and a reader who has not met the
 * severity order yet can hover it. One function because the two pills must not spell
 * the same fact two ways.
 */
const alarmLegend = (counts: Record<AlertSeverity, number>) =>
  ALERT_SEVERITIES.map((severity) => `${SEVERITY_META[severity].label} ${counts[severity]}`).join(
    ' · ',
  );

/**
 * The alarm pill as **the way through to the rows themselves** — the one linked
 * alarm count in the app.
 *
 * ## One element, everywhere a count is drawn
 *
 * It began on the genset card of the site's device panel, and the array's card and the
 * bank's did not have it — so the panel said different things depending on which box a
 * reader had clicked: a set with two criticals showed them, an array with two showed
 * nothing and read as an array with nothing wrong. It became a component for that
 * reason, and it is in `global/` for the same reason one step out: the **page strips**
 * had the count as a dead figure under a tooltip while the panel a few hundred pixels
 * below had it as a link (Jeff, 2026-09-09). Two renderings of one pill, one of which
 * answered the question and one of which did not.
 *
 * Every count in the app is now this element: the five `MetricStrip` headers — site,
 * solar, battery, cabinet, genset — and the three device cards on the site panel.
 *
 * ## Three numbers, coloured rather than labelled
 *
 * `Critical · Warning · Neutral`, in that order and in their own colours, with any
 * severity that has something standing filling its cell rather than only changing its
 * digit. `AlarmCounts` above is that pill's contents and the argument for the fill.
 *
 * ## Why it is a link and has no tooltip
 *
 * A count is a question — *which two?* — and neither a strip nor a panel can answer it:
 * there is no room for a queue in a header column or beside a drawing. So the pill goes
 * to the tab that can, and the reading is one click rather than a nav and a tab.
 *
 * That costs the Radix tooltip the strip used to carry, because a target that is both
 * clickable and hovered is fussy — the pointer lands on it and two things happen. **The
 * legend is not lost**, which matters more here than it did on the panel: the strip's
 * tooltip was the one place in the app that spelled the severity order out, and the
 * panel's own note leaned on it — "a reader meeting the pattern here has been taught it
 * a few hundred pixels above". It is now the `title`, which browsers show on hover and
 * which is also the accessible name, so the numbers announce as
 * `Critical 2 · Warning 0 · Neutral 0` rather than as `2 0 0`.
 *
 * `to`, `params` and `search` are the caller's, because five assets have five routes.
 */
export const AlarmBadge = ({
  counts,
  to,
  params,
  search,
}: {
  counts: Record<AlertSeverity, number>;
  to: LinkProps['to'];
  params?: LinkProps['params'];
  /**
   * Carries `from` through, so a pill clicked on an asset opened from a site crumbs
   * back to that site rather than springing to the asset's register. The strips pass
   * `keepFrom`; the site panel passes `fromSite`. See `fromSearch.type.ts`.
   */
  search?: LinkProps['search'];
}) => {
  const legend = alarmLegend(counts);

  return (
    <Badge
      asChild
      variant="secondary"
      className={cn(alarmPillClassName, 'transition-colors hover:bg-highlight')}
    >
      <Link
        to={to}
        params={params}
        search={search}
        aria-label={legend}
        title={legend}
        className="outline-none focus-visible:ring-2 focus-visible:ring-outline"
      >
        <AlarmCounts counts={counts} />
      </Link>
    </Badge>
  );
};

/**
 * The same pill, going nowhere — for the one place a link cannot be put.
 *
 * `AlarmBadge` above is the rule: every count in this app is clickable, because a
 * count is the question *which ones*, and a pill that names alarms and cannot be
 * opened is the one alarm in the app you cannot read. This is the exception, and it
 * is a markup exception rather than a design one: the sites screen's phone card is
 * itself a `<Link>` into the site, and an anchor inside an anchor is invalid — the
 * browser closes the outer one, and the rest of the card stops navigating.
 *
 * Nothing is lost by it. The card leads to the site, the site's strip carries the
 * same three figures as `AlarmBadge`, and that pill opens the queue. The reading is
 * one tap further away on the surface that has no room for the queue anyway.
 *
 * Use it only where an enclosing element already owns the click. Anywhere else the
 * badge is the element.
 */
export const StaticAlarmBadge = ({counts}: {counts: Record<AlertSeverity, number>}) => {
  const legend = alarmLegend(counts);

  return (
    <Badge variant="secondary" className={alarmPillClassName} aria-label={legend} title={legend}>
      <AlarmCounts counts={counts} />
    </Badge>
  );
};
