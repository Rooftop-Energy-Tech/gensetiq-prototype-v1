import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, PlugZapIcon, UtilityPoleIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {RunStateBadge} from '@/modules/genset/components/RunStateBadge';
import type {GensetCondition} from '@/modules/genset/types/alert.type';
import {SITE_KIND_LABEL, siteFeed} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {useSitePowerRole} from '../data/siteConfig';

const DetailRow = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-center gap-px">
    {/* 122px matches the fleet panel's label column, so the two previews line up
        their values at the same place. */}
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">{label}</dt>
    <dd className="flex min-w-0 flex-1 items-center truncate text-primary">{children}</dd>
  </div>
);

const ConditionBadge = ({condition}: {condition: GensetCondition}) => {
  const {label, icon: Icon, textClassName} = CONDITION_META[condition];

  return (
    <Badge variant="secondary">
      <Icon className={textClassName} aria-hidden="true" />
      {label}
    </Badge>
  );
};

/**
 * What is feeding the yard, in one badge.
 *
 * Reads the site page's own `siteFeed` off `defaultDutyId` — the set the
 * changeover starts on — so the preview and the page a reader is about to open
 * cannot disagree about who has the load. The transfer an operator can make on
 * that page is component state there and deliberately not represented here: this
 * is a preview of the site, not a second control surface for it.
 */
const SupplyBadge = ({summary}: {summary: SiteSummary}) => {
  const role = useSitePowerRole(summary.site.id);
  const feed = siteFeed(summary, summary.defaultDutyId, role);

  const supply =
    feed.source === 'MAINS'
      ? {label: 'On mains', icon: UtilityPoleIcon, live: true}
      : feed.source === 'GENSET'
        ? {label: 'On generator', icon: PlugZapIcon, live: true}
        : // Both roles reach this and it is an outage in both — the grid is down and
          // no set picked the load up, or there is no grid and nothing is generating.
          {label: 'Not served', icon: PlugZapIcon, live: false};

  const SupplyIcon = supply.icon;

  return (
    <Badge variant="element" className="border-subtle">
      <SupplyIcon className={supply.live ? 'text-teal' : 'text-tertiary'} aria-hidden="true" />
      {supply.label}
    </Badge>
  );
};

/**
 * The site preview beside the list and over the map.
 *
 * The fleet panel is the model, and the columns it carries are the same shape of
 * thing: the facts a pin cannot state, and a way out of itself. What differs is
 * the body — a site has no activity feed of its own, because nothing happens to a
 * *place*. What happens happens to the machines standing on it, so the sets
 * themselves are the body, worst first, each linking to its own page.
 *
 * Installed capacity is here and site draw is not, for the reason the list gives:
 * draw is instantaneous and changes while you read it, which makes it a
 * detail-page figure. Capacity read against the sets standing here is the fact
 * this panel can state and the map cannot.
 */
export const SiteDetailPanel = ({
  summary,
  className,
}: {
  summary: SiteSummary | undefined;
  className?: string;
}) => {
  return (
    <aside
      aria-label="Site details"
      className={cn(
        'flex flex-col gap-3 overflow-y-auto rounded-md border border-default bg-overlay px-4 py-3 text-sm',
        className,
      )}
    >
      {summary === undefined ? (
        <p className="my-auto px-2 text-center text-secondary">
          Select a site to see its details.
        </p>
      ) : (
        <>
          {/* The panel is a preview, so it needs a way out of itself. Over the map
              this arrow is the *only* way into the site's own pages — a pin has
              nowhere to put a link, and clicking one has to keep you on the map or
              the selection is useless. */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-medium text-primary">{summary.site.name}</h2>
              <p className="truncate text-xs text-secondary">
                {SITE_KIND_LABEL[summary.site.kind]}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
                  <Link
                    to="/sites/$siteId"
                    params={{siteId: summary.site.id}}
                    aria-label={`Open ${summary.site.name}`}
                  >
                    <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Open site</TooltipContent>
            </Tooltip>
          </div>

          <SupplyBadge summary={summary} />

          <dl className="flex flex-col">
            <DetailRow label="Condition">
              <ConditionBadge condition={summary.condition} />
            </DetailRow>
            <DetailRow label="Location">{summary.site.locationLabel}</DetailRow>
            <DetailRow label="Installed capacity">{amount(summary.ratedKw, 'kW')}</DetailRow>
            <DetailRow label="Fuel on site">
              <span className="whitespace-pre">
                {fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
              </span>
            </DetailRow>
          </dl>

          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="font-medium text-primary">
              Gensets
              <span className="font-normal text-secondary">
                {' · '}
                {summary.runningCount} of {summary.gensets.length} running
              </span>
            </h3>

            {summary.gensets.length === 0 ? (
              // A real state rather than an edge case: a site can be stripped of its
              // sets from the settings tab, and the yard and its load remain.
              <p className="text-secondary">No gensets are standing at this site.</p>
            ) : (
              <ul className="flex flex-col">
                {summary.gensets.map(({genset}) => (
                  <li
                    key={genset.id}
                    className="flex items-center justify-between gap-2 border-b border-subtle py-2 last:border-b-0"
                  >
                    <Link
                      to="/gensets/$gensetId"
                      params={{gensetId: genset.id}}
                      className="min-w-0 truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                    >
                      {genset.tag}
                    </Link>
                    <RunStateBadge runState={genset.runState} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </aside>
  );
};
