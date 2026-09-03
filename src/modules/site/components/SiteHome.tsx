import {useState} from 'react';

import {useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteDetails} from './SiteDetails';
import {SiteDiagnostics} from './SiteDiagnostics';
import {SiteDiagram} from './SiteDiagram';
import {SiteMetricStrip} from './SiteMetricStrip';
import {SitePrimaryDevices} from './SitePrimaryDevices';

/**
 * The site home page, in the five full-width bands the design stacks.
 *
 * 1. **The strip** — the figures that move, in one rule across the top.
 * 2. **The circuit** — the single-line diagram, centred. The only band that is not
 *    a card: it sits on the canvas, so the drawing reads as the page's own subject
 *    rather than as another panel.
 * 3. **The details** — what the site *is*, in a narrow block between two rules.
 *    This used to be the right half of band 2; see the note at the band itself for
 *    why the design moved it underneath.
 * 4. **Diagnostics** — one chart with a metric picker and a period control.
 * 5. **The devices** — one full-width row per kind of plant, stacked.
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
 * The bands are already a column and, since the details moved out of band 2,
 * nothing in them folds — the phone layout and the desktop one are now the same
 * stack at two widths. The **diagram scales to the width it is given** rather than
 * reflowing: it is a fixed pixel canvas whose conductors land
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
        // Full width now, with the drawing centred in it. The details used to sit
        // in the right 59% of this band; see the note on the band below for why
        // they moved. No card — this is the one thing on the page that is a picture
        // rather than a panel.
        className="flex flex-col gap-6 py-2"
      >
        {/* A **grid-backed** site with no set still has a circuit worth drawing:
            mains straight to the load says "on the grid, no plant fitted", which is
            a real and reassuring state. So does a **hybrid** — the array and the
            bank are still there and still carrying. A **diesel-prime** site with no
            set has no incomer and no machines, so there is nothing to draw: the
            diagram would be a load box with a conductor arriving from nowhere. */}
        {summary.gensets.length === 0 && role === 'DIESEL_PRIME' ? (
          <p className="max-w-sm text-sm text-secondary">
            Nothing supplies this site. It is set to run on its own gensets and none are
            fitted.
          </p>
        ) : (
          // Centred, as the frame centres it, and handed the width directly: the
          // diagram measures what it is given and scales itself, so a wrapper that
          // sized to the drawing would make that circular.
          <div className="flex min-w-0 justify-center">
            <SiteDiagram summary={summary} dutyId={summary.defaultDutyId} role={role} />
          </div>
        )}
      </section>

      {/* ## Band 3: what the site *is*, under the drawing rather than beside it

          The details were the right half of band 2, captioning the diagram from
          across a 10-unit gap. Two things were wrong with that. The diagram is a
          fixed canvas, so pinning it to 41% of the band meant it stopped growing
          with the page and the caption's column got wider the more room there was —
          at 1900px the labels and their values were half a screen apart. And a
          caption set beside a picture reads as a legend *for* it, which invited the
          question of which box `Installed capacity` referred to.

          Underneath, in a narrow block between two rules, it reads as what it is: a
          short statement about the installation, closing the band above and opening
          the chart below. The rules are the design's and they are doing the work the
          gap used to — they say where the picture stops. */}
      <div className="border-t border-subtle" />

      {/* The band's own `<section>`, padding and two-column split all live in
          `DetailBand` now — the genset, solar and battery pages carry the same band
          and used to carry the same markup each. `SiteDetails` supplies the rows. */}
      <SiteDetails summary={summary} role={role} />

      <div className="border-t border-subtle" />

      <SiteDiagnostics summary={summary} now={now} />

      <SitePrimaryDevices summary={summary} role={role} now={now} />
    </div>
  );
};
