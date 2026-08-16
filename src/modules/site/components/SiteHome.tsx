import {useState} from 'react';

import {isolatorStateOf} from '../types/site.type';
import {useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteChangeover} from './SiteChangeover';
import {SiteDiagram} from './SiteDiagram';
import {SiteGensetRow} from './SiteGensetRow';
import {SiteSummaryPanel} from './SiteSummaryPanel';

/**
 * The site home page: one diagram, then one row per genset.
 *
 * The order is the design's and it is the right way round. The diagram is the
 * **site's** own content — the only thing on the page that is a fact about the
 * yard rather than about a machine in it — and it establishes the topology the
 * rows below then fill in. Read the other way, the rows are a list of gensets that
 * happen to share a page.
 *
 * Nothing here is a section heading, also per the design. The diagram needs no
 * label (it is a picture of the thing named in the header) and the rows are
 * self-titling — each one leads with the asset it describes.
 *
 * ## At phone width
 *
 * The three columns of the top band become three stacked blocks, in the same order,
 * and the rows below are unchanged in content. The **diagram scales to the width it
 * is given** rather than reflowing or scrolling: it is 398px of fixed geometry whose
 * conductors land on the boxes at measured coordinates, so a reflow would leave a
 * wire in mid-air — but a uniform scale keeps every one of those coordinates and
 * costs only type size. `SiteDiagram` measures its own box and does this itself, so
 * there is nothing to arrange here.
 */
export const SiteHome = ({summary}: {summary: SiteSummary}) => {
  // One clock reading for every row, so two runs on the same site cannot land
  // either side of a minute boundary and disagree about the current time.
  const [now] = useState(() => Date.now());

  /**
   * Which set the changeover has on the bus.
   *
   * Component state rather than URL state, for the same reason a genset's control
   * mode is: it describes what the *plant* is set to, not what the reader is
   * looking at. Putting a machine setting in a query string would make it look
   * shareable and reloadable when it is neither. It resets on navigation, which is
   * the honest behaviour for a prototype with no changeover behind it.
   */
  const [dutyId, setDutyId] = useState<string | undefined>(summary.defaultDutyId);

  /**
   * How this yard says it is fed, from the Settings tab.
   *
   * Live from the store rather than loader data, so walking Settings → Home shows
   * the change without a reload. It is read here and threaded down instead of each
   * child reaching for the store itself: the diagram has to stay a pure function of
   * its props so the settings page can render it twice, one role each, as a preview.
   *
   * Note what it does *not* touch. `dutyId` below is untouched by it, and so is
   * `defaultDutyId` above — the role selects a drawing, and which of the yard's sets
   * is on the bus is a fact about the plant that a display choice has no business
   * moving. That is also why there is no state to reset when the role changes.
   */
  const role = useSitePowerRole(summary.site.id);

  return (
    <div className="flex flex-col gap-2.5 px-4 pt-1 pb-24 md:pb-6">
      {/* Three columns, and no border. The section is the page's top band rather
          than a card in it — the divider below carries the separation, which is the
          same job the rules do between the genset home page's bands. */}
      <section
        aria-label="Site circuit"
        // A column below `md`, for the reason `SiteGensetRow` gives: with a shrinkable
        // item beside a fixed one, "wrap" resolves to a squeezed line rather than two.
        className="flex flex-col gap-y-8 px-1 py-4 md:flex-row md:flex-wrap md:items-center md:gap-x-30 md:px-6 md:py-7"
      >
        <SiteSummaryPanel summary={summary} dutyId={dutyId} role={role} />

        {/* An empty **standby** site still has a circuit, and it is worth drawing:
            mains straight to the load says "on the grid, no plant installed", which
            is a real and reassuring state. An empty **prime** site has no incomer and
            no machines, so there is nothing to draw — the diagram would be a load box
            with a conductor arriving from nowhere. */}
        {summary.gensets.length === 0 && role === 'PRIME' ? (
          <p className="max-w-sm text-sm text-secondary">
            Nothing supplies this site. It is set to run on its own gensets and none are
            installed.
          </p>
        ) : (
          // Handed straight to the band, with nothing wrapped around it: the diagram
          // measures the width it is given and scales itself to fit. A wrapper here
          // was the previous answer and it made the sizing circular — the wrapper
          // sized to the drawing while the drawing measured the wrapper.
          <SiteDiagram summary={summary} dutyId={dutyId} role={role} />
        )}

        {/* Only where there is a choice to make. A single-set site has no
            changeover — its one isolator is either closed or it isn't, and a
            one-option control would imply an operation that does not exist. */}
        {summary.gensets.length > 1 && (
          <SiteChangeover summary={summary} dutyId={dutyId} onDutyChange={setDutyId} />
        )}
      </section>

      <hr className="border-subtle" />

      {summary.gensets.length === 0 ? (
        <p className="px-1 text-sm text-secondary">No gensets are installed at this site.</p>
      ) : (
        summary.gensets.map((member) => (
          <SiteGensetRow
            key={member.genset.id}
            member={member}
            onLoad={isolatorStateOf(member.genset.runState, member.genset.id === dutyId).live}
            now={now}
          />
        ))
      )}
    </div>
  );
};
