import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {ChevronRightIcon} from 'lucide-react';
import {useState} from 'react';
import type {ComponentType, ReactNode} from 'react';

import {cn} from '@/lib/utils';

/**
 * The second rail: a 240px navigation column for one *thing* — a genset, a
 * deployment, or a section such as Service or Fuel.
 *
 * It was written for a site and the machines standing on it; the site pages went on
 * 2026-09-22, and with them the only caller of `group` (the `Asset` disclosure) and
 * `backLink`. Both stay supported, and `group` has a caller again: the Fuel rail's
 * depots under *Depot tanks* (2026-10-05). The history below is from then.
 *
 * ## Why a rail rather than the tab strip it replaces
 *
 * Because the strip had run out of room and, worse, out of levels. A site's
 * sections were five tabs across the top; the plant standing on that site was
 * reachable only by scrolling to the device rows at the bottom of the home page
 * and clicking a name. So the two things an operator does here — *change section*
 * and *go to a machine* — were being answered by two completely different
 * gestures at opposite ends of the page.
 *
 * A vertical rail answers both with one list, because a list can nest and a strip
 * cannot. `Asset ▸ Genset / Solar / Battery` is a section of the same nav that
 * holds `Site` and `Alarms`, so the plant is a place you can go rather than
 * something you have to find. That is the whole reason the design moved it.
 *
 * ## Why it is shared between sites and gensets
 *
 * The two frames draw the same component with different content: a 240px column,
 * a header block naming what you are looking at, then 32px rows. What differs is
 * the header's job — a site's switches sites, a machine's simply says which machine
 * — whether there is a way back out above the rows, and the item list. All three
 * are props.
 *
 * Keeping one file means the geometry is stated once. The alternative was two
 * shells that agree about 240px, 32px rows and a 24px sub-indent by coincidence,
 * and the first time one of them was nudged the two sections would stop looking
 * like one app.
 *
 * ## Geometry
 *
 * The design's, which is shadcn's `Sidebar` — 240px wide, 8px padding everywhere,
 * 32px item rows, 28px sub rows, and the sub list inset 24px behind a hairline at
 * 16px. Sizes are literal here rather than derived, because they are the design's
 * measurements and nothing in the app computes them.
 */

/**
 * One row in the rail. `icon` is a lucide component, as everywhere else. Only a
 * sub-row may go without one — the Fuel rail's depots, which are names under
 * *Depot tanks* rather than sections of their own.
 */
export type DetailNavItem = {
  label: string;
  icon?: ComponentType<{className?: string}>;
  to: LinkProps['to'];
  /**
   * Path params for `to`.
   *
   * A plain record, and cast at the `<Link>`. `to` here is the union of every
   * route in the app, so the router has nothing to narrow the params against and
   * its own type resolves to a reducer over "no params". Each rail builds its
   * items from its own route's params one file away, which is where a typo would
   * actually be caught.
   */
  params?: Record<string, string>;
  /**
   * Search params for `to`, typed as loosely as `params` is and for the same reason.
   *
   * The Service rail passes its tab and sort. The site rail, now gone, passed `from`
   * so an asset opened there crumbed back to its site — see `fromSearch.type.ts`.
   */
  search?: Record<string, string>;
  /**
   * Matched exactly. The section's landing row needs it — `/sites/x` prefixes
   * every one of its children, so without it `Site` stays lit on `Alarms`.
   */
  end?: boolean;
  /**
   * Light the row only when the URL carries this row's `search` as well as its
   * path. For rails whose rows share one route and differ by a query key — the
   * fleet service page's `Due` and `History`, which are `?tab=`.
   */
  matchSearch?: boolean;
};

/** A nested list under a row, which is what `Asset` is. */
export type DetailNavGroup = {
  label: string;
  icon: ComponentType<{className?: string}>;
  items: Array<DetailNavItem>;
  /**
   * Where the row itself goes, for a group that is also a page — the Fuel rail's
   * *Depot tanks*, the tab its depots are listed under (2026-10-05). The row is
   * then a link, and the chevron beside it a button of its own that folds the
   * list. Without it the whole row is the fold, as `Asset`'s was.
   */
  link?: Omit<DetailNavItem, 'label' | 'icon'>;
};

export type DetailNavEntry = DetailNavItem | DetailNavGroup;

const isGroup = (entry: DetailNavEntry): entry is DetailNavGroup => 'items' in entry;

/**
 * The row's own styling, shared by rows and sub-rows so the two differ only in
 * height and indent — which is the only thing the design differs them by.
 */
// Icons 17.6px and labels 15.4px (2026-09-30, on request: 10% over the design's
// 16px and 14px), so every rail reads at the same larger size. The size is on each
// label (`LABEL`) rather than here: `cn` reads `text-secondary` as a font size and
// would drop a `text-[15.4px]` beside it.
export const LABEL = 'text-[15.4px] leading-6';

export const rowClassName =
  'flex w-full items-center gap-2 rounded-lg px-2 text-secondary transition-colors hover:bg-hover hover:text-primary data-[status=active]:bg-highlight data-[status=active]:font-medium data-[status=active]:text-primary';

