import {Outlet} from '@tanstack/react-router';
import {
  BellIcon,
  BoomBoxIcon,
  ComponentIcon,
  LandPlotIcon,
  SettingsIcon,
} from 'lucide-react';

import {DetailSidebar} from '@/components/global/DetailSidebar';
import type {DetailNavEntry, DetailNavItem} from '@/components/global/DetailSidebar';
import {fromSite} from '../types/fromSearch.type';
import type {SiteSummary} from '../data/sites';
import {SiteSwitcher} from './SiteSwitcher';

/**
 * Everything one site's pages share: the 240px rail on the left, and an
 * `<Outlet />` beside it.
 *
 * ## What replaced the tab strip, and why
 *
 * Five tabs across the top of the page, over a header carrying the site's name,
 * its placename and an info tooltip. The design replaces all of it with four rows
 * in a rail, and the reason is the `Asset` group: the plant standing on this site
 * is now a *section of the navigation* rather than a row you have to scroll to the
 * bottom of the home page to click. A horizontal strip cannot nest, so this could not
 * have been done to the old header at any width.
 *
 * The header's info tooltip went with it, and nothing was lost. It carried Load,
 * Supply, genset count, installed capacity and fuel on site — the first three are
 * now a band on the page itself (see `SiteHome`), and the rest are in the metric
 * strip and the device rows. A hover that restated visible figures was the weakest
 * part of the old header.
 *
 * Two of the five tabs did not survive the move either. `Runs` and `Contract` keep
 * their routes and their pages — `/sites/<id>/runs` and `/sites/<id>/contract`
 * still resolve, so a bookmark on one keeps working — but the design draws four
 * rows and they are not among them, so nothing links to them now. Each is one
 * entry in `navEntries` if they are wanted back.
 *
 * ## Why the rail is here and not in `AuthenticatedLayout`
 *
 * Because it is *this site's* rail. It is scoped to the section the way the tab
 * strip it replaces was, so it mounts and unmounts with the section rather than
 * being a permanent column every other screen has to explain away.
 *
 * Structurally still a twin of `GensetDetailShell`, which is the point — the two
 * rails share `DetailSidebar` and differ only in their header and their items.
 */

/**
 * The `Asset` group: only the plant this yard actually has.
 *
 * The design draws three rows, at a site that has all three. Drawing them
 * everywhere would put a `Solar` link on a diesel-prime yard with no array — a
 * door onto a page that can only say "nothing fitted", which is the mistake the
 * metric strip and the device rows both go out of their way to avoid.
 *
 * `Cabinet` is a fourth, and it is the one that is *rarest* rather than the one that
 * is commonest — which is the opposite of what the hardware would suggest. Every
 * telecom site has a DC power plant; only the site with a **monitoring unit** has a
 * shelf whose module count and rating are known rather than sized from the load, and
 * `cabinet.type.ts` argues why a sized shelf would be the wrong kind of number to
 * build a page on. So the row appears at one site of twenty-five, and it appears
 * *last*: the three above it are what a reader came for, and the cabinet is what
 * they open once one of those has sent them looking for a rectifier.
 *
 * `Genset` goes to the **lead** set. `summary.gensets` is attention-ordered, so at
 * a multi-set yard that is the one turning, or the sickest if none is — the same
 * set the device row at the bottom of the home page shows, for the same reason.
 * The rest of the yard is reachable from that row's "see all plant"; a rail that
 * listed four engines would be an inventory, which is what `/gensets` is for.
 */
const assetItems = (summary: SiteSummary): Array<DetailNavItem> => {
  const lead = summary.gensets[0];
  const items: Array<DetailNavItem> = [];

  if (lead !== undefined) {
    items.push({
      label: 'Genset',
      icon: BoomBoxIcon,
      to: '/gensets/$gensetId',
      params: {gensetId: lead.genset.id},
      search: fromSite(summary.site.id),
      end: true,
    });
  }

  return items;
};

const navEntries = (summary: SiteSummary): Array<DetailNavEntry> => {
  const params = {siteId: summary.site.id};
  const assets = assetItems(summary);

  return [
    // `end` on this row alone: `/sites/x` prefixes every route below it, so
    // without an exact match the landing row stays lit on all of them.
    {label: 'Site', icon: LandPlotIcon, to: '/sites/$siteId', params, end: true},
    {label: 'Alarms', icon: BellIcon, to: '/sites/$siteId/alarms', params},
    // Dropped rather than drawn empty at a site with nothing fitted: `Asset ▸`
    // opening onto an empty list is a worse answer than not offering it.
    ...(assets.length === 0
      ? []
      : [{label: 'Asset', icon: ComponentIcon, items: assets} as const]),
    {label: 'Settings', icon: SettingsIcon, to: '/sites/$siteId/settings', params},
  ];
};

export const SiteDetailShell = ({summary}: {summary: SiteSummary}) => {

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DetailSidebar
        ariaLabel="Site sections"
        header={<SiteSwitcher site={summary.site} />}
        entries={navEntries(summary)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* The phone's replacement for the rail's header, and only that — the rail
            itself has no phone form, so at that width the site's name and placename
            would otherwise be nowhere on the page. The genset shell needs no
            equivalent: its title row is drawn at every width. */}
        <div className="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-2 md:hidden">
          <h1 className="truncate text-base font-medium text-primary">
            {summary.site.name}
          </h1>
          <p className="truncate text-sm text-secondary">{summary.site.locationLabel}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
