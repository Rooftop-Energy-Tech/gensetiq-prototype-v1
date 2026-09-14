import type {LinkProps} from '@tanstack/react-router';
import type {ReactNode} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';

/**
 * The strip across the top of a site, a system or a bank: the two or three figures
 * that move, then the alarm counts.
 *
 * ## Why one component for three pages
 *
 * Because the design draws one. The site frame, the solar frame and the battery
 * frame all open on the same rule — three equal columns, a label over a figure
 * twice, and the severity pill third — and the only thing that differs is which
 * two figures. That is the caller's business and nothing else here is.
 *
 * Equal thirds rather than content-width columns, so the strip reads as a rule
 * across the page and the eye can drop to any of the three without hunting.
 * Content-width columns would bunch every page's figures at the left and leave the
 * rest of a 1,530px band empty.
 *
 * ## The alarm column is a door, not a figure
 *
 * Clicking the pill opens that asset's Alarms tab, and `alarmLink` is **required**
 * rather than optional so that stays true of every strip drawn. Jeff asked for it on
 * the solar page (2026-09-09) and for it "throughout all sites and assets"; an optional
 * prop would have made the next strip added silently dead again, which is exactly how
 * this strip and the site panel's device cards came to disagree in the first place. See
 * `AlarmBadge`, which is the element and carries the argument for dropping the tooltip.
 *
 * ## Why the third column is always the alarms
 *
 * Because it is the one column every page can fill. Generation exists at a system,
 * fuel at a genset, charge at a bank — and none of them anywhere else. Alarms are
 * the one quantity all three plant types raise, so pinning them to a fixed column
 * is what lets a reader moving between the three know where to look without
 * reading the labels first.
 *
 * ## Why `trailing` comes *after* the alarms rather than before them
 *
 * The site page carries a fourth column the other two have nothing to put in — the
 * plant figure that site can answer for, which is `Generation today` at one yard
 * and `Fuel level` at the next. Slotting it third would push the alarms to fourth
 * **on that page only**, and the paragraph above is the whole reason not to: a
 * reader moving site → solar → battery would find the pill in a different place on
 * the first of them. So the strip grows on the right, and the alarm column stays
 * the third one everywhere it is drawn.
 */
export const MetricStrip = ({
  metrics,
  counts,
  alarmLink,
  trailing,
  ariaLabel,
}: {
  /**
   * Two in the design, three where a page has a third question of the same kind —
   * the genset's tank, its runway and its service counter. Not a licence to keep
   * adding: the strip's value is that a reader knows where to look before they
   * read the labels, and a column that moves between pages costs exactly that.
   */
  metrics: ReadonlyArray<{label: string; value: ReactNode}>;
  counts: Record<AlertSeverity, number>;
  /**
   * Where the alarm pill goes — this asset's own Alarms tab.
   *
   * Required, and the five callers are the five routes: a site, a system, a bank, a
   * cabinet and a set. `params` and `search` are typed as the router's own loose
   * shapes for the reason `DetailNavItem` gives: `to` here is the union of every route
   * in the app, so the router has nothing to narrow them against, and a typo is caught
   * one file away where the caller builds them from its own route's params.
   */
  alarmLink: {
    to: LinkProps['to'];
    params?: LinkProps['params'];
    search?: LinkProps['search'];
  };
  /**
   * An extra column past the alarms, label and all — the site page's fitted-plant
   * figure and nothing else so far. The caller supplies the value because what goes
   * in it is its own business; the column shell is here so the fourth column is
   * measured, spaced and labelled exactly like the three beside it, and typeset
   * like them too: a figure in the fourth column is still a figure.
   */
  trailing?: {label: string; value: ReactNode};
  ariaLabel: string;
}) => (
  // A **container** query, not a breakpoint, and for the reason `DetailBand` gives:
  // these strips sit inside two rails that take up to 480px between them, so the
  // viewport says nothing useful about how much room the columns have. The old
  // `sm:` turned the strip into a row at a 640px *viewport*, which on a tablet is a
  // ~440px strip — four columns of 100px, narrow enough to break a figure across
  // two lines mid-bracket. This measures the strip itself.
  <div className="@container">
    <section
      aria-label={ariaLabel}
      // A column until the columns fit: four equal shares of 672px is 168px each,
      // which is what the widest of them — a draw with its bus reading — needs.
      className="flex flex-col gap-4 rounded-md border border-subtle bg-element px-5 py-4 @2xl:flex-row @2xl:gap-3"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-secondary">
            {metric.label}
          </span>
          <span className="text-base font-semibold text-primary tabular-nums">
            {metric.value}
          </span>
        </div>
      ))}

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="truncate text-sm font-medium text-secondary">Alarm</span>
        {/* Three counts in one pill, coloured rather than labelled — the design's
            treatment, and the only way three numbers fit the column. Any severity
            with something standing fills its cell, so the strip says *something is
            wrong here* before a reader has read a figure.

            It was a `Badge` under a Radix tooltip and is now a link to the tab that
            can answer it. The tooltip that "spells the order out" went with the
            change and its legend is the `title` instead — `AlarmBadge` argues both,
            including why that loss is worth naming here: this was the one place in
            the app that taught the reader the order. */}
        <AlarmBadge
          counts={counts}
          to={alarmLink.to}
          params={alarmLink.params}
          search={alarmLink.search}
        />
      </div>

      {trailing !== undefined && (
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="truncate text-sm font-medium text-secondary">
            {trailing.label}
          </span>
          <span className="text-base font-semibold text-primary tabular-nums">
            {trailing.value}
          </span>
        </div>
      )}
    </section>
  </div>
);
