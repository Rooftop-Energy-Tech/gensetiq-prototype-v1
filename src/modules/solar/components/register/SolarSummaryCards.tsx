import {useId, useState} from 'react';

import {
  CardNote,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {amount} from '@/lib/format';
import type {SolarSummary} from '../../data/register';

/**
 * The strip above the solar register: **how much PV there is, what it is making, and
 * what is wrong with it.**
 *
 * ## These are placeholders, and here is what that means
 *
 * Four cards that **read** and do not **act**. The fleet strip's four are
 * `FilterCard`s — click "Tank empty" and the list and the map narrow to it — and
 * these deliberately are not, because a filter needs a bucket in the URL to carry it
 * and this register's schema has one dimension in it so far: region. Adding
 * `?condition=critical` is the obvious next move and is a change to
 * `register.type.ts` plus one prop here, not a redesign.
 *
 * What they are *not* is invented. Every figure is read off the same rows the table
 * below is drawing — see `solarSummary` — so a placeholder card cannot claim a total
 * the list does not contain. The estate's own arithmetic is the cheap part; the
 * expensive part was deciding which four questions deserve the width, and that is the
 * part left open.
 *
 * ## Counted over the whole register
 *
 * `solarSummary`'s rule and `fleetSummary`'s before it: the numbers hold still while
 * the list below answers a narrower question. The one figure that follows the filter
 * is the headline's "showing N", because that is the question the headline is
 * answering.
 */

type SolarSummaryCardsProps = {
  summary: SolarSummary;
  /** How many rows the list is actually showing, once search and the filter are applied. */
  showing: number;
};

export const SolarSummaryCards = ({summary, showing}: SolarSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  /**
   * Folded away, at phone width only. Local state rather than a search param, for the
   * reason `GensetsSummaryCards` gives: the reader's device decides the presentation,
   * not the URL, and a `?cards=closed` followed on a desktop would name a state that
   * width has no control to undo.
   */
  const [collapsed, setCollapsed] = useState(false);

  // Generated rather than written, because `SummaryCardRow` is shared across four
  // screens and `aria-controls` has to resolve to a unique node.
  const cardsId = useId();

  return (
    <div className="flex flex-col gap-3">
      {/* Four narrow cards sharing the row evenly — none of them is the wrapping kind
          that turns extra width into fewer lines, so none of them wants the slack. */}
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={4}>
        <SummaryCard label="Solar">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'system' : 'systems'}
            detail={
              filtered
                ? `Showing ${showing}`
                : `${Math.round(summary.totalKwp).toLocaleString('en-MY')} kWp installed`
            }
          />
          {filtered && (
            <CardNote>
              {Math.round(summary.totalKwp).toLocaleString('en-MY')} kWp installed
            </CardNote>
          )}
        </SummaryCard>

        <SummaryCard label="Output now">
          {/* A string, so the figure carries its own unit: the estate swings between
              tens of kW at dusk and a megawatt at noon, and a card whose unit changed
              with the hour would be one nobody could read at a glance. */}
          <Headline
            value={amount(summary.outputKw, 'kW', 1)}
            detail={`${summary.reporting} of ${summary.total} reporting`}
          />
        </SummaryCard>

        <SummaryCard label="Attention">
          <Headline
            value={summary.attention}
            unit={summary.attention === 1 ? 'system' : 'systems'}
            detail={
              summary.critical === 0
                ? 'Nothing critical'
                : `${summary.critical} critical`
            }
          />
        </SummaryCard>

        <SummaryCard label="Dark strings">
          <Headline
            value={summary.darkStrings}
            unit={summary.darkStrings === 1 ? 'string' : 'strings'}
            detail={
              summary.darkSystems === 0
                ? 'Every string live'
                : `Across ${summary.darkSystems} ${summary.darkSystems === 1 ? 'system' : 'systems'}`
            }
          />
        </SummaryCard>
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        // Nothing on this strip is a filter yet, so there is no applied state for the
        // closed button to report. See the note above.
        activeCount={0}
        controls={cardsId}
        noun="summary"
      />
    </div>
  );
};
