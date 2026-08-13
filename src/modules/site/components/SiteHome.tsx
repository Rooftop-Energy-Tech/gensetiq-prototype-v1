import {useState} from 'react';

import {isolatorStateOf} from '../types/site.type';
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

  return (
    <div className="flex flex-col gap-2.5 px-4 pt-1 pb-6">
      {/* Three columns, and no border. The section is the page's top band rather
          than a card in it — the divider below carries the separation, which is the
          same job the rules do between the genset home page's bands. */}
      <section
        aria-label="Site circuit"
        className="flex flex-wrap items-center gap-x-30 gap-y-8 px-6 py-7"
      >
        <SiteSummaryPanel summary={summary} dutyId={dutyId} />

        <SiteDiagram summary={summary} dutyId={dutyId} />

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
