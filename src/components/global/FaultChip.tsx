import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {BellIcon, TriangleAlertIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';

/*
 * **A faulted part's mark, both halves of it.** `FaultBadge` is the rank in the card's
 * top-right corner and `FaultChip` is the register on the line below — two exports in a
 * file named after one of them, which is `AlarmCounts.tsx`'s shape and kept for the same
 * reason: they are only ever drawn together, they read one `SEVERITY_META` between them,
 * and splitting them would put the argument for the pair in neither file.
 *
 * Both are used by `JunctionBoxRack` (solar junction boxes) and `ModuleRack` (battery
 * modules). `SubrackShelf` is deliberately not a caller — a cabinet bay is marked in the
 * drawing and named by the panel beside it, so it has no card to put these on.
 */

/**
 * The other half of a part's fault mark: **the rank, in the app's own words.**
 *
 * The two are a pair and sit on one card — this in the top-right corner opposite the
 * part's name, `FaultChip` on the line under it — because they answer different
 * questions. This says *how bad*; the chip says *which register*. Neither substitutes
 * for the other, and a card carrying only the chip leaves the severity to be inferred
 * from a hue.
 *
 * That is not hypothetical: the junction box card shipped without this for a few hours
 * on 2026-09-09, on the argument that the chip plus a red edge said enough, and Jeff
 * asked for it back on the shape the battery module cards already had. So it is here
 * rather than in either rack, and both draw it.
 *
 * ## Why the severity words rather than `Fault`
 *
 * `ModuleRack` said `Fault` in flat amber at every severity, which was one word doing
 * two jobs badly — it named the *kind* of mark while the card's surface named the rank,
 * so a critical module and a neutral note carried identical pills and a reader had to
 * read the border to tell them apart. `Critical`, `Warning` and `Neutral` are the app's
 * own severity words, the same three the Alarms tab ranks the row by, read from the same
 * `SEVERITY_META` the card's edge and tint come from — so the pill and the card it sits
 * in cannot disagree.
 *
 * `NEUTRAL` gets no hue, which is `SEVERITY_META`'s deliberate choice and not a gap: a
 * neutral alert is a note rather than a problem, and giving it one would put it on the
 * same footing as the two that are. It is still plainly a mark — the badge's own
 * surface, a glyph, and the card's grey edge and shade — just an achromatic one. **This
 * is the element that keeps a neutral fault legible at all**, since hue alone says
 * nothing there.
 *
 * ## Why a triangle here and a bell on the chip
 *
 * They are marking different things. A bell is what this app puts on a *named alarm* —
 * the Alarms tab's filter chips, `ClassBadge`, `AlarmCounts` — and the chip carries a
 * register's name. A triangle is a severity, which is what this is. The two glyphs on
 * one card are the two questions, not one mark drawn twice.
 */
export const FaultBadge = ({severity}: {severity: AlertSeverity}) => {
  const meta = SEVERITY_META[severity];

  return (
    <Badge variant="secondary" className="gap-1">
      <TriangleAlertIcon className={meta.textClassName} aria-hidden="true" />
      <span className={meta.textClassName}>{meta.label}</span>
    </Badge>
  );
};

/**
 * **The register a part is asserting, as a chip that leads to the rows themselves.**
 *
 * The mark on a faulted part is drawn twice over: the part's card takes the severity's
 * edge and tint, and this names the register inside it. That division is deliberate —
 * the card says *something is wrong here* at a glance across a grid, and this says
 * *what*, which no amount of colour can.
 *
 * ## One element, both racks
 *
 * It began as two. `JunctionBoxRack` and `ModuleRack` each had a bare `<Link>` with a
 * byte-identical class list — the raw register name at the card's foot in
 * `text-xs text-secondary` — and both were camouflaged for the same reason: that grey is
 * the same grey as the `Strings` / `Panels` / `Health` / `Temp` labels stacked directly
 * above it, one step smaller, and last in reading order. The one exceptional thing on the
 * card read as a metric row whose value had gone missing (Jeff, 2026-09-09).
 *
 * Promoted here rather than fixed twice, for the reason `AlarmBadge` was promoted a day
 * earlier: two copies of one mark is how a faulted junction box and a faulted battery
 * module end up announcing themselves differently on two pages of one app.
 *
 * ## Why it looks like the Alarms tab's filter chips
 *
 * Because it is the same object — a named alarm as a chip — and Jeff asked for that shape
 * by name. `AlarmLists` draws the severity filters as `Badge variant="element"` with a
 * bell in the severity's colour and the label in `text-secondary`; this is that chip with
 * a register name in it.
 *
 * So the **bell, not a warning triangle**. The triangle was what both racks' severity
 * badges used, but the bell is what every *named alarm* in this app carries — the filter
 * chips, `ClassBadge`, `AlarmCounts` — and this is a named alarm.
 *
 * And so the name stays `text-secondary` rather than taking the severity's colour. The
 * chips colour the glyph and leave the label grey, on the argument that the label is the
 * subject and the glyph is the verdict. It makes this chip quieter than a coloured line
 * would be, which is affordable **only because the card behind it keeps the edge and the
 * tint** — the chip is not carrying the alarm on its own. Colouring the name is
 * `meta.textClassName` on the span if that ever changes.
 *
 * ## Why `size="sm"` where the filter chips are `size="md"`
 *
 * The filters sit full-width under a heading and can afford `text-sm`. These cards cannot:
 * a five-across junction box card has **145px** of content on a laptop, and
 * `PV 1 Array Fault` at 14px comes to about 150px once the bell, the gap and the badge's
 * `px-2.5` are counted. At `text-xs` it is 134px and fits. The default size is `sm`, so
 * this is the absence of a prop rather than an override.
 *
 * ## Why it truncates, and why that is not the 145px case
 *
 * `max-w-full` and a `min-w-0 truncate` span, against the badge's own `w-fit`. A junction
 * box name fits; `Lithium Battery 4 Abnormal` on a 10rem module card does not, at any
 * size. Truncated rather than wrapped because a grid row is as tall as its tallest card,
 * so two lines of register name deepen the whole row — both racks' notes make that
 * argument at length. The full string is the `title`, so the tooltip is the way to read
 * one that has been cut.
 *
 * ## No `search`, and what that costs
 *
 * `to` and `params` only, because the two callers are drawings nested inside a page and
 * neither is handed the route's search. The consequence is that a chip clicked on an
 * asset opened *from* a site loses the `from` crumb and lands on the asset's own trail,
 * where the header alarm pill in the same page's strip keeps it (`AlarmBadge`, which does
 * take `search`). Closing that is a `search` prop here and `keepFrom` threaded down from
 * `SystemHome` / `BankHome` to the racks.
 */
export const FaultChip = ({
  fault,
  to,
  params,
}: {
  /** The standing row, live — cleared on the Alarms tab means this unmounts. */
  fault: AlarmView;
  to: LinkProps['to'];
  /**
   * Loose on purpose, and cast at the `<Link>`. `to` here is the union of every route in
   * the app, so the router has nothing to narrow the params against — the same trade
   * `DetailNavItem` and `AlarmBadge` make, and for the same reason.
   */
  params?: LinkProps['params'];
}) => {
  const meta = SEVERITY_META[fault.severity];

  return (
    <Badge
      asChild
      variant="element"
      /* `border-subtle` over the variant's own `border-default`, matching the filter
         chips: this sits *inside* a card that already has an edge, and two edges of the
         same weight a few pixels apart read as a box in a box. */
      className={cn('max-w-full border-subtle transition-colors hover:bg-highlight')}
    >
      <Link
        to={to}
        params={params}
        /* The whole string, for the names this has to cut — and the severity in words,
           which is the one thing the chip does not draw. It is also the accessible name,
           so a screen reader gets `Critical: PV 1 Array Fault` rather than a bare
           register string with no rank on it. */
        title={`${meta.label} — ${fault.name}`}
        aria-label={`${meta.label}: ${fault.name}`}
        className="outline-none focus-visible:ring-2 focus-visible:ring-outline"
      >
        {/* Sized by the badge's own `[&>svg]:size-3`, which reaches direct children —
            with `asChild` the `<Link>` is the badge, so this is one. */}
        <BellIcon className={cn('shrink-0', meta.textClassName)} aria-hidden="true" />
        <span className="min-w-0 truncate text-secondary">{fault.name}</span>
      </Link>
    </Badge>
  );
};
