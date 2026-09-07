import {Link} from '@tanstack/react-router';
import {BoomBoxIcon, RadioTowerIcon, SunMediumIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

/**
 * The phone-width nav: a floating pill at the bottom of the screen.
 *
 * It replaces the 94px sidebar rather than reflowing it, because the sidebar is a
 * *rail* — six destinations stacked vertically — and a phone has no vertical
 * space to spare for one. Floating rather than docked, and centred rather than
 * full-width, which is the shape RooftopIQ's own floating bars take (see its
 * `FilesBulkActionBar`): the page scrolls underneath it and the bar reads as a
 * control over the content instead of a piece of the frame.
 *
 * ## Three destinations, not six
 *
 * Only the screens that have a mobile layout are here. `Settings` is desktop-only in
 * this prototype, and a nav item that lands on a screen laid out for 1,280px would be
 * worse than no item at all — the point of a limited bar is that everything it offers
 * works.
 *
 * ## Why the three are the three
 *
 * Each is a **register** — a list, which is the one shape that reads at 390px.
 * Everything below a register is a detail page with a 240px rail beside it, and
 * the rail has no phone form at all (see `DetailSidebar`): a phone sent to
 * `/solar/kdh-0431` gets the page but not its six sections. That is acceptable for
 * a page you arrive at from a list you tapped; it would not be acceptable as a
 * destination the bar offered directly.
 *
 * `Battery` is the one register not on the bar, and it is a judgement rather than
 * a rule: five items is where a bar of this width starts squeezing labels, and of
 * the five registers storage is the one whose page nobody opens standing at the
 * foot of a tower. It is one tap away through the site.
 *
 * The routes themselves are untouched and still resolve if a URL is typed or
 * followed from a desktop link. What is withheld is *navigation to* them, which is
 * the honest version of "not built yet": the app does not offer a door it cannot
 * open properly.
 */
type MobileNavItem = {
  label: string;
  icon: LucideIcon;
  link: '/sites' | '/solar' | '/gensets';
  /**
   * The list's own default view state.
   *
   * All three screens validate their search params, and a `Link` has to name the
   * whole object — the schema's defaults settle a URL that is *parsed*, not one that
   * is built — so each item says which view it opens. `list` in every case, which at
   * this width is the only view any of them has.
   *
   * `/solar` used to take none, because its register had no view state to carry. It
   * has all three views now, so it names the same one its neighbours do.
   */
  search: {view: 'list'};
};

const ITEMS: Array<MobileNavItem> = [
  // First, and where `/` now lands. Its card strip is the estate's tallies, folded
  // away by default at this width — see `SummaryCollapseButton` — so the phone gets
  // the list first and the summary on request.
  {label: 'Sites', icon: RadioTowerIcon, link: '/sites', search: {view: 'list'}},
  // The array register, which is where solar lives now that the report is gone.
  {label: 'Solar', icon: SunMediumIcon, link: '/solar', search: {view: 'list'}},
  {label: 'Gensets', icon: BoomBoxIcon, link: '/gensets', search: {view: 'list'}},
];

export const MobileNav = () => (
  <nav
    aria-label="Main"
    // `fixed`, so it holds still while the list behind it scrolls. Inset from the
    // bottom by 4 plus the safe-area inset, which is what keeps it clear of the
    // home indicator on a notched phone rather than sitting under it.
    className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-subtle bg-element/95 p-1.5 shadow-lg backdrop-blur-sm md:hidden"
  >
    {ITEMS.map((item) => {
      const Icon = item.icon;

      return (
        <Link
          key={item.label}
          to={item.link}
          search={item.search}
          // `exact: false` so a genset's own page keeps `Gensets` lit. The detail
          // routes are siblings of the list rather than children — see `TopNav` —
          // so this is matched on the path prefix and `/gensets/brf9540` counts.
          activeOptions={{exact: false, includeSearch: false}}
          className="group flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-secondary transition-colors data-[status=active]:bg-highlight data-[status=active]:text-primary"
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {/* Four destinations with four labels overflow a 375px screen, and the
              fourth was clipped by the bezel. Below 400px only the item you are
              standing on is named: the other three are a glyph each, which is
              enough to aim at and is what a phone tab bar does anyway. The name
              is still in the accessible label at every width. */}
          <span className="hidden group-data-[status=active]:inline min-[400px]:inline">
            {item.label}
          </span>
          <span className="sr-only">{item.label}</span>
        </Link>
      );
    })}
  </nav>
);
