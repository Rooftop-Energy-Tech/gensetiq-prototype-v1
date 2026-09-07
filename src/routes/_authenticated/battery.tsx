import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {BatteryRegister} from '@/modules/battery/components/register/BatteryRegister';
import {batteryRegisterSearchSchema} from '@/modules/battery/types/register.type';
import type {BatteryRegisterSearch} from '@/modules/battery/types/register.type';

/**
 * `/battery` — the bank register.
 *
 * A leaf route, not a layout. It was six `SectionTabs` over the whole estate; those
 * tabs have moved onto a bank at `battery_.$bankId.tsx`, which is the same journey
 * `/solar` made and for the same reason: a register is a list of plant, and the
 * sections live one level down on each item.
 *
 * It now validates search params, which it did not before — the register grew the
 * fleet screen's shape: three views, a region filter, a search box, a selection and a
 * preview panel, all carried in the URL so a filtered estate is a link somebody can
 * send. See `register.type.ts` for why the map is what made that worth doing, and
 * `BatteryRegister` for the columns and why they are these ones.
 */
const BatteryRegisterRoute = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<BatteryRegisterSearch>) => {
    void navigate({
      search: (prev) => ({...prev, ...next}),
      // Typing in the search box would otherwise push one history entry per keystroke.
      // Every other change — switching view, picking a bank — is a deliberate move
      // worth a Back. The fleet route's rule.
      replace: 'q' in next,
    });
  };

  return <BatteryRegister search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/battery')({
  validateSearch: (search: Record<string, unknown>): BatteryRegisterSearch =>
    batteryRegisterSearchSchema.parse(search),
  staticData: {crumb: 'Battery'},
  component: BatteryRegisterRoute,
});
