import {createFileRoute} from '@tanstack/react-router';

import {BatteryRegister} from '@/modules/battery/components/register/BatteryRegister';

/**
 * `/battery` — the bank register.
 *
 * A leaf route now, not a layout. It was six `SectionTabs` over the whole estate;
 * those tabs have moved onto a bank at `battery_.$bankId.tsx`, which is the same
 * journey `/solar` made and for the same reason: a register is a list of plant, and
 * the sections live one level down on each item.
 *
 * See `BatteryRegister` for the columns and why they are these ones.
 */
export const Route = createFileRoute('/_authenticated/battery')({
  staticData: {crumb: 'Battery'},
  component: BatteryRegister,
});
