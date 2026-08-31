import {createFileRoute} from '@tanstack/react-router';

import {SectionTabs} from '@/components/global/SectionTabs';
import type {SectionTab} from '@/components/global/SectionTabs';

/**
 * `/report` — the estate's three reports, under one destination.
 *
 * ## Why they were consolidated
 *
 * They were two rail items, `Energy` and `Solar report`, and they were split
 * apart on a real argument: one page carrying two headline figures that move for
 * unrelated reasons is the reliable way to make a reader distrust both. That
 * argument was about **one screen**, and it survives here — the tab strip is
 * exactly what keeps the figures on separate screens. What it never justified was
 * two top-level destinations, and the rail was paying for it twice: `Solar
 * report` needed a qualifier the other items did not, because a rail item reading
 * `Solar` beside `Battery` and `Gensets` would have been read as the fourth plant
 * register rather than a report about generation.
 *
 * Under `/report` the qualifier is redundant — everything in here is a report —
 * so the tabs are `Overall`, `Solar` and `Genset`, and the register at `/solar`
 * keeps its own unqualified name without a collision.
 *
 * ## Overall leads, and it is the page that used to be `/energy`
 *
 * The rail's old order put `Energy` above `Solar report` for the reason this tab
 * order keeps: it is the only one of the three that counts the *whole* estate.
 * The two beside it are that answer taken apart by plant — what the arrays made,
 * and what the engines burned to cover what they did not — so a reader who wants
 * a number starts at the left and a reader who wants its working moves right.
 *
 * `Genset` completes the pair. Until now the engines were reported on only as a
 * line inside a page about diesel savings, and everything a fleet manager reads a
 * genset fleet *down* — hours, fuel rate, unaccounted litres, servicing — was
 * only ever legible one machine at a time.
 */
const TABS: ReadonlyArray<SectionTab> = [
  {label: 'Overall', to: '/report', end: true},
  {label: 'Solar', to: '/report/solar'},
  {label: 'Genset', to: '/report/genset'},
];

const ReportSection = () => (
  <SectionTabs
    title="Report"
    // Deliberately says nothing about a period. The tabs do not share one —
    // Overall and Genset report thirty days, Solar opens on twelve months
    // because the design benchmark it is read against only exists monthly — and
    // a section header naming a window would be wrong on whichever tab was not
    // showing it. Each tab states its own, over its own tiles.
    subtitle="The estate's position, then the same estate taken apart by plant"
    tabs={TABS}
    ariaLabel="Report sections"
  />
);

export const Route = createFileRoute('/_authenticated/report')({
  staticData: {crumb: 'Report'},
  component: ReportSection,
});
