import {Link} from '@tanstack/react-router';
import {ArrowUpRightIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {CountChip} from '@/components/global/SummaryCards';
import {STATUS_META} from '@/modules/genset/data/fleetStatus';
import {gensetSearch} from '@/modules/genset/types/view.type';
import type {EstateSummary} from '../data/estateSummary';
import type {SiteSearch} from '../types/view.type';

/**
 * The estate's summary: **one row, read left to right.**
 *
 * It was three cards in a grid — a figure, a stack of four status chips, and a
 * link — which stood 146px tall above a list whose first row is the thing a reader
 * came for. Tristan's call, 2026-09-21: reduce it to a single horizontal row.
 *
 * ## What that costs and what it buys
 *
 * A card gives each figure a box and a label above it, and boxes are what let a
 * reader jump to one without reading the others. A row gives that up: everything is
 * on one line and the eye reads across. The trade is worth it here because there
 * are only three groups and the list underneath is the page — a summary that takes
 * a fifth of the viewport is a summary competing with its own subject.
 *
 * The **groups are still separated**, by a rule rather than by a border, so the row
 * reads as three answers and not as one long sentence. At narrow widths it wraps at
 * those rules, which is why they are their own elements rather than `border-l` on
 * the group: a wrapped group should not carry a rule into the start of a new line.
 *
 * ## The chips stayed chips
 *
 * `Status` lost its card and kept its four `CountChip`s, laid along the row instead
 * of stacked. They are the one part of this strip that *does* something — click
 * `Low fuel` and the list and the map both narrow — and the distribution across
 * them is the estate's readiness, which is the question this screen exists to
 * answer. Flattening them into a sentence would have made the row shorter and the
 * screen worse.
 *
 * ## The collapse control went with the cards
 *
 * There was a `Hide summary` button, because four cards stacked two-up were most of
 * a 375px viewport before the list started. One wrapped row is three or four lines
 * there, which is not worth a control to put away — and a button to fold a summary
 * this small would be more furniture than the thing it folds.
 */

type SitesSummaryCardsProps = {
  summary: EstateSummary;
  /** Rows the list is showing, once search and chips are applied. */
  showing: number;
  /**
   * Machines past one of their two service intervals, and the yards they stand in.
   *
   * The headline is the **plant**, where every other card here counts sites, and the
   * asymmetry is the point: a service is booked against a machine, on that machine's
   * own hour meter and its own interval, so two sets due at one site is two jobs
   * whoever happens to drive there. The site count moves to the detail line.
   */
  serviceDue: {gensetCount: number; siteCount: number};
  search: SiteSearch;
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

export const SitesSummaryCards = ({
  summary,
  showing,
  serviceDue,
  search,
  onSearchChange,
}: SitesSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  return (
    <section
      aria-label="Estate summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-element px-3 py-2"
    >
      {/* What the estate is, before anything offers to narrow it. The genset count
          rides behind the site count as a second clause rather than a second figure:
          one is what the list has rows for and the other is what is standing on
          them. */}
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-lg leading-none font-semibold text-primary tabular-nums">
          {summary.total}
        </span>
        <span className="truncate text-sm text-secondary">
          {summary.total === 1 ? 'site' : 'sites'}
          {' · '}
          {summary.gensetCount} {summary.gensetCount === 1 ? 'genset' : 'gensets'} standing
        </span>
      </p>

      {/* Only while a filter is actually on. A `Showing 25 of 25` that is true on
          arrival is a line every reader has to read once to learn it says nothing. */}
      {filtered && (
        <span className="truncate text-sm text-tertiary">Showing {showing}</span>
      )}

      <Rule />

      {/* Along the row rather than stacked — the four buckets, still filtering. */}
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {summary.byStatus.map((tally) => (
          <CountChip
            key={tally.key}
            label={tally.label}
            count={tally.count}
            tone={STATUS_META[tally.key].tone}
            active={search.status === tally.key}
            onToggle={(next) => onSearchChange({status: next ? tally.key : undefined})}
            title={STATUS_META[tally.key].detail}
          />
        ))}
      </div>

      {/* Hard right on a wide row, and in reading order on a wrapped one. The one
          item here that *leads somewhere else* rather than narrowing this list, so
          it keeps the arrow every other way-out in this app carries. */}
      <Link
        to="/gensets"
        search={gensetSearch({service: 'due'})}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm',
          'transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
          'xl:ml-auto',
        )}
      >
        <span className="text-secondary">Due for service</span>
        <span className="font-medium text-primary tabular-nums">{serviceDue.gensetCount}</span>
        <span className="text-tertiary">
          {serviceDue.gensetCount === 0
            ? 'nothing booked in'
            : `at ${serviceDue.siteCount} ${serviceDue.siteCount === 1 ? 'site' : 'sites'}`}
        </span>
        <ArrowUpRightIcon className="size-3 shrink-0 text-tertiary" aria-hidden="true" />
      </Link>
    </section>
  );
};

/**
 * The separator between groups.
 *
 * Its own element rather than a `border-l` on the group after it, because the row
 * wraps: a border travels with its group and would open a new line with a rule
 * hanging off the left edge. A standalone rule simply wraps out of sight.
 */
const Rule = () => <span className="h-4 w-px shrink-0 bg-subtle" aria-hidden="true" />;
