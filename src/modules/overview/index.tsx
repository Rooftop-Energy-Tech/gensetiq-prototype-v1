import {Link, useNavigate} from '@tanstack/react-router';
import {Suspense, lazy, useMemo} from 'react';

import {cn} from '@/lib/utils';
import {useIsCompact} from '@/lib/useIsCompact';
import {FLEET_STATUSES, STATUS_META} from '@/modules/genset/data/fleetStatus';
import type {StatusTone} from '@/modules/genset/data/fleetStatus';
import {CUSTOMERS} from '@/modules/site/data/customers';
import {estateSummary} from '@/modules/site/data/estateSummary';
import {fleetOverview} from '@/modules/site/data/fleetOverview';
import type {RoleGroup, StatusCell} from '@/modules/site/data/fleetOverview';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSearch} from '@/modules/site/types/view.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * `/overview` — the screen the app opens on, and an overview **of the estate**.
 *
 * It exists because the two list screens answered the wrong question first. A fleet
 * manager arriving in the morning is not looking for a genset; they are asking how
 * much of the estate is in trouble and which half of it. A list makes them read
 * twenty-four rows to find that out, and a map on its own makes them read pin
 * colours. So the counts come first and the lists become the way *in* to them.
 *
 * **Sites throughout.** Every headline figure here is a count of yards, because a
 * yard is what somebody drives to. Gensets appear as the second number on each tile
 * — two dry sets at one site is one journey and two jobs, and a site count alone
 * cannot say which of those you are looking at.
 *
 * Every number on this page is a link into `/sites` with the same cut applied, so
 * the drill-down is the list somebody already knows rather than a third screen. That
 * is also the discipline that keeps this page honest: there is no figure here whose
 * working the reader cannot go and look at.
 *
 * **At phone width the map is withheld and the tiles are the whole screen.** Not a
 * shrunken map: a 375px basemap of Malaysia puts Kapit and Kota Bharu within a
 * thumb's width of each other, so panning and pinching become the only way to read
 * it and the answer takes longer to get than the counts already gave. The counts are
 * what a phone is good for here — they stack two-up and lose nothing — and the map
 * is a desktop reading of the same data, so this follows the rule the list screens
 * already keep: the app offers no control it cannot honour at that size.
 *
 * Nothing is stored. See `fleetOverview` for the two groupings and why duty is the
 * outer one.
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

/**
 * `4` over `Tank empty`, over `2 gensets` — one tile, linked into the sites list.
 *
 * The figure is `text-primary` whatever it counts, and the dot beside the label is
 * the only coloured thing on it. A number set in its status colour reads as a
 * coloured number before it reads as a status, and eight of them in a grid is an
 * alert screen rather than a summary — see `SummaryCards.tsx`, which holds the same
 * line for the chips.
 */
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
        <p className="text-xs text-secondary">
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

  const overview = useMemo(() => fleetOverview(summaries, roles), [summaries, roles]);
  const estate = useMemo(() => estateSummary(summaries, roles), [summaries, roles]);

  const customerName = (id: string) =>
    CUSTOMERS.find((account) => account.id === id)?.name ?? id;

  /**
   * A pin has nowhere to put a link, so clicking one hands off to the screen that
   * knows how to show a site: the sites list, with that yard selected and its
   * preview panel open.
   *
   * Deliberately not straight to `/sites/$siteId`. A click on a map is a *look at
   * this one* rather than a decision to leave the overview behind, and the preview
   * keeps the surrounding estate on screen with a way into the full page from there
   * — the same call the two list screens already make about their own pins.
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
            {overview.siteCount}
          </span>
          <span className="text-sm text-secondary">
            {overview.siteCount === 1 ? 'site' : 'sites'}
          </span>
        </p>
        <p className="text-sm text-secondary">
          {overview.gensetCount} {overview.gensetCount === 1 ? 'genset' : 'gensets'} standing
        </p>
        <p className="text-sm text-secondary">
          {overview.needingAttention === 0
            ? 'All sites clear'
            : `${overview.needingAttention} needing attention`}
        </p>
      </header>

      {overview.groups.map((group) => (
        <RoleSection key={group.role} group={group} />
      ))}

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
          past the viewport. 26rem is enough for the peninsula to read at the zoom
          the estate fits into.
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
