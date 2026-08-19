import {useId, useState} from 'react';

import {
  CardNote,
  CountChip,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {STATUS_META} from '../data/fleetStatus';
import type {FleetSummary} from '../data/fleetSummary';
import type {GensetSearch} from '../types/view.type';

/**
 * The four cards above the fleet list: how much plant there is, what duty it is on,
 * whether it is well, and whose it is.
 *
 * Ordered by how often the question gets asked rather than by how the data is
 * shaped. "How many have we got" is the one an operator opens the screen with;
 * "whose is it" is the one they arrive at after something is wrong, which is why
 * the customer card is last and widest.
 *
 * Every chip is a filter — see `SummaryCards.tsx` for why the counts don't move
 * when you use one.
 */

type GensetsSummaryCardsProps = {
  summary: FleetSummary;
  /** How many rows the list is actually showing, once search and chips are applied. */
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
   * Open on arrival: the chips are the only filtering this width has, and a screen
   * that starts by hiding its own controls has to be learned before it can be used.
   */
  const [collapsed, setCollapsed] = useState(false);

  // The chips, and only them. `q` is the toolbar's search with its own visible field,
  // so counting it here would report a filter this button does not fold away.
  const activeCount = [search.role, search.status, search.customer].filter(
    (value) => value !== undefined,
  ).length;

  // Generated rather than a written constant: `aria-controls` has to resolve to a
  // unique node, and `SummaryCardRow` is shared with the sites screen.
  const cardsId = useId();

  return (
    <div className="flex flex-col gap-3">
      <SummaryCardRow id={cardsId} collapsed={collapsed}>
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

        <SummaryCard label="Duty">
          <div className="flex flex-col gap-0.5">
            {summary.byRole.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                active={search.role === tally.key}
                onToggle={(next) => onSearchChange({role: next ? tally.key : undefined})}
                block
              />
            ))}
          </div>
        </SummaryCard>

        <SummaryCard label="Status">
          <div className="flex flex-col gap-0.5">
            {summary.byStatus.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                tone={STATUS_META[tally.key].tone}
                active={search.status === tally.key}
                onToggle={(next) => onSearchChange({status: next ? tally.key : undefined})}
                title={STATUS_META[tally.key].detail}
                block
              />
            ))}
          </div>
        </SummaryCard>

        <SummaryCard label="By zone">
          {/* Chips wrap rather than the card scrolling: seven accounts is a sentence
              you read across, and a scroll area would hide the tail of the estate
              behind an interaction. */}
          <div className="flex flex-wrap gap-x-1 gap-y-0.5">
            {summary.byCustomer.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                active={search.customer === tally.key}
                onToggle={(next) => onSearchChange({customer: next ? tally.key : undefined})}
              />
            ))}
          </div>
        </SummaryCard>
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        activeCount={activeCount}
        controls={cardsId}
      />
    </div>
  );
};
