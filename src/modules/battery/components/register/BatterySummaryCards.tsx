import {useId, useState} from 'react';

import {
  CardNote,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {amount} from '@/lib/format';
import type {BatterySummary} from '../../data/register';

/**
 * The strip above the bank register: **how much storage there is, how long it would
 * last, and how much of it is still there.**
 *
 * ## These are placeholders, and here is what that means
 *
 * Four cards that **read** and do not **act** — see `SolarSummaryCards`, which makes
 * the same disclosure for the same reason: a filter needs a bucket in the URL to carry
 * it, and this register's schema has one dimension in it so far. `?runtime=low` is the
 * obvious next move and is a change to `register.type.ts` plus one prop here.
 *
 * Every figure is read off the same banks the table is drawing — see `batterySummary`
 * — so a placeholder card cannot claim a total the list does not contain.
 *
 * ## Why the two percentages are never adjacent
 *
 * `BatteryRegister` keeps `Charge` and `Health` at opposite ends of the row, because
 * *"two percentage columns touching read as one quantity printed twice, and the
 * misreading they invite is the expensive one — 81% health taken for a worse 81%
 * charge."* The strip has the same problem and solves it the same way: the runtime card
 * is in **hours**, not percent, and the health card is three cards away from it.
 */

type BatterySummaryCardsProps = {
  summary: BatterySummary;
  /** How many rows the list is actually showing, once search and the filter are applied. */
  showing: number;
};

export const BatterySummaryCards = ({summary, showing}: BatterySummaryCardsProps) => {
  const filtered = showing !== summary.total;

  /**
   * Folded away, at phone width only. Local state rather than a search param, for the
   * reason `GensetsSummaryCards` gives: the reader's device decides the presentation,
   * not the URL.
   */
  const [collapsed, setCollapsed] = useState(false);
  const cardsId = useId();

  return (
    <div className="flex flex-col gap-3">
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={4}>
        <SummaryCard label="Storage">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'bank' : 'banks'}
            detail={
              filtered
                ? `Showing ${showing}`
                : `${Math.round(summary.totalKwh).toLocaleString('en-MY')} kWh usable`
            }
          />
          {filtered && (
            <CardNote>
              {Math.round(summary.totalKwh).toLocaleString('en-MY')} kWh usable
            </CardNote>
          )}
        </SummaryCard>

        {/* The estate's *worst* runtime, not its average. An average would be a figure
            nobody can act on: the errand tonight is the one bank that will not see the
            morning, and a mean over twenty healthy ones hides it. */}
        <SummaryCard label="Shortest runtime">
          <Headline
            value={amount(summary.lowestHours, 'h', 1)}
            detail={
              summary.low === 0
                ? 'Every bank over three hours'
                : `${summary.low} ${summary.low === 1 ? 'bank' : 'banks'} under three hours`
            }
          />
        </SummaryCard>

        <SummaryCard label="Discharging">
          <Headline
            value={summary.discharging}
            unit={summary.discharging === 1 ? 'bank' : 'banks'}
            detail={`${summary.charging} charging`}
          />
        </SummaryCard>

        {/* Health as a mean, unlike the runtime card, and the note in `batterySummary`
            says why: fade is a fact about the conversion programme rather than an
            errand, so the estate-wide figure is the one worth a card. */}
        <SummaryCard label="Mean health">
          <Headline
            value={`${Math.round(summary.meanSoh * 100)}%`}
            detail={
              summary.tired === 0
                ? 'None under 85%'
                : `${summary.tired} under 85%`
            }
          />
        </SummaryCard>
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        // Nothing on this strip is a filter yet, so there is no applied state for the
        // closed button to report.
        activeCount={0}
        controls={cardsId}
        noun="summary"
      />
    </div>
  );
};
