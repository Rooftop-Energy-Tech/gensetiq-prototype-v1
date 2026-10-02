import {useId, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {ArrowUpRightIcon} from 'lucide-react';

import {
  CardNote,
  CountChip,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {gensetSearch} from '@/modules/genset/types/view.type';
import type {DeploymentSummary} from '../data/feed';
import type {DeploymentSearch} from '../types/view.type';
import {DEPLOYMENT_STATE_META} from './stateMeta';

/**
 * The deployment summary: three cards in the Gensets page's shape —
 * `Status`, `Deployments`, `Gensets out`. `Status` leads, as it does
 * on the Gensets page (swapped with `Deployments` on 2026-09-29).
 *
 * ## History
 *
 * It was one line (the sites strip's shape) until 2026-09-29, and cards from then at
 * Jeff's request, so the two registers' summaries look alike. The line's figures all
 * survive, regrouped:
 *
 * - **The cards count the whole record**, and only `Showing N` follows the filters —
 *   the Gensets cards' rule. The toolbar's dropdowns are what follow the filters.
 * - **Status** is the three states a job can be in, always drawn, each a toggle
 *   (`?state=`) — the chips the line had.
 * - **Gensets out** counts machines rather than jobs: two sets at one substation is
 *   one yard's worth of logistics and two machines' worth of fuel. What is committed
 *   to a job that has not started rides under it, and the depot count leads to the
 *   Gensets page, since the next question is *which ones*.
 * - **Diesel burned**, with the typical job length under it, was the fourth card
 *   until 2026-09-29 and came off on request; each job's litres are in its preview
 *   panel and on its own page.
 */

/** What each status row means, spelled out where a reader can hover it. */
const CHIP_TITLE: Record<string, string> = {
  planned: 'Booked to start later — the machines are committed and nothing has moved',
  active: 'Standing now — the machines are on location',
  completed: 'Closed in the last 60 days',
};

type DeploymentsSummaryCardsProps = {
  summary: DeploymentSummary;
  /** Rows the feed is showing, once search and filters are applied. */
  showing: number;
  search: DeploymentSearch;
  onSearchChange: (next: Partial<DeploymentSearch>) => void;
};

export const DeploymentsSummaryCards = ({
  summary,
  showing,
  search,
  onSearchChange,
}: DeploymentsSummaryCardsProps) => {
  const filtered = showing !== summary.total;
  const states = summary.byLocation.length;

  // Folded at phone width on request, as the Gensets cards are.
  const [collapsed, setCollapsed] = useState(false);
  const cardsId = useId();

  const committed =
    summary.committedGensets > 0 ? ` · ${summary.committedGensets} committed` : '';

  return (
    <div className="flex flex-col gap-3">
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={3}>
        <SummaryCard label="Status">
          <div className="flex flex-col gap-0.5">
            {summary.byState.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                tone={DEPLOYMENT_STATE_META[tally.key].tone}
                active={search.state === tally.key}
                onToggle={(next) => onSearchChange({state: next ? tally.key : undefined})}
                title={CHIP_TITLE[tally.key]}
                block
              />
            ))}
          </div>
        </SummaryCard>

        <SummaryCard label="Deployments">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'deployment' : 'deployments'}
            detail={
              filtered ? `Showing ${showing}` : `across ${states} ${states === 1 ? 'state' : 'states'}`
            }
          />
          {filtered && (
            <CardNote>
              across {states} {states === 1 ? 'state' : 'states'}
            </CardNote>
          )}
        </SummaryCard>

        <SummaryCard label="Gensets out">
          <Headline
            value={summary.deployedGensets}
            unit={summary.deployedGensets === 1 ? 'genset' : 'gensets'}
            detail={`at ${summary.occupiedSites} ${summary.occupiedSites === 1 ? 'address' : 'addresses'}${committed}`}
          />
          {/* The one line here that leads somewhere else rather than filtering, so
              it keeps the arrow every other way-out in this app carries. */}
          <Link
            to="/gensets"
            search={gensetSearch()}
            className="-mx-1 flex w-fit items-center gap-1 rounded-sm px-1 text-xs text-tertiary transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
          >
            {summary.depot === 0
              ? 'Nothing in the depot'
              : `${summary.depot} in the depot, available`}
            <ArrowUpRightIcon className="size-3 shrink-0" aria-hidden="true" />
          </Link>
        </SummaryCard>

      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        activeCount={search.state === undefined ? 0 : 1}
        controls={cardsId}
        noun="summary"
      />
    </div>
  );
};
