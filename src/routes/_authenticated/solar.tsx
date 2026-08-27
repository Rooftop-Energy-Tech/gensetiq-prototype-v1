import {createFileRoute} from '@tanstack/react-router';

import {SectionTabs} from '@/components/global/SectionTabs';
import type {SectionTab} from '@/components/global/SectionTabs';
import {usePlantCount} from '@/modules/plant/estateCount';

/**
 * The solar plant register: `/solar`, `/solar/analysis`, …
 *
 * The generation report that used to be at this path is now `/solar-report`. The
 * two split because they answer different questions — the report is about *yield*
 * against a design number, this section is about the *arrays themselves* — and one
 * destination carrying both was the reason the nav item needed a qualifier.
 *
 * Six tabs, and every one of them empty. They are the same six a genset has minus
 * `Runs` and `Refuel`, which are facts about an engine: an array does not start,
 * stop or take delivery of anything. What each is *for* is written on its own
 * route file, so the decision about a page is recorded where the page will be.
 */
const TABS: ReadonlyArray<SectionTab> = [
  {label: 'Home', to: '/solar', end: true},
  {label: 'Analysis', to: '/solar/analysis'},
  {label: 'Service', to: '/solar/service'},
  {label: 'Alarms', to: '/solar/alarms'},
  {label: 'Equipment', to: '/solar/equipment'},
  {label: 'Settings', to: '/solar/settings'},
];

const SolarSection = () => {
  const {arrays, kwp} = usePlantCount();

  return (
    <SectionTabs
      title="Solar"
      subtitle={`${arrays} ${arrays === 1 ? 'array' : 'arrays'} · ${Math.round(kwp)} kWp installed`}
      tabs={TABS}
      ariaLabel="Solar sections"
    />
  );
};

export const Route = createFileRoute('/_authenticated/solar')({
  staticData: {crumb: 'Solar'},
  component: SolarSection,
});
