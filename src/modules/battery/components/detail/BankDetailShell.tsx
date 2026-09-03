import {Outlet} from '@tanstack/react-router';
import {
  BatteryChargingIcon,
  BellIcon,
  ChartLineIcon,
  CircuitBoardIcon,
  InfoIcon,
  SettingsIcon,
  WrenchIcon,
} from 'lucide-react';

import {
  DetailSidebar,
  DetailSidebarBackCard,
  DetailSidebarLabel,
} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount} from '@/lib/format';
import {SITE_POWER_ROLE_LABEL} from '@/modules/site/types/site.type';
import {bankName} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';

/**
 * The six sections of a battery bank — the same six a solar system has, for the
 * same reason it has them: they are a genset's eight minus `Runs` and `Refuel`,
 * which are facts about an engine.
 *
 * They are not new. Until now these were six tabs at `/battery` itself, standing
 * over the whole estate with a `ComingSoon` body each. They have moved down one
 * level onto a bank, which is exactly the move `/solar` made when it became a
 * register — and it is the move that makes each body true: "state of charge over
 * time" was never a fact about an estate, it was always a fact about *a bank*, and
 * the copy said so while sitting one level too high.
 *
 * `Battery` is the home row, named for its subject the way `Solar` and `Genset` are
 * on the other two rails. `Devices` is the design's word for `/equipment`.
 */
const NAV_ENTRIES = (bankId: string): Array<DetailNavEntry> => {
  const params = {bankId};

  return [
    // `end` on the landing row alone: `/battery/x` prefixes every route below it.
    {label: 'Battery', icon: BatteryChargingIcon, to: '/battery/$bankId', params, end: true},
    {label: 'Analysis', icon: ChartLineIcon, to: '/battery/$bankId/analysis', params},
    {label: 'Service', icon: WrenchIcon, to: '/battery/$bankId/service', params},
    {label: 'Alarms', icon: BellIcon, to: '/battery/$bankId/alarms', params},
    {label: 'Devices', icon: CircuitBoardIcon, to: '/battery/$bankId/equipment', params},
    {label: 'Settings', icon: SettingsIcon, to: '/battery/$bankId/settings', params},
  ];
};

/**
 * Everything one bank's pages share: the rail on the left, an `<Outlet />` beside
 * it — the third of three, and identical in construction to the other two.
 *
 * The back card is `DetailSidebarBackCard`, the same one a genset and a system
 * carry. A bank cannot be anywhere but at a site — it *is* the storage there — so
 * there is always somewhere to go back to and, unlike a genset, no depot branch.
 *
 * The info glyph carries what has no room in a 240px column and no band of its own:
 * how the bank is built, what its converter can pass, and which hybrid
 * configuration it was specified for — the last being the fact that decides whether
 * sixteen hours of autonomy is generous or barely enough.
 */
export const BankDetailShell = ({bank}: {bank: BatteryBank}) => (
  <div className="flex min-h-0 flex-1 overflow-hidden">
    <DetailSidebar
      ariaLabel="Bank sections"
      header={
        <div className="flex flex-col gap-2">
          <DetailSidebarBackCard
            siteId={bank.siteId}
            name={bank.siteName}
            locationLabel={bank.locationLabel}
          />

          <DetailSidebarLabel
            aside={
              <Tooltip>
                <TooltipTrigger className="cursor-help text-secondary hover:text-primary">
                  <InfoIcon className="size-4" aria-hidden="true" />
                  <span className="sr-only">Bank details</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <span>
                    Modules · {bank.modules.toLocaleString('en-MY')} × {bank.moduleKwh} kWh
                  </span>
                  <span>Converter · {amount(bank.continuousKw, 'kW')} continuous</span>
                  <span>Autonomy · {amount(bank.autonomyHours, 'h')} from full</span>
                  <span>Configuration · {SITE_POWER_ROLE_LABEL[bank.role]}</span>
                </TooltipContent>
              </Tooltip>
            }
          >
            {bankName(bank)}
          </DetailSidebarLabel>
        </div>
      }
      entries={NAV_ENTRIES(bank.id)}
    />

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Drawn at every width, which is also what covers the phone: the rail is
          gone there and this is the only thing left saying what you are reading. */}
      <h1 className="shrink-0 truncate px-4 pt-4 pb-2 text-base font-medium text-primary">
        {bankName(bank)}
      </h1>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  </div>
);
