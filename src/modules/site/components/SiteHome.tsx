import {useState} from 'react';

import type {SiteSummary} from '../data/sites';
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

  return (
    <div className="flex flex-col gap-5 px-4 pt-1 pb-6">
      <section
        aria-label="Site circuit"
        className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 rounded-md border border-default px-6 py-7"
      >
        <SiteSummaryPanel summary={summary} />
        <SiteDiagram summary={summary} />
      </section>

      {summary.gensets.length === 0 ? (
        <p className="px-1 text-sm text-secondary">No gensets are installed at this site.</p>
      ) : (
        summary.gensets.map((member) => (
          <SiteGensetRow key={member.genset.id} member={member} now={now} />
        ))
      )}
    </div>
  );
};
