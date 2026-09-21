import {useNavigate} from '@tanstack/react-router';
import {BoomBoxIcon, LogOutIcon, RadioTowerIcon, SettingsIcon, TruckIcon} from 'lucide-react';

import {NavButton} from '@/components/global/NavButton';
import type {NavItem} from '@/components/global/NavButton';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {sessionInitial, signOut, useSession} from '@/modules/auth/session';

import {BRAND} from '@/brands';

/**
 * The rail, and the one place this white-label's estate changes the order.
 *
 * The mobile-fleet build put **Deployment** second and **Sites** fourth, because
 * for plant that moves the posting is the fact about a machine and a yard is only
 * where it happens to be standing this week. This estate is the other way round: a
 * tower site is a permanent installation, its genset is bolted to a plinth beside
 * it, and nobody asks where a set has been sent. So **Sites leads** — the site is
 * the asset, and the plant on it is a property of the site — and Deployment is
 * gone rather than demoted, because a destination nobody visits is worse than one
 * that isn't there.
 *
 * **Report** stood in the slot it left and has since been removed with it. It was
 * one destination over three tabs, and every figure on it was a second reading of
 * something a register already states. What the estate is burning belongs on
 * `/gensets`. A destination whose whole job is to restate other screens is one
 * more place for two numbers to disagree.
 *
 * **Overview** led the rail and has gone the same way, for the same reason applied
 * one level up. It counted the estate; `/sites` lists it and now carries those
 * tallies in the card strip above the rows — so the figure it alone held, service
 * due, moved into that strip and the destination went. A screen that counts what
 * the next screen lists is one navigation nobody needs.
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
 *
 * ## Counting, then the fleet
 *
 * The rail is one destination that *counts and lists the estate* — Sites — over
 * the one that *lists its plant*: Gensets, the only thing this product bolts to a
 * site.
 */
const NAV_ITEMS: Array<NavItem> = [
  // First, and the app's landing screen: the estate counted in the card strip and
  // listed under it. Everything below is a way of narrowing what this page counts.
  {label: 'Sites', icon: RadioTowerIcon, link: '/sites'},
  // The plant register: the engine, which is the whole of what this product
  // puts at a site. A row is one machine, and the six tabs below it are the same
  // shape every detail page in the app has.
  {label: 'Gensets', icon: BoomBoxIcon, link: '/gensets'},
  // The dispatch feed: what is out, where, and since when. Fleet-wide like the
  // register above it, and last because it is the question you ask after you know
  // what the fleet is.
  {label: 'Deployment', icon: TruckIcon, link: '/deployment'},
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
        {/* Whatever of the customer's lockup reads at 94px — which is a per-brand
            call, and the two brands here answer it differently. CelcomDigi's is
            *cropped* out of their official artwork, the left edge to the start of
            the "c" (viewBox `-6 0 408 439.61`), because their full wordmark has no
            legible form at this width — the same call the IQ mark made for the
            product's own brand. Redtone's is the whole wordmark: seven letters on
            one line, and it holds up at 76px.

            Whichever it is, it is the cut drawn for a *dark* ground, because the
            rail always is one. CelcomDigi's inverted artwork only whitens the
            wordmark their crop drops, so their two cuts are identical here and
            navy (#001871) is chosen so the mark's own #009BDF → #0064DC gradient
            has something to sit on; Redtone ships two genuinely different cuts and
            this is the one whose "tone" is white.

            Both dimensions are set so the flex row cannot stretch it, and
            `object-contain` so a `markSize` that rounds off the artwork's own
            ratio letterboxes by half a pixel rather than squashing the letters. */}
        <img
          src={BRAND.mark}
          alt={BRAND.name}
          width={BRAND.markSize.width}
          height={BRAND.markSize.height}
          className="shrink-0 object-contain"
        />
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
              // The brand blue, not the product's teal. On a navy rail the teal
              // avatar was the one mark on screen belonging to neither the
              // customer nor the estate, and a green disc under a blue-and-yellow
              // mark reads as something the page forgot to style.
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
