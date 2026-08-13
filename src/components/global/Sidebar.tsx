import {useNavigate} from '@tanstack/react-router';
import {BoomBoxIcon, FuelIcon, LandPlotIcon, LogOutIcon, SettingsIcon, TruckIcon} from 'lucide-react';

import {NavButton} from '@/components/global/NavButton';
import type {NavItem} from '@/components/global/NavButton';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {sessionInitial, signOut, useSession} from '@/modules/auth/session';

import iqMark from '@/assets/iq-mark.svg';

const NAV_ITEMS: Array<NavItem> = [
  {label: 'Gensets', icon: BoomBoxIcon, link: '/gensets'},
  {label: 'Deployment', icon: TruckIcon, link: '/deployment'},
  {label: 'Sites', icon: LandPlotIcon, link: '/sites'},
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
    <aside className="flex h-full w-[94px] flex-col items-center pt-2">
      <div className="flex w-full items-center justify-center py-3.5">
        {/* The mark's own aspect ratio is 37 × 27.2; both dimensions are set so
            it can't be stretched by the flex row it sits in. */}
        <img src={iqMark} alt="GensetIQ" width={36.5} height={27.2} className="shrink-0" />
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
