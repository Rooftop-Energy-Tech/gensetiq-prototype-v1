import {useMemo} from 'react';

import {siteSeed} from '../data/siteSeed';
import {siteTrendMetrics} from '../data/siteTrend';
import type {SiteSummary} from '../data/sites';
import {TrendPanel} from './TrendPanel';
import type {TrendView} from './TrendPanel';

/**
 * The page's fourth band: *"a way for operators to get a quick preview of what is
 * going on at the site through graphs."*
 *
 * ## Why the metric is a control and not four cards
 *
 * The design draws solar generation and annotates the band *"quick diagnostics of
 * the site; load, genset, battery, and solar generation"* — four quantities, one
 * frame. Four stacked charts would push three of them below the fold and make the
 * band a report rather than a preview; four small ones would each be too short to
 * read a shape off, which is the only reason to draw a curve at all.
 *
 * So it is one full-size chart with a picker. That control is `TrendPanel`, shared
 * with the solar and battery pages — this file is now only the part that is *about
 * a site*: which metrics this particular yard can answer for.
 *
 * A site only offers the metrics it can answer for — see `siteTrendMetrics`. A yard
 * with no set standing on it has no `Genset Fuel Consumption` option rather than one
 * that draws a flat zero, which is the same rule the rest of the page follows about
 * plant that isn't there.
 */
export const SiteDiagnostics = ({summary, now}: {summary: SiteSummary; now: number}) => {
  const {site, gensets} = summary;
  const seed = siteSeed(site.id);

  const metrics = useMemo(
    (): ReadonlyArray<TrendView> => (seed === undefined ? [] : siteTrendMetrics(gensets.length)),
    [seed, gensets.length],
  );

  // Stable across renders, or `TrendPanel`'s series would be rebuilt on every one:
  // a fresh array literal is a new dependency every time.
  const gensetIds = useMemo(
    () => gensets.map((member) => member.genset.id),
    [gensets],
  );

  if (seed === undefined) return null;

  return (
    <TrendPanel
      seed={seed}
      gensetIds={gensetIds}
      metrics={metrics}
      now={now}
      ariaLabel="Site diagnostics"
    />
  );
};
