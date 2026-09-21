import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {TriangleAlertIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';

/**
 * **A standing row as one pill: how bad it is, then which register said so.**
 *
 * `Critical · SSU 4 Fault`, in the badge row of a part's detail panel, leading to the
 * tab the row is listed on. Jeff asked for the register name inside the severity pill
 * (2026-09-10) — the pill said `Critical` and nothing else, so a reader looking at a
 * red bay learned the rank at the top of the card and had to reach the foot of it to
 * learn *what* was wrong.
 *
 * ## Rank first, and why that order rather than the other one
 *
 * `BayAlarms` at the foot of the subrack panel puts the name first and the rank behind
 * it, and that is right for a **list**: several rows stacked, scanned by name, with the
 * rank as the qualifier. A pill sits in a row of badges that a reader takes in at a
 * glance — beside `Carrying` and `44.6 °C` — and the first thing it has to answer there
 * is *how bad*, which is the question the pill was already answering before the name
 * was added to it. Jeff picked this order explicitly.
 *
 * So the two are deliberately not identical, and the difference tracks what each one
 * is for. Both read the same `SEVERITY_META` entry the part's edge, tint and glyph come
 * from, so nothing on the card can disagree about the rank.
 *
 * ## One pill per standing row
 *
 * A bay can have more than one. An SSU bay watches `SSU N Fault` **and** `SSU Lost` —
 * the module's own row and the group's — a rectifier bay watches four rows and the AC
 * input bay ten, and any number of them can stand at once. So the caller maps its
 * asserted rows onto this and the badge row wraps, rather than this trying to
 * summarise a set it cannot see.
 *
 * A battery module is the simple case and stays that way: `faultedModules` keys one row
 * per module, so there is at most one pill on a module panel.
 *
 * ## Why it is a link
 *
 * Because naming an alarm and linking to it is this app's own rule — `AlarmBadge` in
 * the header strip, and the `FaultChip` this replaced on both racks' cards. It also
 * preserves something that would otherwise have been lost: the battery module panel
 * reached its Alarms tab through that chip, and this pill took its place. A pill that
 * named a register and went nowhere would be the one alarm in the app you cannot click.
 *
 * ## Only the glyph takes the row's severity
 *
 * The triangle is coloured from `SEVERITY_META`; the rank, the separator and the name
 * are the badge's own ink.
 *
 * **This has now gone both ways and the current answer is Tristan's (2026-09-14):
 * colour the icon, leave the text black.** It first shipped with the name in grey and
 * the rank coloured, Jeff overrode that to an all-red pill the same day it was built
 * (2026-09-10) — the argument being that a pill sitting among `Standby` and `44.6 °C`
 * has to not read like them, and that a half-red, half-grey pill read as a severity
 * chip with a caption bolted on. Both are recorded here rather than quietly replaced,
 * because a reader finding a one-colour pill in a screenshot should be able to tell
 * when it changed and why.
 *
 * What settles it is that this is the app's rule everywhere else and this pill was the
 * one exception. `ClassBadge` on the alarm tables, the alert rows on a genset's home,
 * the severity counts — all of them colour a glyph and set the words in the text
 * colour, and a reader who has learned that reads the hue off the mark rather than off
 * the sentence. A pill that coloured its whole string was a second convention for the
 * same fact.
 *
 * `NEUTRAL` is unaffected either way, which was the reason to keep the rank as a word
 * in the first place: `SEVERITY_META` gives it no hue by design, so the rank is carried
 * by the word `Neutral` and the triangle rather than by colour.
 */
export const AlarmPill = ({
  fault,
  to,
  params,
  wrap = false,
}: {
  /** The standing row, live — cleared on the Alarms tab means this unmounts. */
  fault: AlarmView;
  to: LinkProps['to'];
  /**
   * Loose on purpose, and cast at the `<Link>`. `to` here is the union of every route
   * in the app, so the router has nothing to narrow the params against — the same
   * trade `DetailNavItem` and `AlarmBadge` make.
   */
  params?: LinkProps['params'];
  /**
   * Break onto a second line rather than cut the register name.
   *
   * For the **part cards** — the solar junction boxes and the battery modules — where
   * five across leaves about 145px and `Critical · PV 1 Array Fault` wants 186. The
   * detail panels leave it off: they are a column 346px wide and a name that long fits
   * on one line there, so a pill that could wrap would simply never wrap.
   *
   * Jeff chose wrapping over truncation on the cards (2026-09-10). It is worth naming
   * what it costs, because both racks' own notes argue the other way: a grid row is as
   * tall as its tallest card, so one wrapped pill deepens every card in its row. That
   * argument was made against wrapping a *register name on its own* — the trade changed
   * when the rank joined it in the same pill, since the alternative is now cutting the
   * name in every card that has one rather than in the occasional long one.
   */
  wrap?: boolean;
}) => {
  const meta = SEVERITY_META[fault.severity];

  return (
    <Badge
      asChild
      variant="secondary"
      className={cn(
        'max-w-full',
        /* `rounded-md` when it wraps, and this is not a style preference. The badge is
           `rounded-full`, which resolves to half the shorter side — on a two-line pill
           that is a 20px radius against 10px of horizontal padding, so the corners eat
           into the text. A single-line pill is 24px tall and its 12px radius clears the
           text comfortably, which is why the panels keep it. */
        wrap
          ? 'h-auto flex-wrap items-start rounded-md py-1 text-left whitespace-normal'
          : undefined,
      )}
    >
      <Link
        to={to}
        params={params}
        /* The whole string, for the names this still has to cut, and the accessible
           name too — so a screen reader gets `Critical: SSU 4 Fault` rather than a bare
           register string with no rank on it. */
        title={`${meta.label} — ${fault.name}`}
        aria-label={`${meta.label}: ${fault.name}`}
        className="outline-none transition-colors hover:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
      >
        {/* Sized by the badge's own `[&>svg]:size-3`, which reaches direct children —
            with `asChild` the `<Link>` is the badge, so this is one. */}
        <TriangleAlertIcon className={cn('shrink-0', meta.textClassName)} aria-hidden="true" />
        {/* The badge's own ink from here on — see the note above. */}
        <span className="shrink-0">{meta.label}</span>
        <span aria-hidden="true" className="shrink-0">
          ·
        </span>
        {/* The name exactly as the gateway publishes it, which is what the Alarms tab
            lists and what history is keyed on.

            Wrapping drops `truncate` and takes `break-words`, so a name too long for
            even a second line breaks inside itself rather than overflowing the badge's
            `overflow-hidden` and vanishing. Truncating keeps the single line and puts
            the whole string on the tooltip. */}
        <span className={cn('min-w-0', wrap ? 'break-words' : 'truncate')}>
          {fault.name}
        </span>
      </Link>
    </Badge>
  );
};
