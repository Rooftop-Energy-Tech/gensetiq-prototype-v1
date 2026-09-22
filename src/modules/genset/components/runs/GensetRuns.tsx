import {useMemo, useState} from 'react';

import {downloadText} from '@/lib/download';
import {gensetPostings} from '@/modules/deployment/data/store';
import {postingEnd} from '@/modules/deployment/types/deployment.type';
import {gensetDetail} from '../../data/detail';
import {gensetRuns, historyStart} from '../../data/history';
import {runsCsv, runsCsvFilename} from '../../data/runsCsv';
import type {Genset} from '../../types/genset.type';
import type {RunRange} from '../../types/runsView.type';
import {clearedRunsRange, runTotals, runsOverlapping, runsRange} from '../../types/runsView.type';
import type {RunWindow, RunsSearch} from '../../types/runsView.type';
import {DeploymentPicker} from './DeploymentPicker';
import {PostingContext} from './PostingContext';
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

  // A posting outranks the presets and the calendar: it is the most specific
  // thing the URL can name, and its window is exact — the totals under it have
  // to reconcile with the same posting's row on the dispatch feed, which a
  // day-granular custom range cannot promise.
  const postings = useMemo(() => gensetPostings(genset.id), [genset.id]);
  const posting = postings.find((candidate) => candidate.deployment.id === search.dep);
  // Where the machine is now, for the unscoped summary — the deployments tab's third
  // tile. `undefined` in the workshop, which the block words as `In depot`.
  const standingAt = postings.find(
    (candidate) => postingEnd(candidate) === null,
  )?.deployment.locationLabel;
  const postingTo = posting === undefined ? null : postingEnd(posting);
  const range: RunRange =
    posting === undefined
      ? runsRange(search, now, earliest)
      : {
          from: Math.max(earliest, new Date(posting.deployment.startsAt).getTime()),
          to: Math.min(now, postingTo === null ? now : new Date(postingTo).getTime()),
          kind: 'deployment',
          requested: undefined,
        };

  const runs = useMemo(() => runsOverlapping(all, range, (run) => run), [all, range]);
  const ratedKw = gensetDetail(genset.id)?.ratedKw;
  const totals = useMemo(() => runTotals(runs, range, now, ratedKw), [runs, range, now, ratedKw]);

  const exportCsv = () => {
    const text = runsCsv({
      scope: 'Genset',
      // The bare tag: `scope` above is the word `Genset`, and the two are printed
      // on one line — `Genset,Genset | BRF9540`. The site export pairs `Site` with
      // a bare site code the same way.
      name: genset.tag,
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
      postingContext={
        <PostingContext
          posting={posting}
          postings={postings}
          standingAt={standingAt}
        />
      }
      deploymentPicker={
        <DeploymentPicker
          postings={postings}
          selectedId={posting?.deployment.id}
          onSelect={(dep) => onSearchChange({...search, from: undefined, to: undefined, dep})}
        />
      }
      onWindowChange={(window: RunWindow) =>
        onSearchChange({...clearedRunsRange(search), window})
      }
      onCustomChange={(from, to) => onSearchChange({...search, from, to, dep: undefined})}
      onExport={exportCsv}
    />
  );
};
