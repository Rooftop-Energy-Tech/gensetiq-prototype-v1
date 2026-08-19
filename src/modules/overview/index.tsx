import {Link, useNavigate} from '@tanstack/react-router';
import {Suspense, lazy, useMemo, useState} from 'react';
import {FuelIcon, TruckIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {useIsCompact} from '@/lib/useIsCompact';
import {allDeployments} from '@/modules/genset/data/deployments';
import {FLEET_STATUSES, STATUS_META, gensetStatus} from '@/modules/genset/data/fleetStatus';
import type {FleetStatus, StatusTone} from '@/modules/genset/data/fleetStatus';
import {REFUEL_ORDERS} from '@/modules/genset/data/refuelOrders';
import {CUSTOMERS} from '@/modules/site/data/customers';
import {estateSummary, siteStatus} from '@/modules/site/data/estateSummary';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSearch} from '@/modules/site/types/view.type';

/**
 * `/overview` — the screen the app opens on, and an overview **of a mobile fleet**.
 *
 * It exists because the two list screens answered the wrong question first. A fleet
 * manager arriving in the morning is asking three things, in order: *is everything
 * that is out there working*, *what is out there and where*, and *what does today's
 * tanker run owe*. A list makes them read thirty-seven rows to find that out.
 *
 * So the page is those three questions, as three bands: **readiness** (the four
 * worst-wins buckets across the whole fleet), **the dispatch position** (postings
 * open, the record behind them, the refuel orders outstanding), and **where** (the map).
 * The stationary product cuts readiness by how each yard is fed — standby against
 * an incomer, prime with none — but for a fleet whose machines *move*, the posting
 * is the organising fact and the duty split is a site detail, read on the site's
 * own page.
 *
 * **Sites in the readiness tiles.** A yard is what somebody drives to. The genset
 * figure sits under it because two dry sets at one site is one journey and two
 * jobs, and a site count alone cannot say which of those you are looking at.
 *
 * Every number on this page is a link into the screen that shows its working —
 * `/sites` for the buckets, `/deployment` and `/refuel` for the dispatch band —
 * so there is no figure here the reader cannot go and check.
 *
 * **At phone width the map is withheld and the tiles are the whole screen.** Not a
 * shrunken map: a 375px basemap of Sabah puts Semporna and Kudat within a thumb's
 * width of each other, so panning and pinching become the only way to read it. The
 * counts are what a phone is good for here.
 */

/** The same split the list screens make — MapLibre is not worth the first paint. */
const SitesMap = lazy(() =>
  import('@/modules/site/components/SitesMap').then((module) => ({default: module.SitesMap})),
);

/** Tone → the dot's colour. Nothing else on this page takes a status colour. */
const TONE_DOT: Record<StatusTone, string> = {
  critical: 'bg-severity-critical',
  fuel: 'bg-fuel',
  'fuel-low': 'bg-fuel-tip',
  ok: 'bg-severity-ok',
};

type StatusCell = {
  status: FleetStatus;
  siteCount: number;
  /** Sets at those sites that are *themselves* in the bucket — the work waiting. */
  gensetCount: number;
};

/**
 * `4` over `Tank empty`, over `2 gensets` — one tile, linked into the sites list.
 *
 * The figure is `text-primary` whatever it counts, and the dot beside the label is
 * the only coloured thing on it. A number set in its status colour reads as a
 * coloured number before it reads as a status, and four of them in a grid is an
 * alert screen rather than a summary.
 */
const StatusTile = ({cell}: {cell: StatusCell}) => {
  const meta = STATUS_META[cell.status];
  const none = cell.siteCount === 0;

  return (
    <Link
      to="/sites"
      search={siteSearch({status: cell.status})}
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
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            none ? 'bg-tertiary' : TONE_DOT[meta.tone],
          )}
          aria-hidden="true"
        />
        <span className="truncate text-xs font-medium text-secondary">{meta.label}</span>
      </span>
      <span
        className={cn(
          'text-2xl leading-none font-semibold tabular-nums',
          none ? 'text-tertiary' : 'text-primary',
        )}
      >
        {cell.siteCount}
      </span>
      <span className="truncate text-xs text-secondary">
        {cell.siteCount === 1 ? 'site' : 'sites'}
        {cell.gensetCount > 0 &&
          ` · ${cell.gensetCount} ${cell.gensetCount === 1 ? 'genset' : 'gensets'}`}
      </span>
    </Link>
  );
};

