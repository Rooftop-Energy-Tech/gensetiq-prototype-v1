import {Link} from '@tanstack/react-router';
import {useMemo} from 'react';

import {cn} from '@/lib/utils';
import {STATUS_META} from '@/modules/genset/data/fleetStatus';
import type {FleetStatus} from '@/modules/genset/data/fleetStatus';
import {CUSTOMERS} from '@/modules/site/data/customers';
import {estateSummary} from '@/modules/site/data/estateSummary';
import {fleetOverview} from '@/modules/site/data/fleetOverview';
import type {RoleGroup, StatusCell} from '@/modules/site/data/fleetOverview';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSearch} from '@/modules/site/types/view.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * `/overview` — the screen the app opens on.
 *
 * It exists because the two list screens answered the wrong question first. A fleet
 * manager arriving in the morning is not looking for a genset; they are asking how
 * much of the estate is in trouble and which half of it. A list makes them read
 * twenty-four rows to find that out, and a map makes them read pin colours. So the
 * counts come first and the lists become the way *in* to them.
 *
 * Every number on this page is a link into `/sites` with the same cut applied, so
 * the drill-down is the list somebody already knows rather than a third screen. That
 * is also the discipline that keeps this page honest: there is no figure here whose
 * working the reader cannot go and look at.
 *
 * Nothing is stored. See `fleetOverview` for the two groupings and why duty is the
 * outer one.
 */

const TONE_TEXT: Record<'critical' | 'warning' | 'ok', string> = {
  critical: 'text-severity-critical',
  warning: 'text-severity-warning',
  ok: 'text-severity-ok',
};

const TONE_DOT: Record<'critical' | 'warning' | 'ok', string> = {
  critical: 'bg-severity-critical',
  warning: 'bg-severity-warning',
  ok: 'bg-severity-ok',
};

const ROLE_META: Record<SitePowerRole, {label: string; detail: string}> = {
  STANDBY: {
    label: 'Standby',
    // What the reader needs in order to weigh the counts under it: at these yards a
    // problem is a loss of cover, not yet a loss of supply.
    detail: 'Mains carries the load; the sets are the backup',
  },
  PRIME: {
    label: 'Continuous',
    detail: 'No mains incomer; the sets are the supply',
  },
};

/** `4` over `Tank empty`, over `2 gensets` — one tile, linked into the sites list. */
const StatusTile = ({cell, role}: {cell: StatusCell; role: SitePowerRole}) => {
  const meta = STATUS_META[cell.status];
  const none = cell.siteCount === 0;

  return (
    <Link
      to="/sites"
      search={siteSearch({role, status: cell.status})}
      // An empty bucket is still a link, and deliberately: clicking "Tank empty 0"
      // and landing on an empty list is a complete answer, where a dead tile makes
      // the reader wonder whether it is broken. It is just quietened down.
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5 transition-colors outline-none',
        'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={cn('size-1.5 shrink-0 rounded-full', none ? 'bg-tertiary' : TONE_DOT[meta.tone])}
          aria-hidden="true"
        />
        <span className="truncate text-xs font-medium text-secondary">{meta.label}</span>
      </span>
      <span
        className={cn(
          'text-2xl leading-none font-semibold tabular-nums',
          none ? 'text-tertiary' : TONE_TEXT[meta.tone],
        )}
      >
        {cell.siteCount}
      </span>
      <span className="truncate text-xs text-secondary">
        {cell.siteCount === 1 ? 'site' : 'sites'}
        {cell.gensetCount > 0 && ` · ${cell.gensetCount} ${cell.gensetCount === 1 ? 'genset' : 'gensets'}`}
      </span>
    </Link>
  );
};

const RoleSection = ({group}: {group: RoleGroup}) => {
  const meta = ROLE_META[group.role];

  return (
    <section aria-label={meta.label} className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-medium text-primary">{meta.label}</h2>
        <p className="text-xs text-secondary">
          {group.siteCount} {group.siteCount === 1 ? 'site' : 'sites'} · {group.gensetCount}{' '}
          {group.gensetCount === 1 ? 'genset' : 'gensets'}
        </p>
        {/* The count that matters sits in the heading rather than in a fifth tile,
            because it is a sum of three of the four below it and a tile would read
            as a bucket of its own. */}
        <p
          className={cn(
            'text-xs',
            group.needingAttention > 0 ? 'text-severity-warning' : 'text-secondary',
          )}
        >
          {group.needingAttention === 0
            ? 'Nothing outstanding'
            : `${group.needingAttention} needing attention`}
        </p>
        <p className="w-full text-xs text-tertiary">{meta.detail}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {group.cells.map((cell) => (
          <StatusTile key={cell.status} cell={cell} role={group.role} />
        ))}
      </div>
    </section>
  );
};

export const OverviewPage = () => {
  const summaries = useSiteSummaries();
  const roles = useSitePowerRoles();

  const overview = useMemo(() => fleetOverview(summaries, roles), [summaries, roles]);
  const estate = useMemo(() => estateSummary(summaries, roles), [summaries, roles]);

  const customerName = (id: string) =>
    CUSTOMERS.find((account) => account.id === id)?.name ?? id;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-3 pb-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-none font-semibold text-primary tabular-nums">
            {overview.siteCount}
          </span>
          <span className="text-sm text-secondary">
            {overview.siteCount === 1 ? 'site' : 'sites'}
          </span>
        </p>
        <p className="text-sm text-secondary">
          {overview.gensetCount} {overview.gensetCount === 1 ? 'genset' : 'gensets'} standing
        </p>
        <p
          className={cn(
            'text-sm',
            overview.needingAttention > 0 ? 'text-severity-warning' : 'text-severity-ok',
          )}
        >
          {overview.needingAttention === 0
            ? 'Whole estate clear'
            : `${overview.needingAttention} needing attention`}
        </p>
      </header>

      {overview.groups.map((group) => (
        <RoleSection key={group.role} group={group} />
      ))}

      <section aria-label="By customer" className="flex min-w-0 flex-col gap-2">
        <header>
          <h2 className="text-sm font-medium text-primary">By customer</h2>
          <p className="text-xs text-tertiary">Yards held, and the plant standing on them</p>
        </header>

        {/* A plain row of links rather than tiles: this is a directory, not a
            verdict, and giving it the same weight as the status grids would say the
            account matters as much as the fault. */}
        <div className="flex flex-wrap gap-2">
          {estate.byCustomer.map((tally) => (
            <Link
              key={tally.key}
              to="/sites"
              search={siteSearch({customer: tally.key})}
              title={customerName(tally.key)}
              className="flex items-baseline gap-1.5 rounded-md border border-subtle bg-element px-2.5 py-1.5 text-sm transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline"
            >
              <span className="text-secondary">{tally.label}</span>
              <span className="font-medium text-primary tabular-nums">{tally.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

/** Re-exported so the route file has one import. */
export type {FleetStatus};
