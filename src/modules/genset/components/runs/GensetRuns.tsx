import {useMemo, useState} from 'react';

import {downloadText} from '@/lib/download';
import {gensetRuns, historyStart} from '../../data/history';
import {runsCsv, runsCsvFilename} from '../../data/runsCsv';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import {clearedRunsRange, runTotals, runsOverlapping, runsRange} from '../../types/runsView.type';
import type {RunWindow, RunsSearch} from '../../types/runsView.type';
import {RunsPanel} from './RunsPanel';

/**
 * One genset's run log.
 *
 * The run card on the home page shows the current run and points its arrow here,
 * which is the journey this tab is built around: a reader looking at one run's
 * totals is one click from asking how it compares with the last twenty. So the
 * comparison — the strip and the window totals — comes before the list, not after.
 */
export const GensetRuns = ({
  genset,
  search,
  onSearchChange,
}: {
  genset: Genset;
  search: RunsSearch;
  onSearchChange: (search: RunsSearch) => void;
}) => {
  // One clock reading for the page, as everywhere else here: the window, the strip
  // and every open run's elapsed time are measured from the same instant, so two
  // rows cannot disagree about what minute it is.
  const [now] = useState(() => Date.now());

  const all = useMemo(() => gensetRuns(genset.id), [genset.id]);
  const earliest = historyStart();
  const range = runsRange(search, now, earliest);

  const runs = useMemo(() => runsOverlapping(all, range, (run) => run), [all, range]);
  const totals = useMemo(() => runTotals(runs, range, now), [runs, range, now]);

  const exportCsv = () => {
    const text = runsCsv({
      scope: 'Genset',
      name: gensetName(genset),
      place: genset.locationLabel,
      range,
      earliest,
      now,
      rows: runs.map((run) => ({run, assetTag: undefined})),
      totals,
      energyNote: undefined,
    });

    downloadText(runsCsvFilename(genset.tag, range), text, 'text/csv');
  };

  return (
    <RunsPanel
      window={search.window}
      range={range}
      customFrom={search.from}
      customTo={search.to}
      earliest={earliest}
      now={now}
      lanes={[{label: undefined, runs}]}
      rows={runs.map((run) => ({run, genset}))}
      totals={totals}
      heldCount={all.length}
      showAsset={false}
      energyNote={undefined}
      onWindowChange={(window: RunWindow) =>
        onSearchChange({...clearedRunsRange(search), window})
      }
      onCustomChange={(from, to) => onSearchChange({...search, from, to})}
      onExport={exportCsv}
    />
  );
};
