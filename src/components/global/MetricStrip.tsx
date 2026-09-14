import type {LinkProps} from '@tanstack/react-router';
import type {ReactNode} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';

/**
 * The strip across the top of a site, a system or a bank: the figures that move,
 * then the alarm counts.
 *
 * ## Why one component for three pages
 *
 * Because the design draws one. The site frame, the solar frame and the battery
 * frame all open on the same rule — equal columns, a label over a figure, and the
 * severity pill last — and the only thing that differs is which figures. That is
 * the caller's business and nothing else here is.
 *
 * Equal shares rather than content-width columns, so the strip reads as a rule
 * across the page and the eye can drop to any of them without hunting.
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
 * ## Why the alarms close the strip
 *
 * Because they are the one column every page can fill, and because the readings
 * before them are what a reader is scanning. Generation exists at a system, fuel at
 * a genset, charge at a bank — and none of them anywhere else. Alarms are the one
 * quantity all three plant types raise, so ending on them is what lets a reader
 * moving between the three know where to look without reading the labels first.
 *
 * The pill was pinned to the **third** column until 2026-09-14, which held while
 * every strip had two readings. The site strip now draws four — supply, the plant
 * figures it can answer for, and the draw — so third would have put the pill in the
 * middle of the readings there. Last is the rule that survives a strip growing;
 * third was the rule that only held while none of them did. On the three asset
 * strips nothing moved: with two readings, last *is* third.
 */
export const MetricStrip = ({
  metrics,
  counts,
  alarmLink,
  ariaLabel,
}: {
  /**
   * Two in the design, three where a page has a third question of the same kind —
   * the genset's tank, its runway and its service counter — and four on a site,
   * which is the only page that can answer for the plant standing beside the tower
   * as well as the tower. Not a licence to keep adding: the strip's value is that a
   * reader knows where to look before they read the labels, and every column added
   * spends a little of it.
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
  ariaLabel: string;
}) => (
  // A **container** query, not a breakpoint, and for the reason `DetailBand` gives:
  // these strips sit inside two rails that take up to 480px between them, so the
  // viewport says nothing useful about how much room the columns have. The old
  // `sm:` turned the strip into a row at a 640px *viewport*, which on a tablet is a
  // ~440px strip — five columns of 88px, narrow enough to break a figure across
  // two lines mid-bracket. This measures the strip itself.
  <div className="@container">
    <section
      aria-label={ariaLabel}
      // A column until the columns fit: five equal shares of 672px is 134px each,
      // which the widest of them — a draw with its bus reading — meets by dropping
      // the bracket to its own line rather than truncating it. See `SiteMetricStrip`.
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
    </section>
  </div>
);
