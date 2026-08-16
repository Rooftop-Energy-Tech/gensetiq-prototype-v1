import {useMemo, useState} from 'react';

import {downloadText} from '@/lib/download';
import {RunsPanel} from '@/modules/genset/components/runs/RunsPanel';
import {historyStart} from '@/modules/genset/data/history';
import {runsCsv, runsCsvFilename} from '@/modules/genset/data/runsCsv';
import {
  clearedRunsRange,
  runTotals,
  runsOverlapping,
  runsRange,
} from '@/modules/genset/types/runsView.type';
import type {RunWindow, RunsSearch} from '@/modules/genset/types/runsView.type';
import {siteRuns} from '../data/siteRuns';
import type {SiteSummary} from '../data/sites';

/**
 * A site's run log — every set standing here, in one list.
 *
 * The genset module's own panel, not a site-flavoured copy of it. The rules that
 * make this page trustworthy — what a window contains, what the totals cover, what
 * an open run does — are the same rules at both levels, and a second implementation
 * of them is a second set to keep in step.
 *
 * ## The energy figure is the site's one real trap
 *
 * A site's total is the energy its **sets produced**, which is not the energy the
 * **site received**. Only one set is connected to the bus at a time; a second set
 * turning while isolated is off-load and delivered nothing to the load. Summing
 * both is right for "what did this plant do" and wrong for "what did the customer
 * get", and the two differ by exactly the runs nobody was drawing from.
 *
 * The page cannot resolve that — it does not know, historically, which set was duty
 * — so it says which of the two it is reporting rather than picking one silently.
 * That caveat travels into the CSV as well, where it matters more: a spreadsheet
 * has no surrounding page to infer it from.
 */
export const SiteRuns = ({
  summary,
  search,
  onSearchChange,
}: {
  summary: SiteSummary;
  search: RunsSearch;
  onSearchChange: (search: RunsSearch) => void;
}) => {
  const [now] = useState(() => Date.now());

  const all = useMemo(() => siteRuns(summary.gensets), [summary.gensets]);
  const earliest = historyStart();
  const range = runsRange(search, now, earliest);

  const rows = useMemo(() => runsOverlapping(all, range, ({run}) => run), [all, range]);
  const totals = useMemo(
    () =>
      runTotals(
        rows.map(({run}) => run),
        range,
        now,
      ),
    [rows, range, now],
  );

  // One lane per set, in the site's own attention order, so the strip's rows line
  // up with the order every other tab lists its machines in.
  const lanes = useMemo(
    () =>
      summary.gensets.map(({genset}) => ({
        label: genset.tag,
        runs: rows.filter((row) => row.genset.id === genset.id).map(({run}) => run),
      })),
    [summary.gensets, rows],
  );

  const energyNote =
    'Energy is what these sets produced, not what the site drew — only the duty set feeds the load, and a set turning while isolated is off-load.';

  const exportCsv = () => {
    const text = runsCsv({
      scope: 'Site',
      name: summary.site.name,
      place: summary.site.locationLabel,
      range,
      earliest,
      now,
      rows: rows.map(({run, genset}) => ({run, assetTag: genset.tag})),
      totals,
      energyNote,
    });

    downloadText(runsCsvFilename(summary.site.name, range), text, 'text/csv');
  };

  return (
    <RunsPanel
      window={search.window}
      range={range}
      customFrom={search.from}
      customTo={search.to}
      earliest={earliest}
      now={now}
      lanes={lanes}
      rows={rows}
      totals={totals}
      heldCount={all.length}
      showAsset
      energyNote={energyNote}
      onWindowChange={(window: RunWindow) =>
        onSearchChange({...clearedRunsRange(search), window})
      }
      onCustomChange={(from, to) => onSearchChange({...search, from, to})}
      onExport={exportCsv}
    />
  );
};
