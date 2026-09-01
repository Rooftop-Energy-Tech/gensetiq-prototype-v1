import {useState} from 'react';

import {useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteDiagnostics} from './SiteDiagnostics';
import {SiteDiagram} from './SiteDiagram';
import {SiteOverviewCard} from './SiteOverviewCard';
import {SitePrimaryDevices} from './SitePrimaryDevices';

/**
 * The site home page, in the three bands the design lays out.
 *
 * 1. **What the site is doing** — a summary card of the figures that move, with the
 *    single-line diagram beside it. One band, because they are one question asked
 *    two ways: the card says what the numbers are and the diagram says how the yard
 *    is wired to produce them.
 * 2. **The primary devices** — a card per kind of plant on the bus, with the
 *    details that concern an operator. Not every device; see `SitePrimaryDevices`.
 * 3. **Diagnostics** — one chart with a metric picker, so the day can be read as
 *    solar, battery, genset or load without leaving the page.
 *
 * The order is the design's and it reads correctly top to bottom: the state of the
 * site, then the plant producing it, then the history behind it. Somebody arriving
 * from an alarm answers their question in the first band and never scrolls; somebody
 * investigating reads all three in order.
 *
 * ## What the duty set is here, and why nothing sets it
 *
 * `summary.defaultDutyId` — the set carrying the load, or the one that would if the
 * grid dropped now — and this page reports it rather than offering to change it.
 * The page it replaced carried a changeover control that transferred the load
 * between sets, which the design does not draw and which was always a strange thing
 * for a summary screen to own: transferring a site's load is an operation, and
 * operations belong on the machine's own page beside the interlocks that make them
 * safe. The diagram still draws every isolator's true position.
 *
 * ## At phone width
 *
 * Each band becomes a column of its own blocks in the same order. The **diagram
 * scales to the width it is given** rather than reflowing: it is a fixed pixel
 * canvas whose conductors land on the boxes at measured coordinates, so a reflow
 * would leave a wire in mid-air. `SiteDiagram` measures its own box and handles
 * that itself, so there is nothing to arrange here.
 */
export const SiteHome = ({summary}: {summary: SiteSummary}) => {
  // One clock reading for the whole page, so the diagram's live nodes, the device
  // cards' figures and the chart's right-hand edge cannot land either side of a
  // minute boundary and disagree about what "now" was.
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
    <div className="flex flex-col gap-4 px-4 pt-3 pb-24 md:pb-6">
      <section
        aria-label="Site circuit"
        // A column below `md`, for the reason the device row gives: with a
        // shrinkable item beside a fixed one, "wrap" resolves to a squeezed line
        // rather than two.
        className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6"
      >
        <SiteOverviewCard summary={summary} role={role} now={now} />

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
          // Handed to the band inside a `min-w-0 flex-1` so it takes the slack the
          // card leaves, but with nothing else wrapped around it: the diagram
          // measures the width it is given and scales itself to fit, and a wrapper
          // that sized to the drawing would make that circular.
          <div className="min-w-0 flex-1">
            <SiteDiagram summary={summary} dutyId={summary.defaultDutyId} role={role} />
          </div>
        )}
      </section>

      <SitePrimaryDevices summary={summary} role={role} now={now} />

      <SiteDiagnostics summary={summary} now={now} />
    </div>
  );
};
