import {useState} from 'react';

import {useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteCircuit} from './SiteCircuit';
import {SiteDetails} from './SiteDetails';
import {SiteDiagnostics} from './SiteDiagnostics';
import {SiteMetricStrip} from './SiteMetricStrip';

/**
 * The site home page, in the four bands the design stacks.
 *
 * 1. **The strip** — the figures that move, in one rule across the top.
 * 2. **The circuit** — the single-line diagram and, beside it, the detail of
 *    whichever device the reader has picked out of it. See `SiteCircuit`.
 * 3. **The details** — what the site *is*, in a narrow block between two rules.
 *    This used to be the right half of band 2; see the note at the band itself for
 *    why the design moved it underneath.
 * 4. **Diagnostics** — one chart with a metric picker and a period control.
 *
 * There was a fifth: **the devices**, one full-width row per kind of plant, stacked
 * at the foot of the page. It has gone into band 2 as the drawing's own detail
 * panel, which is the change worth explaining here rather than only there. The
 * stack's problem was never how it looked; it was that it repeated the diagram's
 * subject 900px further down the page. A reader who had just found the genset that
 * was carrying the site scrolled past a chart to read about it, and nothing
 * connected the box they had been looking at to the row they arrived at. Putting
 * the card where the click happens makes that one movement instead of three, and it
 * is what lets a multi-set site name every set rather than only its lead one.
 *
 * ## Why the other bands are still full width
 *
 * Because nothing else on this page has a natural width. The figures are short and
 * the chart wants everything it can get, so both take the line. An earlier
 * arrangement put the site's summary beside the diagram and the devices in a row of
 * cards next to each other, and it left two ragged holes down the right at any site
 * with fewer than three devices — which is seventeen of the twenty-five here.
 *
 * Band 2 is a two-column arrangement and does not have that problem, because its
 * right column holds exactly one card whatever the site is made of. Device count
 * changes how many boxes are *clickable*, not how many panels have to be filled.
 *
 * ## What the duty set is here, and why nothing sets it
 *
 * `summary.defaultDutyId` — the set carrying the load, or the one that would if the
 * grid dropped now — and this page reports it rather than offering to change it.
 * Transferring a site's load is an operation, and operations belong on the
 * machine's own page beside the interlocks that make them safe.
 *
 * ## At phone width
 *
 * The bands are already a column, and band 2 becomes one below `xl`: the drawing over
 * the card it selects. The drawing is a fixed canvas, so it measures the box it is
 * handed and scales itself rather than reflowing — see `SiteDiagram`, and
 * `SiteCircuit` on the two drawings that have been through this band and why the
 * schematic is the one that came back.
 */
export const SiteHome = ({summary}: {summary: SiteSummary}) => {
  // One clock reading for the whole page, so the strip's figures, the device card
  // under the picker and the chart's right-hand edge cannot
  // land either side of a minute boundary and disagree about what "now" was.
  const [now] = useState(() => Date.now());

  /**
   * How this yard says it is fed, from the Settings tab.
   *
   * Live from the store rather than loader data, so walking Settings → Home shows
   * the change without a reload. Read once here and threaded down instead of each
   * child reaching for the store itself: the diagram has to stay a pure function of
   * its props so the settings page can render it twice, one role each, as a preview.
   */
  const role = useSitePowerRole(summary.site.id);

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-3 pb-24 md:pb-6">
      <SiteMetricStrip summary={summary} role={role} now={now} />

      <SiteCircuit summary={summary} role={role} now={now} />

      <div className="border-t border-subtle" />

      <SiteDiagnostics summary={summary} now={now} />

      {/* ## Band 4: what the site *is*, last on the page

          The details were the right half of band 2, captioning the diagram from
          across a 10-unit gap. Two things were wrong with that. The diagram is a
          fixed canvas, so pinning it to 41% of the band meant it stopped growing
          with the page and the caption's column got wider the more room there was —
          at 1900px the labels and their values were half a screen apart. And a
          caption set beside a picture reads as a legend *for* it, which invited the
          question of which box `Installed capacity` referred to.

          Below the drawing was the first fix and below the **charts** is the
          second, which is the order all four detail pages now keep: the live bands
          first, then the reference block. Nothing in here changes between one visit
          and the next — it is what a reader consults once, having already read the
          strip, the circuit and the trend, and it was previously holding the two
          things somebody opens this page for a screen apart.

          The rule above is the design's and it is doing the work the gap used to:
          it says where the live part of the page stops. */}
      <div className="border-t border-subtle" />

      {/* The band's own `<section>`, padding and two-column split all live in
          `DetailBand` now — the genset, solar and battery pages carry the same band
          and used to carry the same markup each. `SiteDetails` supplies the rows. */}
      <SiteDetails summary={summary} role={role} />
    </div>
  );
};
