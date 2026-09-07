import {useMemo} from 'react';

import {useSitePowerRole} from '../data/siteConfig';
import {siteSeed} from '../data/siteSeed';
import {hasOverview} from '../data/siteOverview';
import {siteTrendMetrics} from '../data/siteTrend';
import type {SiteSummary} from '../data/sites';
import {OVERVIEW_VIEW, TrendPanel} from './TrendPanel';
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
 * with no array has no `Solar generation` option rather than one that draws a flat
 * zero, which is the same rule the rest of the page follows about plant that isn't
 * fitted.
 */
export const SiteDiagnostics = ({summary, now}: {summary: SiteSummary; now: number}) => {
  const {site, gensets} = summary;
  const role = useSitePowerRole(site.id);
  const seed = siteSeed(site.id);

  /**
   * `Energy overview` first at a hybrid, then the single-series views behind it.
   *
   * Leading rather than replacing, for two reasons. A hybrid's first question is
   * what carried the load, so that is what the band should open on — but the
   * single-series views are still the diagnostic: an operator who has seen the
   * overlay and wants to know whether *this* array is down needs one curve on one
   * axis with nothing else on it, and four superimposed bands is the wrong picture
   * for that. Non-hybrid sites are unchanged and open on the picker they had, where
   * one series really is all there is to draw.
   */
  const metrics = useMemo((): ReadonlyArray<TrendView> => {
    if (seed === undefined) return [];
    const single = siteTrendMetrics(seed, role, gensets.length);
    return hasOverview(seed, role) ? [OVERVIEW_VIEW, ...single] : single;
  }, [seed, role, gensets.length]);

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
      role={role}
      gensetIds={gensetIds}
      metrics={metrics}
      overviewRatedKw={summary.ratedKw}
      now={now}
      ariaLabel="Site diagnostics"
    />
  );
};
