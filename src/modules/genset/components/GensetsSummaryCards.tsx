import {CountChip} from '@/components/global/SummaryCards';
import {STATUS_META} from '../data/fleetStatus';
import type {FleetSummary} from '../data/fleetSummary';
import type {GensetSearch} from '../types/view.type';

/**
 * The fleet's summary: **one row, read left to right.**
 *
 * It was five cards — a capped `Fleet` and four status filters — and it is the same
 * change the estate strip took the same day, for the same reason: a summary that
 * stands 146px above a register is competing with the register. Tristan's call,
 * 2026-09-21.
 *
 * ## The four filters became four chips
 *
 * They were `FilterCard`s: a count, a unit, and a line of explanation each. The
 * explanation is what made them cards, and it is what goes — `Below 10% — no cover
 * until refuelled` is worth reading once and is then furniture on every visit. It
 * survives as the chip's `title`, so it is a hover away rather than gone.
 *
 * What does not change is that all four are **always drawn, zero or not**. They are a
 * fixed scale a reader learns once, and a bucket vanishing on a good day would move
 * the other three under a cursor that had learnt where they sit.
 */

type GensetsSummaryCardsProps = {
  summary: FleetSummary;
  /** How many rows the list is actually showing, once search and filters are applied. */
  showing: number;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

export const GensetsSummaryCards = ({
  summary,
  showing,
  search,
  onSearchChange,
}: GensetsSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  return (
    <section
      aria-label="Fleet summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-element px-3 py-2"
    >
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-lg leading-none font-semibold text-primary tabular-nums">
          {summary.total}
        </span>
        <span className="truncate text-sm text-secondary">
          {summary.total === 1 ? 'genset' : 'gensets'}
          {' · across '}
          {summary.siteCount} {summary.siteCount === 1 ? 'site' : 'sites'}
        </span>
      </p>

      {filtered && (
        <span className="truncate text-sm text-tertiary">Showing {showing}</span>
      )}

      <span className="h-4 w-px shrink-0 bg-subtle" aria-hidden="true" />

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
    </section>
  );
};
