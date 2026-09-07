import {useId, useState} from 'react';

import {
  CardNote,
  FilterCard,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {STATUS_META} from '../data/fleetStatus';
import type {FleetSummary} from '../data/fleetSummary';
import type {GensetSearch} from '../types/view.type';

/**
 * The strip above the fleet list: **how much plant there is, and what needs doing to
 * it** — one narrow headline and the four readiness buckets across the rest of the row.
 *
 * ## What moved out
 *
 * `Duty` and the region grouping are now dropdowns in the toolbar — see
 * `FilterSelect` for the argument and `GensetsToolbar` for where they sit. They are
 * **attributes**: a reader either wants standby sets or does not, and the counts
 * beside them are context rather than an answer. Two cards' width to say so is what
 * kept the readiness buckets in a 13rem column. The estate strip made the same move
 * first, and this is the fleet screen agreeing with it.
 *
 * ## Why the statuses got a card each
 *
 * They are the question the screen exists to answer, so their *distribution* is the
 * information — one empty tank beside fifteen alarms is a fact you read at a glance.
 * As four rows in one card they were four counts and a `title` attribute nobody
 * hovers; as four cards they carry the figure and the line saying what the bucket
 * means, and left to right they read as the ranking `fleetStatus.ts` sets out: no
 * cover, then a fault, then a tanker to book, then nothing to do.
 *
 * They still filter, on the same terms the chips did — see `FilterCard` — and the
 * counts still hold still while you filter against them, which is `fleetSummary`'s
 * rule and the reason they are worth reading twice.
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

  /**
   * Folded away, at phone width only.
   *
   * Local state rather than a search param, unlike the `view` and `panel` next door.
   * The rule this screen already states about `view` settles it: the reader's device
   * decides the presentation, not the URL. A `?cards=closed` followed on a desktop
   * would name a state that width has no control to undo, and a link is worth more
   * naming *what is being looked at* than how one phone had it folded. It follows
   * that the fold does not survive a reload, which is the right trade for a control
   * one tap away.
   *
   * Open on arrival: a screen that starts by hiding its own controls has to be
   * learned before it can be used.
   */
  const [collapsed, setCollapsed] = useState(false);

  // `status`, and only `status`. Duty and region live in the toolbar now and are
  // never folded away, so reporting them here would name state the reader can still
  // see; `q` has its own visible field for the same reason.
  const activeCount = search.status === undefined ? 0 : 1;

  // Generated rather than a written constant: `aria-controls` has to resolve to a
  // unique node, and `SummaryCardRow` is shared with the sites screen.
  const cardsId = useId();

  return (
    <div className="flex flex-col gap-3">
      {/* One capped card, then four that share what is left — see `columnTemplate`. */}
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={1}>
        <SummaryCard label="Fleet">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'genset' : 'gensets'}
            detail={
              // The headline is the one figure that follows the filter, because
              // "showing 6" is the sentence the rest of the screen is answering.
              filtered
                ? `Showing ${showing}`
                : `Across ${summary.siteCount} ${summary.siteCount === 1 ? 'site' : 'sites'}`
            }
          />
          {filtered && (
            <CardNote>
              {summary.siteCount} {summary.siteCount === 1 ? 'site' : 'sites'} in total
            </CardNote>
          )}
        </SummaryCard>

        {/* Always all four, zero or not — `fleetSummary` keeps them, because these are
            a fixed scale a reader learns once and a card vanishing on a good day would
            move the other three. */}
        {summary.byStatus.map((tally) => (
          <FilterCard
            key={tally.key}
            label={tally.label}
            count={tally.count}
            unit={tally.count === 1 ? 'genset' : 'gensets'}
            detail={STATUS_META[tally.key].detail}
            tone={STATUS_META[tally.key].tone}
            active={search.status === tally.key}
            onToggle={(next) => onSearchChange({status: next ? tally.key : undefined})}
          />
        ))}
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        activeCount={activeCount}
        controls={cardsId}
        // Four of the five cards here are filters, so the fleet strip keeps the
        // default noun where the estate's — one filter, two links out — says
        // "summary".
      />
    </div>
  );
};
