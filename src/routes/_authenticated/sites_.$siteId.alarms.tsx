import {createFileRoute, useParams} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';
import {SiteAlarms} from '@/modules/site/components/SiteAlarms';
import {isMonitored} from '@/modules/site/data/monitoringUnit';

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
 * still here, folded away at the foot, because *what is this device set to watch* is
 * a real question and a different one.
 *
 * ## Why it is empty at twenty-four of the twenty-five
 *
 * Because a unit is fitted at one. Every other figure on this estate is derived from
 * a load and a hash, which is honest for a site nobody has visited; a real poll table
 * is not derivable, so the sites without one keep the placeholder.
 */
const SiteAlarmsRoute = () => {
  const {siteId} = useParams({from: '/_authenticated/sites_/$siteId'});

  if (!isMonitored(siteId)) {
    return (
      <ComingSoon
        icon={BellIcon}
        title="Site alarms"
        description="Everything standing on this site in one queue — the plant's own alarms, each genset controller's, the bank's and the array's. The plant half comes off a site monitoring unit, and no unit is fitted here yet. SBH-1336 has one."
      />
    );
  }

  return <SiteAlarms key={siteId} siteId={siteId} />;
};

export const Route = createFileRoute('/_authenticated/sites_/$siteId/alarms')({
  component: SiteAlarmsRoute,
});
