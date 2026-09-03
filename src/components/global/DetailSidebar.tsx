import {Link} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import {ChevronRightIcon, RadioTowerIcon} from 'lucide-react';
import {useState} from 'react';
import type {ComponentType, ReactNode} from 'react';

import {cn} from '@/lib/utils';

/**
 * The second rail: a 240px navigation column for one *thing* — a site, or one
 * machine standing on it.
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
 * the header's job — a site's switches sites, a genset's goes *back* to its site —
 * and the item list. Both of those are props.
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

/** One row in the rail. `icon` is a lucide component, as everywhere else. */
export type DetailNavItem = {
  label: string;
  icon: ComponentType<{className?: string}>;
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
   * Matched exactly. The section's landing row needs it — `/sites/x` prefixes
   * every one of its children, so without it `Site` stays lit on `Alarms`.
   */
  end?: boolean;
};

/** A nested list under a row, which is what `Asset` is. */
export type DetailNavGroup = {
  label: string;
  icon: ComponentType<{className?: string}>;
  items: Array<DetailNavItem>;
};

export type DetailNavEntry = DetailNavItem | DetailNavGroup;

const isGroup = (entry: DetailNavEntry): entry is DetailNavGroup => 'items' in entry;

/**
 * The row's own styling, shared by rows and sub-rows so the two differ only in
 * height and indent — which is the only thing the design differs them by.
 */
const rowClassName =
  'flex w-full items-center gap-2 rounded-lg px-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary data-[status=active]:bg-highlight data-[status=active]:font-medium data-[status=active]:text-primary';

export const DetailSidebar = ({
  header,
  entries,
  ariaLabel,
}: {
  /** The block above the nav: a site switcher, or a genset's back-to-site card. */
  header: ReactNode;
  entries: ReadonlyArray<DetailNavEntry>;
  ariaLabel: string;
}) => (
  // Gone below `md`, the same call the main rail makes: none of these sections has
  // a phone layout, and `MobileNav` is the phone's answer to navigation.
  <aside className="hidden w-[240px] shrink-0 flex-col overflow-y-auto border-r border-subtle md:flex">
    <div className="shrink-0 p-2">{header}</div>

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
      // `includeSearch: false` throughout: the genset home page carries its alert
      // filter in the query string, and with the default a reader who picked a
      // severity chip would un-light the row they are standing on.
      activeOptions={{exact: item.end ?? false, includeSearch: false}}
      className={cn(rowClassName, className)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
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
 * worse than one that plainly opens a list.
 */
const DetailNavDisclosure = ({group}: {group: DetailNavGroup}) => {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(rowClassName, 'h-8 cursor-pointer')}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <ChevronRightIcon
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
          aria-hidden="true"
        />
      </button>

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
 * The way back to the site a machine stands at: the bordered card at the top of a
 * genset's or a system's rail.
 *
 * ## Why it is a card and not a row
 *
 * Because it is the one control in the rail that *leaves* the thing the rail is
 * about. Drawn as another 32px row it would read as a section of the machine, and
 * a reader would find themselves at a site page wondering what they clicked. The
 * border says "this is a different subject", which is exactly what it is.
 *
 * ## Why it exists at all
 *
 * A reader arrives here from a site — `Asset ▸ Genset` or `Asset ▸ Solar` in the
 * site's own rail — and the rail then swaps out from under them for the machine's
 * sections. Without this, going one level back up means the breadcrumb or the
 * browser's Back button, and neither is a *place*: the card names the site, so it
 * says both where you came from and where you are standing.
 *
 * The glyph is the sites rail's own. Using the icon that means "site" everywhere
 * else in the app is what says where this goes without a word of label.
 */
export const DetailSidebarBackCard = ({
  siteId,
  name,
  locationLabel,
}: {
  siteId: string;
  name: string;
  locationLabel: string;
}) => (
  <Link
    to="/sites/$siteId"
    params={{siteId}}
    className="flex items-center gap-2 rounded-lg border border-subtle p-2 transition-colors hover:bg-hover"
  >
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-sm font-semibold text-primary">{name}</span>
      <span className="truncate text-xs text-secondary">{locationLabel}</span>
    </span>
    <RadioTowerIcon className="size-5 shrink-0 text-secondary" aria-hidden="true" />
    <span className="sr-only">Back to {name}</span>
  </Link>
);

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
    <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
      {children}
    </span>
    {aside}
  </div>
);
