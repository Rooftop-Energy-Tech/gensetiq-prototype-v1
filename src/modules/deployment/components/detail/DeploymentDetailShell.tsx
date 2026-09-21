import {Outlet} from '@tanstack/react-router';
import {BellIcon, BoomBoxIcon, ClipboardListIcon, SettingsIcon, TruckIcon} from 'lucide-react';

import {DetailSidebar, DetailSidebarBackLink} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {Deployment} from '../../types/deployment.type';
import {DeploymentSwitcher} from './DeploymentSwitcher';

/**
 * Everything one job's pages share: the 240px rail on the left, and an `<Outlet />`
 * beside it.
 *
 * The third of these shells, and deliberately the *same* one: `SiteDetailShell` and
 * `GensetDetailShell` are twins over `DetailSidebar`, and a job differs from them
 * only in its header and its items. A new pattern here would have been a third
 * arrangement of the same five rows.
 *
 * ## The five rows, and why alarms are among them
 *
 * `Deployment` is the job itself. `Gensets` is the one section that *writes*: it is
 * where a machine goes on and where it is collected. `Runs` and `Alarms` are the
 * window's own activity, which is the whole argument for the page — the questions
 * "what did this job run" and "what went wrong while it stood" could only be
 * answered before by opening each machine and reading dates off a calendar.
 * `Settings` amends or closes it.
 *
 * ## The way back is the yard
 *
 * A job is at exactly one site, so the rail's back link is that site, which reuses
 * the machine rail's own way out. There is no back link to the register, because the
 * switcher above the rows is that: the register is one click from the header, and a
 * second door to it would be furniture.
 */
const navEntries = (deployment: Deployment): Array<DetailNavEntry> => {
  const params = {deploymentId: deployment.id};

  return [
    // `end` on this row alone: `/deployments/x` prefixes every route below it, so
    // without an exact match the landing row stays lit on all of them.
    {
      label: 'Deployment',
      icon: TruckIcon,
      to: '/deployments/$deploymentId',
      params,
      end: true,
    },
    {label: 'Gensets', icon: BoomBoxIcon, to: '/deployments/$deploymentId/gensets', params},
    {label: 'Runs', icon: ClipboardListIcon, to: '/deployments/$deploymentId/runs', params},
    {label: 'Alarms', icon: BellIcon, to: '/deployments/$deploymentId/alarms', params},
    {
      label: 'Settings',
      icon: SettingsIcon,
      to: '/deployments/$deploymentId/settings',
      params,
    },
  ];
};

export const DeploymentDetailShell = ({deployment}: {deployment: Deployment}) => {
  const site = siteSeed(deployment.siteId);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DetailSidebar
        ariaLabel="Deployment sections"
        header={<DeploymentSwitcher deployment={deployment} />}
        backLink={
          site === undefined ? undefined : (
            <DetailSidebarBackLink siteId={site.id} name={site.name} />
          )
        }
        entries={navEntries(deployment)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};
