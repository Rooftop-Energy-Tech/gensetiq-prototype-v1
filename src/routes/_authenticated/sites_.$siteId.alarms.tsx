import {createFileRoute, useParams} from '@tanstack/react-router';

import {SiteAlarms} from '@/modules/site/components/SiteAlarms';

/**
 * Everything standing on the site, from every device that raises an alarm here.
 *
 * ## The pool, done properly this time
 *
 * The original placeholder promised "every active threshold across this site's
 * gensets, pooled into one list". That was replaced by the monitoring unit's twelve
 * `SITE` registers, on the argument that a genset's alarms are its controller's and
 * a second copy under another heading is two screens that can disagree.
 *
 * The argument was right and the conclusion was wrong. A copy would disagree; a
 * **pool that is the same rows** cannot, because there is one handling store keyed on
 * each alarm's own id and every source here is the identical call the asset's own tab
 * makes. So acknowledging a dropped phase from this page acknowledges it on the
 * genset's, and the queue on this page is the four Alarms tabs added together — see
 * `siteAlarmQueue.ts`.
 *
 * What this page has that no single asset's does is the **total**: what is wrong at
 * this site, worst first, whoever's box is saying so. The unit's whole poll table is
 * still here at the one site that has a unit, folded away at the foot, because *what
 * is this device set to watch* is a real question and a different one.
 *
 * ## Why there is no `isMonitored` gate any more
 *
 * There was one, and it was wrong. It sent twenty-four of the twenty-five sites to a
 * placeholder saying no monitoring unit was fitted — true, and beside the point,
 * because **a unit is not the only thing on a site that raises an alarm.** Every one
 * of the twenty-five has at least one genset, each genset has a Deep Sea controller
 * reporting its own bits, and four of them have an array this app derives conditions
 * over.
 *
 * So the gate was hiding real rows behind a page that said there were none, while
 * each site's home strip counted them correctly: WPKL-0207 read **9 standing** in its
 * strip and *coming soon* on this tab, one click apart. A summary that disagrees with
 * the page it summarises is the exact failure this whole section was rebuilt to fix,
 * and the gate was reintroducing it at twenty-four sites out of twenty-five.
 *
 * Ten sites have nothing standing at all right now, and they get `Nothing standing`
 * from a real queue rather than a placeholder — which is a different and better claim:
 * the controllers are reporting and asserting nothing, rather than nobody having
 * built the page yet.
 */
const SiteAlarmsRoute = () => {
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});

  return <SiteAlarms key={siteId} siteId={siteId} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/alarms')({
  component: SiteAlarmsRoute,
});
