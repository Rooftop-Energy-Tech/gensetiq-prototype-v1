import {useNavigate} from '@tanstack/react-router';
import {
  BoomBoxIcon,
  FuelIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  RadioTowerIcon,
  SettingsIcon,
  SunMediumIcon,
  ZapIcon,
} from 'lucide-react';

import {NavButton} from '@/components/global/NavButton';
import type {NavItem} from '@/components/global/NavButton';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {sessionInitial, signOut, useSession} from '@/modules/auth/session';

import celcomdigiMark from '@/assets/celcomdigi-mark.svg';

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
 * **Energy** and **Solar** take the slot it left, and they are two destinations
 * rather than one because they answer two questions. Energy is *what carried the
 * load and what the plant saved*, which is a question about diesel. Solar is *is
 * the generation what it was bought on*, which is a question about the arrays.
 * They moved apart after sharing a screen, because one page carrying two headline
 * figures that move independently is the reliable way to make a reader distrust
 * both.
 */
const NAV_ITEMS: Array<NavItem> = [
  // First, and the app's landing screen: the estate's state before any one site
  // in it. Everything below is a way of narrowing what this page counts.
  {label: 'Overview', icon: LayoutDashboardIcon, link: '/overview'},
  {label: 'Sites', icon: RadioTowerIcon, link: '/sites'},
  {label: 'Energy', icon: ZapIcon, link: '/energy'},
  {label: 'Solar', icon: SunMediumIcon, link: '/solar'},
  {label: 'Gensets', icon: BoomBoxIcon, link: '/gensets'},
  // After Sites, because a meter is fitted to a site's circuit and reads nothing on
  // its own — the order of the rail follows what each destination is about.
  {label: 'Meters', icon: GaugeIcon, link: '/meters'},
  {label: 'Refuel', icon: FuelIcon, link: '/refuel'},
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
    // a rail of seven destinations has no phone-width form, and the two that do
    // have mobile layouts are the two the floating bar offers.
    <aside className="hidden h-full w-[94px] flex-col items-center pt-2 md:flex">
      <div className="flex w-full items-center justify-center py-3.5">
        {/* The customer's own mark, cropped out of their official lockup — the
            rail is 94px and the full wordmark has no legible form at that width,
            the same call the IQ mark made for the product's own brand. The crop
            is the artwork's own left edge to the start of the "c", viewBox
            `-6 0 408 439.61`; both dimensions are set so the flex row can't
            stretch it.

            The full-colour cut, not the reversed one. CelcomDigi's inverted
            artwork only whitens the *wordmark* — the mark itself is the same
            blue-to-yellow in both files — and the wordmark is exactly what this
            crop drops. So the two cuts are identical here, and the rail is navy
            (`--sidebar`, #001871) precisely so the mark's own #009BDF → #0064DC
            gradient has a ground to sit on. */}
        <img
          src={celcomdigiMark}
          alt="CelcomDigi"
          width={40}
          height={43}
          className="shrink-0"
        />
      </div>

      <nav aria-label="Main" className="flex w-full flex-1 flex-col items-center gap-2 px-2 py-2">
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
              className="size-8 rounded-full bg-teal p-0 text-sm font-normal text-element hover:bg-teal"
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
