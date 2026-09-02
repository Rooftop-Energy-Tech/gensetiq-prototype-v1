import {amount} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SITE_KIND_LABEL} from '../data/sites';
import type {SitePowerRole} from '../types/site.type';
import type {SiteSummary} from '../data/sites';
import {supplyLabel} from './supplyMeta';

/**
 * The right half of the second band: what this site *is*, beside the picture of
 * how it is wired.
 *
 * ## Why these sit next to the diagram rather than in the strip above
 *
 * Because they are the diagram's caption. The strip carries the figures that move
 * — generation, fuel, alarms — and a reader checks those to decide whether anything
 * needs doing today. These do not move: how the yard is fed and what is installed
 * are facts about the installation, and their job is to tell you what you are
 * looking at in the drawing beside them. Putting them in the strip would mix two
 * different rates of change in one line.
 *
 * The label/value split is `MetricRow`'s — label left, value hard right — which is
 * the design's, and it is what lets the values line up down the right edge of the
 * band however long the labels get.
 *
 * `Load` is added to the design's two. The frame states how the site is fed and how
 * much is installed but never what the installation is *for*, and the load's
 * tolerance for an outage is what makes everything else on this page urgent or
 * routine. It is the first fact the header's info tooltip carries, so it is not new
 * information — it is the one that had no business being hidden behind a hover.
 */
export const SiteDetails = ({
  summary,
  role,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
}) => (
  <div className="flex w-full flex-col gap-2.5">
    <MetricRow label="Supply" value={supplyLabel(role, summary.gensets.length)} />
    <MetricRow label="Installed capacity" value={amount(summary.ratedKw, 'kW')} />
    <MetricRow label="Load" value={SITE_KIND_LABEL[summary.site.kind]} />
  </div>
);
