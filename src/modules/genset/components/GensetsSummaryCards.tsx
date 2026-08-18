import {
  CardNote,
  CountChip,
  Headline,
  SummaryCard,
  SummaryCardRow,
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

  return (
    <SummaryCardRow>
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

      <SummaryCard label="By customer">
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
  );
};
