import {useState} from 'react';

import {useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteDetails} from './SiteDetails';
import {SiteDiagnostics} from './SiteDiagnostics';
import {SiteDiagram} from './SiteDiagram';
import {SiteMetricStrip} from './SiteMetricStrip';
import {SitePrimaryDevices} from './SitePrimaryDevices';

/**
 * The site home page, in the four full-width bands the design stacks.
 *
 * 1. **The strip** — the figures that move, in one rule across the top.
 * 2. **The circuit** — the single-line diagram on the left, what the site *is* on
 *    the right. The only band that is not a card: it sits on the canvas, so the
 *    drawing reads as the page's own subject rather than as another panel.
 * 3. **Diagnostics** — one chart with a metric picker and a period control.
 * 4. **The devices** — one full-width row per kind of plant, stacked.
 *
 * ## Why every band is full width
 *
 * Because only one thing on this page has a natural width. The diagram is a fixed
 * canvas; the figures are short; the chart wants everything it can get. An earlier
 * arrangement put the summary and the diagram side by side in a band and the
 * devices in a row of cards beside each other, and it left two ragged holes down
 * the right at any site with fewer than three devices — which is seventeen of the
 * twenty-five here.
 *
 * Bands answer that by never having a leftover column to fill. Device count changes
 * the page's *height* and nothing else, so a genset-only site and a solar hybrid
 * are the same page at two lengths, and an operator moving between them is not
 * re-reading a new arrangement each time.
 *
 * ## What the duty set is here, and why nothing sets it
 *
 * `summary.defaultDutyId` — the set carrying the load, or the one that would if the
 * grid dropped now — and this page reports it rather than offering to change it.
 * Transferring a site's load is an operation, and operations belong on the
 * machine's own page beside the interlocks that make them safe. The diagram still
 * draws every isolator's true position.
 *
 * ## At phone width
 *
 * The bands are already a column, so they need no rearranging; only band 2 folds,
 * putting the details under the drawing. The **diagram scales to the width it is
 * given** rather than reflowing: it is a fixed pixel canvas whose conductors land
 * on the boxes at measured coordinates, so a reflow would leave a wire in mid-air.
 * `SiteDiagram` measures its own box and handles that itself.
 */
export const SiteHome = ({summary}: {summary: SiteSummary}) => {
  // One clock reading for the whole page, so the strip's figures, the diagram's
  // live nodes, the device rows and the chart's right-hand edge cannot land either
  // side of a minute boundary and disagree about what "now" was.
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

      <section
        aria-label="Site circuit"
        // The design's proportions: the drawing takes roughly the left 40% and the
        // details the right, with the gap between them left open. No card — this
        // band is the one thing on the page that is a picture rather than a panel.
        className="flex flex-col gap-6 py-2 md:flex-row md:items-start md:gap-10"
      >
        {/* A **grid-backed** site with no set still has a circuit worth drawing:
            mains straight to the load says "on the grid, no plant fitted", which is
            a real and reassuring state. So does a **hybrid** — the array and the
            bank are still there and still carrying. A **diesel-prime** site with no
            set has no incomer and no machines, so there is nothing to draw: the
            diagram would be a load box with a conductor arriving from nowhere. */}
        {summary.gensets.length === 0 && role === 'DIESEL_PRIME' ? (
          <p className="max-w-sm text-sm text-secondary md:flex-1">
            Nothing supplies this site. It is set to run on its own gensets and none are
            fitted.
          </p>
        ) : (
          // Centred in its column, as the frame centres it, and handed the width
          // directly: the diagram measures what it is given and scales itself, so a
          // wrapper that sized to the drawing would make that circular.
          <div className="flex min-w-0 justify-center md:flex-[0_0_41%]">
            <SiteDiagram summary={summary} dutyId={summary.defaultDutyId} role={role} />
          </div>
        )}

        <div className="min-w-0 md:flex-1 md:pt-4">
          <SiteDetails summary={summary} role={role} />
        </div>
      </section>

      <SiteDiagnostics summary={summary} now={now} />

      <SitePrimaryDevices summary={summary} role={role} now={now} />
    </div>
  );
};
