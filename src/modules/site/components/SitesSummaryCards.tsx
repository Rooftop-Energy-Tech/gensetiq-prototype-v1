import {
  CardNote,
  CountChip,
  Headline,
  SummaryCard,
  SummaryCardRow,
} from '@/components/global/SummaryCards';
import {STATUS_META} from '@/modules/genset/data/fleetStatus';
import type {EstateSummary} from '../data/estateSummary';
import type {SiteSearch} from '../types/view.type';

/**
 * The fleet screen's cards, counting yards instead of machines.
 *
 * Same four questions in the same order, so somebody moving between the two
 * screens is reading one instrument at two scales rather than learning a second
 * layout. What changes is only what a number means: `Standby 14` here is fourteen
 * *sites* with a mains incomer, and the headline carries the genset count as its
 * second figure rather than its first.
 */

type SitesSummaryCardsProps = {
  summary: EstateSummary;
  /** Rows the list is showing, once search and chips are applied. */
  showing: number;
  search: SiteSearch;
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

export const SitesSummaryCards = ({
  summary,
  showing,
  search,
  onSearchChange,
}: SitesSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  return (
    <SummaryCardRow>
      <SummaryCard label="Sites">
        <Headline
          value={summary.total}
          unit={summary.total === 1 ? 'site' : 'sites'}
          detail={
            filtered
              ? `Showing ${showing}`
              : `${summary.gensetCount} ${summary.gensetCount === 1 ? 'genset' : 'gensets'} standing`
          }
        />
        {filtered && <CardNote>{summary.gensetCount} gensets in total</CardNote>}
      </SummaryCard>

      <SummaryCard label="Supply">
        {/* "Supply" rather than the fleet's "Duty": at a site the role says how the
            yard is *fed*, which is a fact about the place. On a machine it says
            what that machine is there to do. Same token, two readings, and the
            labels should not pretend otherwise. */}
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
