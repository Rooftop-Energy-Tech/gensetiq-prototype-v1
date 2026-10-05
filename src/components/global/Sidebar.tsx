import {Link, useNavigate} from '@tanstack/react-router';
import {
  BoomBoxIcon,
  FileDownIcon,
  FuelIcon,
  LogOutIcon,
  SettingsIcon,
  TruckIcon,
  WrenchIcon,
} from 'lucide-react';

import {NavButton} from '@/components/global/NavButton';
import type {NavItem} from '@/components/global/NavButton';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {sessionInitial, signOut, useSession} from '@/modules/auth/session';

import {BRAND} from '@/brands';

/**
 * The rail, and the one place this white-label's estate changes the order.
 *
 * Express Mission's plant **moves**. A set is trucked to a customer, stands there
 * for a job, and comes back — so the machine is the fact and the yard is only
 * where it happens to be standing this week. That makes **Gensets** the rail's
 * first destination and the app's landing screen: every question here starts at a
 * particular engine, and the estate's tallies ride in the card strip above the
 * rows rather than on a screen of their own.
 *
 * **Deployment** follows it, because on a fleet that moves "what is out, where,
 * and since when" is the next question after "what do we have" — and for the EM
 * proof of concept it is the question the product is being judged on.
 *
 * **Sites** was here, and on a mobile estate it was dropped: a yard on a fleet that
 * moves is somewhere plant was sent rather than a thing anyone asks about, and what
 * the register used to be asked, `/deployments` now answers properly. The site pages
 * themselves were removed on 2026-09-22 (see `TopNav`), so no estate offers it now.
 *
 * **Report** and **Overview** were destinations here and have both gone, for the
 * same reason one level apart: each restated figures a register already states.
 * What the estate is burning belongs on `/gensets`; what it counts belongs in that
 * screen's card strip. A destination whose whole job is to restate another screen
 * is one more place for two numbers to disagree.
 *
 * **Meters** and **Refuel** stood last, and were cut for a different reason again:
 * both were whole features rather than restatements, and both went to get the first
 * build's surface down to what one engineer can hold. Their design is written down
 * in GEN-24 and GEN-25 rather than lost.
 *
 * **Solar** and **Battery** were registers here until the product became the
 * genset line alone. A site hosts an engine; the array and the bank belong to
 * SolarIQ, and a rail offering them from this app would be claiming a surface it
 * does not have.
 */
const NAV_ITEMS: Array<NavItem> = [
  // First, and the app's landing screen: the plant register, which is the whole of
  // what this product puts anywhere. A row is one machine, and the seven tabs below
  // it are the same shape every detail page in the app has.
  {label: 'Gensets', icon: BoomBoxIcon, link: '/gensets'},
  // The dispatch feed: what is out, where, and since when. Fleet-wide like the
  // register above it, and next to it because it is the question you ask as soon as
  // you know what the fleet is.
  {label: 'Deployments', icon: TruckIcon, link: '/deployments'},
  // Diesel: the depot tanks, each checked against the gensets it supplied, and every
  // fill. Under the dispatch feed because a fill is dispatch too — the tanker rather
  // than the lorry — and because who needs fuel is a question you ask about machines
  // you already know are out.
  {label: 'Fuel', icon: FuelIcon, link: '/fuel'},
  // Which machines are due for a visit, and every visit on record — the genset's own
  // Service tab, fleet-wide, so a workshop can plan a week without opening each set.
  {label: 'Service', icon: WrenchIcon, link: '/service'},
  // The way out of the app. Not a fourth set of charts — every figure it exports is
  // already drawn on a screen above it — but the files those screens cannot hand
  // anybody: an invoice is settled in a spreadsheet. Last of the fleet-wide five,
  // because it is where a reader goes once they know what they want.
  {label: 'Reporting', icon: FileDownIcon, link: '/reporting'},
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const session = useSession();

  const handleSignOut = () => {
    signOut();
    void navigate({to: '/login'});
  };

  return (
    // Gone entirely below `md`, where `MobileNav` takes over. Not merely narrowed:
    // a rail of six destinations has no phone-width form, and the handful that
    // do have mobile layouts are the ones the floating bar offers.
    <aside className="hidden h-full w-[94px] flex-col items-center pt-2 md:flex">
      <div className="flex w-full items-center justify-center py-3.5">
        {/* Whatever of the customer's mark reads at 94px — which is a per-brand call,
            and the two brands here answer it differently. Express Mission's is a
            circular badge, square and legible at any size the rail could give it. The
            product's own is the IQ mark, cropped out of the wordmark because seven
            letters have no legible form at this width.

            Whichever it is, it wants a *dark* ground, because the rail always is one.
            EM's badge is dark green on transparent, so the rail is `#0A2723` — a shade
            off the badge's own ring rather than the ring itself, since a mark on its
            own colour has no silhouette.

            Both dimensions are set so the flex row cannot stretch it, and
            `object-contain` so a `markSize` that rounds off the artwork's own ratio
            letterboxes by half a pixel rather than squashing it.

            The mark is the way home, as a logo is on any site: it links to `/`
            rather than naming `/gensets`, so it lands wherever the front page does
            and follows it if that ever moves — `routes/index.tsx` is the one place
            that decides. */}
        <Link
          to="/"
          aria-label={`${BRAND.name} — home`}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <img
            src={BRAND.mark}
            alt=""
            width={BRAND.markSize.width}
            height={BRAND.markSize.height}
            className="block shrink-0 object-contain"
          />
        </Link>
      </div>

      {/* `min-h-0` and its own scroll. Without them the item list simply grows past the
          bottom of the aside and takes Settings and the sign-out avatar with it —
          at a 720px viewport the footer started 69px below the fold and neither
          control could be reached at all. Flex items floor at their content size
          unless told otherwise, so `flex-1` alone was never going to shrink this.
          The footer below is outside the scroller and stays put. */}
      <nav
        aria-label="Main"
        className="flex w-full min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-2"
      >
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.label} item={item} />
        ))}
      </nav>

      <div className="flex w-full flex-col items-center gap-4 px-2 py-3">
        <NavButton item={{label: 'Settings', icon: SettingsIcon, link: '/settings'}} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              // The brand colour, not the product's teal. On the brand's dark rail a
              // teal avatar was the one mark on screen belonging to neither the
              // customer nor the estate, and read as something the page forgot to
              // style.
              className="size-8 rounded-full bg-brand p-0 text-sm font-normal text-brand-text hover:bg-brand"
              onClick={handleSignOut}
              aria-label={`Sign out ${session?.email ?? ''}`.trim()}
            >
              {sessionInitial(session)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-1.5">
            <LogOutIcon className="size-3" aria-hidden="true" />
            Sign out
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};