/**
 * One dispatch figure, linked to the page that holds its record.
 *
 * The same tile grammar as the readiness grid — number, label, detail line — so
 * the two bands read as one page. No status dot: these are counts of work in
 * hand, not verdicts, and a colour would rank what is only a tally.
 */
const DispatchTile = ({
  to,
  icon: Icon,
  label,
  value,
  detail,
}: {
  to: '/deployment' | '/refuel';
  icon: typeof TruckIcon;
  label: string;
  value: string;
  detail: string;
}) => (
  <Link
    to={to}
    className={cn(
      'flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5 transition-colors outline-none',
      'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
    )}
  >
    <span className="flex items-center gap-1.5">
      <Icon className="size-3 shrink-0 text-tertiary" aria-hidden="true" />
      <span className="truncate text-xs font-medium text-secondary">{label}</span>
    </span>
    <span className="text-2xl leading-none font-semibold text-primary tabular-nums">{value}</span>
    <span className="truncate text-xs text-secondary">{detail}</span>
  </Link>
);

/**
 * The colour key for the map.
 *
 * Needed here where the sites list does not need one, because the list draws its
 * verdict as a labelled badge in every row — the pin colour is a second reading of
 * something already in words. On this page the map is the only place the four
 * buckets appear as colour alone.
 */
const MapLegend = () => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {FLEET_STATUSES.map((status) => {
      const meta = STATUS_META[status];
      return (
        <li key={status} className="flex items-center gap-1.5 text-xs text-secondary">
          <span
            className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[meta.tone])}
            aria-hidden="true"
          />
          {meta.label}
        </li>
      );
    })}
  </ul>
);

