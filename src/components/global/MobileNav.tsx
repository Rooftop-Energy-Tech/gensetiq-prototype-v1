import {Link} from '@tanstack/react-router';
import {BoomBoxIcon, LayoutDashboardIcon, RadioTowerIcon, SunMediumIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

/**
 * The phone-width nav: a floating pill at the bottom of the screen.
 *
 * It replaces the 94px sidebar rather than reflowing it, because the sidebar is a
 * *rail* — seven destinations stacked vertically — and a phone has no vertical
 * space to spare for one. Floating rather than docked, and centred rather than
 * full-width, which is the shape RooftopIQ's own floating bars take (see its
 * `FilesBulkActionBar`): the page scrolls underneath it and the bar reads as a
 * control over the content instead of a piece of the frame.
 *
 * ## Three destinations, not seven
 *
 * Only the screens that have a mobile layout are here. `Energy`, `Meters`,
 * `Refuel` and `Settings` are desktop-only in this prototype, and a nav item that
 * lands on a screen laid out for 1,280px would be worse than no item at all — the
 * point of a limited bar is that everything it offers works. The report's
 * `Overall` and `Genset` tabs are the clearest case: each is a wide table whose
 * whole job is comparison down a column, and there is no phone-width form of that
 * worth offering.
 *
 * ## The bar points at one tab, not at the section
 *
 * `Solar` **is** here, and it links straight to `/report/solar` rather than to
 * `/report`. That is deliberate. `SectionTabs` hides its strip below `md` for the
 * same reason this bar is four items long, so a phone sent to `/report` would
 * land on the one report it cannot read with no way to reach the one it can.
 * Naming the tab in the link is what keeps the rule — offer no door the app
 * cannot open — true through a section whose other doors are shut.
 *
 * The short label survives the move: at this width it is the only solar screen on
 * offer, and the plant register at `/solar` is withheld because its system and
 * inverter pages have no phone layout. The report's cards are an `auto-fill` grid
 * that resolves to a single column at this width, and its charts were drawn for a
 * 44px slot, so the phone layout is the desktop one narrowed rather than a
 * desktop screen squeezed. Withholding it would have been withholding the screen
 * most likely to be opened by somebody standing at the foot of a tower.
 *
 * The routes themselves are untouched and still resolve if a URL is typed or
 * followed from a desktop link. What is withheld is *navigation to* them, which is
 * the honest version of "not built yet": the app does not offer a door it cannot
 * open properly.
 */
type MobileNavItem = {
  label: string;
  icon: LucideIcon;
  link: '/overview' | '/sites' | '/solar' | '/gensets';
  /**
   * The list's own default view state, for the two items that have one.
   *
   * Both list screens validate their search params, and a `Link` has to name the
   * whole object — the schema's defaults settle a URL that is *parsed*, not one that
   * is built — so each item says which view it opens. `list` in both cases, which at
   * this width is the only view either screen has. The overview takes none: it has
   * no view state to carry.
   */
  search?: {view: 'list'};
};

const ITEMS: Array<MobileNavItem> = [
  // The overview is here because it genuinely has a phone layout: its tiles are a
  // two-column grid at this width rather than a desktop screen squeezed. It is also
  // where `/` now lands, so leaving it out would strand a phone on a screen with no
  // way back to it.
  {label: 'Overview', icon: LayoutDashboardIcon, link: '/overview'},
  {label: 'Sites', icon: RadioTowerIcon, link: '/sites', search: {view: 'list'}},
  // The array register, which is where solar lives now that the report is gone.
  {label: 'Solar', icon: SunMediumIcon, link: '/solar'},
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
