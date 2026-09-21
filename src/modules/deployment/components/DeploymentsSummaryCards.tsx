import {Link} from '@tanstack/react-router';
import {ArrowUpRightIcon} from 'lucide-react';

import {CountChip} from '@/components/global/SummaryCards';
import {amount, durationCompact} from '@/lib/format';
import {cn} from '@/lib/utils';
import {gensetSearch} from '@/modules/genset/types/view.type';
import type {DeploymentSummary} from '../data/feed';
import type {DeploymentSearch} from '../types/view.type';

/**
 * The deployment summary: **one row, read left to right** — the sites strip's shape,
 * and see `SitesSummaryCards` for the argument that a summary taking a fifth of the
 * viewport is a summary competing with its own subject.
 *
 * What it counts is this screen's own. The registers count *things*; this counts
 * *jobs*, and the headline is therefore two numbers rather than one: how many
 * machines are out, and how many yards they are standing in. Those are not the same
 * figure — two sets at one substation is one yard's worth of logistics and two
 * machines' worth of fuel — and a strip that gave only the first would be quietly
 * answering the easier question.
 *
 * The headline carries a third clause when there is one: **how many machines are
 * committed to a job that has not started.** That figure did not exist while a
 * deployment was only ever the present, and it is the one a dispatcher is caught out
 * by, because a set that is free today may be booked from Thursday.
 *
 * ## The chips are the three states, and they filter
 *
 * `Planned`, `Deployed` and `Completed`, which is the whole of what a job can be.
 * They are `CountChip`s rather than a sentence for the reason the estate's status
 * chips are: they are the one part of the strip that *does* something, and clicking
 * one narrows the table, the map and the timeline together.
 *
 * ## Why mean job length is on the strip
 *
 * It is the one figure here nobody can read off the list. Litres and hours are on
 * every row; how long a job *typically* runs is the fleet's own cadence, and it is
 * the number a dispatcher checks a quoted hire against. Measured over closed jobs
 * only — an open one has not finished, and folding it in would drag the mean down by
 * however recently the last lorry left.
 */

/** What each chip means, spelled out where a reader can hover it. */
const CHIP_TITLE: Record<string, string> = {
  planned: 'Booked to start later — the machines are committed and nothing has moved',
  active: 'Standing now — the machines are at the site',
  completed: 'Closed in the last 60 days',
};

type DeploymentsSummaryCardsProps = {
  summary: DeploymentSummary;
  /** Rows the feed is showing, once search and chips are applied. */
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

  return (
    <section
      aria-label="Deployment summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-element px-3 py-2"
    >
      {/* What is out, before anything offers to narrow it. The yard count rides
          behind the machine count as a second clause rather than as a second figure:
          one is what the lorries carried and the other is where they went. */}
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-lg leading-none font-semibold text-primary tabular-nums">
          {summary.deployedGensets}
        </span>
        <span className="truncate text-sm text-secondary">
          {summary.deployedGensets === 1 ? 'genset' : 'gensets'} out
          {' · '}
          {summary.occupiedSites} {summary.occupiedSites === 1 ? 'site' : 'sites'}
          {summary.committedGensets > 0 && ` · ${summary.committedGensets} committed`}
        </span>
      </p>

      {/* Only while a filter is actually on — the sites strip's rule, for its
          reason: a `Showing 61` that is true on arrival says nothing. */}
      {filtered && <span className="truncate text-sm text-tertiary">Showing {showing}</span>}

      <Rule />

      {/* Along the row rather than stacked — the two states, still filtering. */}
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {summary.byState.map((tally) => (
          <CountChip
            key={tally.key}
            label={tally.label}
            count={tally.count}
            tone={tally.key === 'active' ? 'ok' : 'neutral'}
            active={search.state === tally.key}
            onToggle={(next) => onSearchChange({state: next ? tally.key : undefined})}
            title={CHIP_TITLE[tally.key]}
          />
        ))}
      </div>

      <Rule />

      {/* The record's own two figures: how long a job runs, and what the fleet burned
          getting through them. Plain text rather than chips — neither narrows
          anything, and a chip that does not filter is a button lying about itself. */}
      <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
        <span className="text-secondary">Typical job</span>
        <span className="font-medium text-primary tabular-nums">
          {summary.meanCompletedMs === 0 ? '—' : durationCompact(summary.meanCompletedMs)}
        </span>
      </p>

      <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
        <span className="text-secondary">Diesel burned</span>
        <span className="font-medium text-primary tabular-nums">
          {amount(summary.fuelBurnedLitres, 'L')}
        </span>
      </p>

      {/* Hard right on a wide row, and in reading order on a wrapped one. The one
          item here that *leads somewhere else* rather than narrowing this register, so
          it keeps the arrow every other way-out in this app carries.

          What it counts is the complement of everything left of it: a machine on no
          active job is standing in a yard with nobody paying for it, and on a fleet
          that hires plant out that is the number a dispatcher is asked for when the
          phone rings. It leads to the fleet register, because the next question is
          *which ones*. */}
      <Link
        to="/gensets"
        search={gensetSearch()}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm',
          'transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
          'xl:ml-auto',
        )}
      >
        <span className="text-secondary">In the depot</span>
        <span className="font-medium text-primary tabular-nums">{summary.depot}</span>
        <span className="text-tertiary">
          {summary.depot === 0 ? 'everything is out' : 'available'}
        </span>
        <ArrowUpRightIcon className="size-3 shrink-0 text-tertiary" aria-hidden="true" />
      </Link>
    </section>
  );
};

/**
 * The separator between groups — `SitesSummaryCards`'s element, for its reason: a
 * `border-l` travels with its group and opens a wrapped line with a rule hanging off
 * the left edge.
 */
const Rule = () => <span className="h-4 w-px shrink-0 bg-subtle" aria-hidden="true" />;
