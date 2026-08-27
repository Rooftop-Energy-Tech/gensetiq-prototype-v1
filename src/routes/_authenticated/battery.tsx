import {createFileRoute} from '@tanstack/react-router';

import {SectionTabs} from '@/components/global/SectionTabs';
import type {SectionTab} from '@/components/global/SectionTabs';
import {usePlantCount} from '@/modules/plant/estateCount';

/**
 * The battery register: `/battery`, `/battery/analysis`, …
 *
 * The gap Lucas named in the handover, given a place to be filled. Today the whole
 * battery model is three fields — bank size, hours of autonomy, and a state of
 * charge on the site diagram — and nothing in the app holds a charge history, a
 * cycle count, a state of health, a battery alarm, or a bank on the metering
 * estate. On an estate where eight sites out of twenty-five depend on storage
 * overnight, that is the largest thing missing.
 *
 * This section is deliberately a **sibling** of Solar and Gensets rather than a tab
 * inside either. A bank at a diesel-hybrid site has no array beside it at all, so
 * filing storage under solar would hide half of it; and the bank is the component
 * that decides whether the tower stays up, which is not a subheading of the engine
 * that charges it.
 *
 * Every tab is empty. See each route file for what it is for.
 */
const TABS: ReadonlyArray<SectionTab> = [
  {label: 'Home', to: '/battery', end: true},
  {label: 'Analysis', to: '/battery/analysis'},
  {label: 'Service', to: '/battery/service'},
  {label: 'Alarms', to: '/battery/alarms'},
  {label: 'Equipment', to: '/battery/equipment'},
  {label: 'Settings', to: '/battery/settings'},
];

const BatterySection = () => {
  const {banks, kwh} = usePlantCount();

  return (
    <SectionTabs
      title="Battery"
      subtitle={`${banks} ${banks === 1 ? 'bank' : 'banks'} · ${Math.round(kwh).toLocaleString()} kWh usable`}
      tabs={TABS}
      ariaLabel="Battery sections"
    />
  );
};

export const Route = createFileRoute('/_authenticated/battery')({
  staticData: {crumb: 'Battery'},
  component: BatterySection,
});