export const DetailSidebar = ({
  header,
  backLink,
  entries,
  ariaLabel,
}: {
  /** The block above the nav: a site switcher, or the name of the thing you are on. */
  header: ReactNode;
  /**
   * The way back out of this thing, on the rails that have one — a machine's
   * return to the site it stands at.
   *
   * Its own slot rather than part of `header`, because the design puts it in its
   * own band: the header's 8px padding closes above it, and the row sits flush
   * against the nav below. No rail passes one today.
   */
  backLink?: ReactNode;
  entries: ReadonlyArray<DetailNavEntry>;
  ariaLabel: string;
}) => (
  // Gone below `md`, the same call the main rail makes: none of these sections has
  // a phone layout, and `MobileNav` is the phone's answer to navigation.
  <aside className="hidden w-[240px] shrink-0 flex-col overflow-y-auto border-r border-subtle md:flex">
    <div className="shrink-0 p-2">{header}</div>

    {/* `px-2` and no vertical padding: the row is 32px and the design butts it
        straight up against the nav, so the only gap above it is the header's own
        bottom padding. */}
    {backLink !== undefined && <div className="shrink-0 px-2">{backLink}</div>}

    <nav aria-label={ariaLabel} className="flex flex-col gap-0 p-2">
      {entries.map((entry) =>
        isGroup(entry) ? (
          <DetailNavDisclosure key={entry.label} group={entry} />
        ) : (
          <DetailSidebarLink key={entry.label} item={entry} className="h-8" />
        ),
      )}
    </nav>
  </aside>
);

const DetailSidebarLink = ({
  item,
  className,
}: {
  item: DetailNavItem;
  className: string;
}) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      params={item.params as LinkProps['params']}
      // An item's own search where it sets one — the site's asset rows, which
      // introduce `from`. Otherwise **`from` alone, carried forward**, and the word
      // alone is the whole of it: these tabs deliberately drop the rest of the query
      // string, and a reader who walked in from a site has to keep walking the trail
      // they arrived on. Without this, moving from a set's home to its Runs tab drops
      // the site out of the breadcrumb mid-section and the crumb springs back to the
      // fleet register the reader never visited. See `fromSearch.type.ts`.
      search={
        ((prev: Record<string, unknown>) => {
          if (item.search !== undefined) return item.search;
          const {from} = prev as {from?: string};
          return from === undefined ? {} : {from};
        }) as unknown as LinkProps['search']
      }
      // `includeSearch: false` throughout: the genset home page carries its alert
      // filter in the query string, and with the default a reader who picked a
      // severity chip would un-light the row they are standing on.
      activeOptions={{exact: item.end ?? false, includeSearch: item.matchSearch ?? false}}
      className={cn(rowClassName, className)}
    >
      {Icon !== undefined && <Icon className="size-[17.6px] shrink-0" aria-hidden="true" />}
      <span className={cn(LABEL, 'min-w-0 flex-1 truncate text-left')}>{item.label}</span>
    </Link>
  );
};

/**
 * `Asset`, expanded.
 *
 * Open by default and collapsible, because the group is the reason the rail
 * exists — a reader arriving at a site should see that its genset is one click
 * away, not have to discover a disclosure to find out. The chevron is there for
 * the reader who wants the section list short, not as a gate on the plant.
 *
 * A `<button>` rather than a link: `Asset` is not a page. Nothing in this app is
 * "the assets of a site" as a destination — the device rows at the bottom of the
 * home page are that — so a row that navigated nowhere in particular would be
 * worse than one that plainly opens a list. A group that *is* a page says so with
 * `link`: the row becomes that link, and the chevron alone folds the list, sitting
 * where the whole row's chevron would.
 */
const DetailNavDisclosure = ({group}: {group: DetailNavGroup}) => {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;
  const chevron = (
    <ChevronRightIcon
      className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
      aria-hidden="true"
    />
  );

  return (
    <div className="flex flex-col">
      {group.link === undefined ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className={cn(rowClassName, 'h-8 cursor-pointer')}
        >
          <Icon className="size-[17.6px] shrink-0" aria-hidden="true" />
          <span className={cn(LABEL, 'min-w-0 flex-1 truncate text-left')}>{group.label}</span>
          {chevron}
        </button>
      ) : (
        // `pr-8` keeps the label clear of the chevron, and `right-1` with a 24px
        // button puts the chevron 8px in, where the plain disclosure's sits.
        <div className="relative">
          <DetailSidebarLink item={{...group.link, label: group.label, icon: Icon}} className="h-8 pr-8" />
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={open ? `Hide ${group.label}` : `Show ${group.label}`}
            className="absolute inset-y-0 right-1 my-auto flex size-6 cursor-pointer items-center justify-center rounded-md text-tertiary outline-none hover:bg-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
          >
            {chevron}
          </button>
        </div>
      )}

      {open && (
        // The design's inset: a hairline at 16px with the rows starting at 24px,
        // which is what says these belong to the row above rather than sitting
        // beside it. 2px of vertical padding keeps the line from butting into the
        // parent row's rounded corner.
        <div className="ml-4 flex flex-col gap-1 border-l border-subtle py-0.5 pl-2">
          {group.items.map((item) => (
            <DetailSidebarLink key={item.label} item={item} className="h-7" />
          ))}
        </div>
      )}
    </div>
  );
};


/**
 * The label above a nav list that names what the list is *about* — the genset's
 * own tag, on the genset rail.
 *
 * Sized as a 30px header row rather than a 32px nav row, and not interactive: it
 * is a caption, and giving it a hover state would invite a click that goes
 * nowhere. `aside` carries the info glyph the old header tooltip held.
 */
export const DetailSidebarLabel = ({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) => (
  <div className="flex h-[30px] w-full items-center gap-2 px-2">
    <span className="min-w-0 flex-1 truncate text-[15.4px] font-medium text-primary">
      {children}
    </span>
    {aside}
  </div>
);