export const OverviewPage = () => {
  const summaries = useSiteSummaries();
  const roles = useSitePowerRoles();
  const navigate = useNavigate();
  const compact = useIsCompact();
  const [now] = useState(() => Date.now());

  const estate = useMemo(() => estateSummary(summaries, roles), [summaries, roles]);

  // The four buckets, across the whole fleet. Worst-wins and exhaustive — see
  // `fleetStatus.ts` — so the tiles add up to the estate rather than
  // double-counting a yard into two jobs.
  const cells: Array<StatusCell> = useMemo(
    () =>
      FLEET_STATUSES.map((status) => {
        const sites = summaries.filter((summary) => siteStatus(summary) === status);
        return {
          status,
          siteCount: sites.length,
          gensetCount: sites.reduce(
            (running, summary) =>
              running +
              summary.gensets.filter(({genset}) => gensetStatus(genset) === status).length,
            0,
          ),
        };
      }),
    [summaries],
  );

  const gensetCount = summaries.reduce((running, summary) => running + summary.gensets.length, 0);
  const needingAttention = summaries.filter((summary) => siteStatus(summary) !== 'OK').length;

  // The dispatch position, from the same records its two pages list.
  const deployments = useMemo(() => allDeployments(), []);
  const ongoing = deployments.filter((deployment) => deployment.endedAt === null);
  const completed = deployments.length - ongoing.length;
  const WEEK = 7 * 24 * 3_600_000;
  const movedThisWeek = ongoing.filter(
    (deployment) => now - new Date(deployment.startedAt).getTime() <= WEEK,
  ).length;
  const outstandingOrders = REFUEL_ORDERS.filter((order) => order.refueledAt === null);
  const litresOwed = outstandingOrders.reduce((sum, order) => sum + order.litres, 0);

  const customerName = (id: string) =>
    CUSTOMERS.find((account) => account.id === id)?.name ?? id;

  /**
   * A pin has nowhere to put a link, so clicking one hands off to the screen that
   * knows how to show a site: the sites list, with that yard selected and its
   * preview panel open.
   */
  const openSite = (siteId: string) => {
    void navigate({to: '/sites', search: siteSearch({id: siteId, panel: true})});
  };

  return (
    // `pb-24` below `md`: `MobileNav` is a *floating* pill rather than a docked bar,
    // so the page scrolls underneath it and the last row of content would otherwise
    // finish behind it. The desktop padding is restored the moment the rail returns.
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-3 pb-24 md:pb-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-none font-semibold text-primary tabular-nums">
            {gensetCount}
          </span>
          <span className="text-sm text-secondary">
            {gensetCount === 1 ? 'genset' : 'gensets'}
          </span>
        </p>
        <p className="text-sm text-secondary">
          {ongoing.length} deployed across {summaries.length}{' '}
          {summaries.length === 1 ? 'site' : 'sites'}
        </p>
        <p className="text-sm text-secondary">
          {needingAttention === 0
            ? 'All sites clear'
            : `${needingAttention} sites needing attention`}
        </p>
      </header>

      <section aria-label="Readiness" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Readiness</h2>
          <p className="text-xs text-tertiary">
            Every deployed set, by what needs doing. Worst wins, so the four tiles
            add up to the fleet
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cells.map((cell) => (
            <StatusTile key={cell.status} cell={cell} />
          ))}
        </div>
      </section>

      <section aria-label="Dispatch" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Dispatch</h2>
          <p className="text-xs text-tertiary">
            What is out, what has moved, and what the tanker run owes
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DispatchTile
            to="/deployment"
            icon={TruckIcon}
            label="Deployed now"
            value={String(ongoing.length)}
            detail={
              movedThisWeek === 0
                ? 'none moved this week'
                : `${movedThisWeek} moved this week`
            }
          />
          <DispatchTile
            to="/deployment"
            icon={TruckIcon}
            label="Completed deployments"
            value={String(completed)}
            detail="last 60 days"
          />
          <DispatchTile
            to="/refuel"
            icon={FuelIcon}
            label="Refuel order outstanding"
            value={String(outstandingOrders.length)}
            detail={`${litresOwed.toLocaleString('en-MY')} L to deliver`}
          />
          <DispatchTile
            to="/refuel"
            icon={FuelIcon}
            label="Refuels completed"
            value={String(REFUEL_ORDERS.length - outstandingOrders.length)}
            detail="last 60 days"
          />
        </div>
      </section>

      {!compact && (
      <section aria-label="Where the sites are" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h2 className="text-sm font-medium text-primary">Where they are</h2>
            <p className="text-xs text-tertiary">
              One pin per site, coloured by what needs doing and sized by the plant on it
            </p>
          </div>
          <MapLegend />
        </header>

        {/*
          A fixed height rather than the remaining space: this page scrolls, and a
          map told to fill a scrolling column either collapses to nothing or grows
          past the viewport. 26rem is enough for Sabah to read at the zoom the
          estate fits into.
        */}
        <div className="h-[26rem] overflow-hidden rounded-md border border-subtle bg-element">
          <Suspense
            fallback={
              <div className="flex size-full items-center justify-center text-sm text-secondary">
                Loading map…
              </div>
            }
          >
            <SitesMap
              summaries={summaries}
              selectedId={undefined}
              onSelect={openSite}
              panelInset={0}
              colorBy="status"
            />
          </Suspense>
        </div>
      </section>
      )}

      <section aria-label="By zone" className="flex min-w-0 flex-col gap-2">
        <header>
          <h2 className="text-sm font-medium text-primary">By zone</h2>
          <p className="text-xs text-tertiary">Sites held, and the plant standing on them</p>
        </header>

        {/* A plain row of links rather than tiles: this is a directory, not a
            verdict, and giving it the same weight as the status grids would say the
            zone matters as much as the fault. */}
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
