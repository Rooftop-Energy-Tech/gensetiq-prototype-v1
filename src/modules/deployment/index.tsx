import {useMemo, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {CircleIcon, SearchIcon, SearchXIcon, TruckIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {allDeployments, deploymentTotals} from '@/modules/genset/data/deployments';
import {gensetById} from '@/modules/genset/data/detail';
import type {DeploymentSession} from '@/modules/genset/types/deployment.type';
import {siteLabel} from '@/modules/site/data/siteSeed';

/**
 * `/deployment` — the dispatch feed.
 *
 * A flat feed of postings rather than a per-genset view, because the question it
 * answers is an operations-room question: **what is out, where, and since when?**
 * Ongoing postings lead; the completed ones underneath are the record — where
 * each machine has been, what the posting cost in hours and litres, and which
 * lorry carried it.
 *
 * The physical move is still a truck and a driver. Nothing here commands one —
 * a posting opens when the machine is attached to a site and closes when it is
 * collected, and this feed is the paper trail those events leave.
 *
 * Built in the meters table's language — sticky header, fixed columns, hairline
 * rules — because it answers the same shape of question about a different object.
 */

const COLUMNS = [
  {label: 'Genset', width: '17%'},
  {label: 'Status', width: '11%'},
  {label: 'Site', width: '15%'},
  {label: 'Window', width: '17%'},
  {label: 'On load', width: '10%'},
  {label: 'Energy', width: '10%'},
  {label: 'Fuel burned', width: '10%'},
  {label: 'Lorry', width: '10%'},
] as const;

/** "12 Aug – ongoing" / "3 Aug – 14 Aug". The posting's span, tersely. */
const windowLabel = (deployment: DeploymentSession): string =>
  deployment.endedAt === null
    ? `${dayMonth(deployment.startedAt)} – ongoing`
    : `${dayMonth(deployment.startedAt)} – ${dayMonth(deployment.endedAt)}`;

const matches = (deployment: DeploymentSession, needle: string): boolean => {
  const genset = gensetById(deployment.gensetId);
  return [
    genset?.tag ?? '',
    genset?.model ?? '',
    deployment.locationLabel,
    siteLabel(deployment.siteId),
    deployment.lorryPlate,
  ].some((field) => field.toLowerCase().includes(needle));
};

export const DeploymentPage = () => {
  const [q, setQ] = useState('');
  const now = useMemo(() => Date.now(), []);

  const all = useMemo(() => allDeployments(), []);
  const deployments = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle === '' ? all : all.filter((deployment) => matches(deployment, needle));
  }, [all, q]);

  const ongoing = all.filter((deployment) => deployment.endedAt === null).length;
  const completed = all.length - ongoing;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* The fleet screen's search box, for the same job: it matches the tag,
            the model, the yard and the lorry plate. */}
        <InputGroup className="w-full max-w-[373px]">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search deployments"
            aria-label="Search deployments"
          />
        </InputGroup>

        {/* The estate in one line: what is out now, and how deep the record goes. */}
        <p className="text-sm text-secondary">
          {ongoing} deployed · {completed} completed in the last 60 days
        </p>
      </div>

      {deployments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
          <p className="text-sm text-secondary">No deployments match “{q}”.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Genset deployments, ongoing first, with each posting's window and totals
            </caption>
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.label} style={{width: column.width}} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment) => {
                const genset = gensetById(deployment.gensetId);
                const totals = deploymentTotals(deployment);
                const elapsed =
                  (deployment.endedAt === null ? now : new Date(deployment.endedAt).getTime()) -
                  new Date(deployment.startedAt).getTime();

                return (
                  <tr key={deployment.id}>
                    <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: deployment.gensetId}}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {genset?.tag ?? deployment.gensetId}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {genset?.model ?? ''}
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2">
                      {deployment.endedAt === null ? (
                        <Badge variant="secondary">
                          <CircleIcon className="text-severity-ok" aria-hidden="true" />
                          Deployed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <TruckIcon className="text-tertiary" aria-hidden="true" />
                          Completed
                        </Badge>
                      )}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2">
                      <Link
                        to="/sites/$siteId"
                        params={{siteId: deployment.siteId}}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {siteLabel(deployment.siteId)}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {deployment.locationLabel}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      <span
                        className="block truncate"
                        title={`${stampDate(deployment.startedAt)}${deployment.endedAt === null ? '' : ` to ${stampDate(deployment.endedAt)}`}`}
                      >
                        {windowLabel(deployment)}
                      </span>
                      <span className="block truncate text-xs text-tertiary">
                        {duration(elapsed)}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      <span
                        className="block truncate"
                        title={`${totals.starts} start${totals.starts === 1 ? '' : 's'} inside this deployment`}
                      >
                        {amount(totals.runtimeHours, 'h')}
                      </span>
                      <span className="block truncate text-xs text-tertiary">
                        {totals.starts} start{totals.starts === 1 ? '' : 's'}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {amount(totals.energyKwh, 'kWh')}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {amount(totals.fuelBurnedLitres, 'L')}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {deployment.lorryPlate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
