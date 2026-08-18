import {useState} from 'react';
import {Link} from '@tanstack/react-router';

import {amount, duration, stampAt} from '@/lib/format';
import {DEFAULT_RUN_WINDOW} from '../../types/runsView.type';
import {deploymentElapsedMs} from '../../types/deployment.type';
import {deploymentTotals, gensetDeployments} from '../../data/deployments';
import type {Genset} from '../../types/genset.type';

/**
 * One genset's posting log — every deployment this machine has been sent on,
 * ongoing first, with what each posting cost.
 *
 * The runs tab scopes *runs* by posting through a dropdown; this tab is the
 * other way round — the postings themselves as the rows, because "where has
 * this set been, and what did each stay cost" is a question about the
 * machine's working life, not about any one window. Every figure is read off
 * the same run log and fuel ladder the rest of the app draws, so a posting's
 * row here reconciles with the dispatch feed's row for the same posting, and
 * with the runs tab scoped to it.
 */
export const GensetDeploymentLog = ({genset}: {genset: Genset}) => {
  // One clock reading for the page — an ongoing posting's elapsed time and its
  // totals must be measured against the same instant.
  const [now] = useState(() => Date.now());

  const deployments = gensetDeployments(genset.id);
  const ongoing = deployments.filter((deployment) => deployment.endedAt === null);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Postings held" value={String(deployments.length)} />
        <Metric label="Ongoing" value={String(ongoing.length)} />
        <Metric
          label="Standing at"
          value={ongoing.length > 0 ? ongoing[0].locationLabel : 'In depot'}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-subtle bg-element">
        {deployments.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-secondary">
            No postings held. This set has not been deployed in the period this log covers.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Posted to</Th>
                  <Th>Window</Th>
                  <Th align="right">Duration</Th>
                  <Th align="right">On load</Th>
                  <Th align="right">Starts</Th>
                  <Th align="right">Energy</Th>
                  <Th align="right">Fuel burned</Th>
                  <Th align="right">SFC</Th>
                </tr>
              </thead>

              <tbody>
                {deployments.map((deployment) => {
                  const totals = deploymentTotals(deployment);
                  const sfc =
                    totals.fuelBurnedLitres > 0
                      ? `${(totals.energyKwh / totals.fuelBurnedLitres).toFixed(2)} kWh/L`
                      : '—';

                  return (
                    <tr key={deployment.id} className="border-b border-subtle last:border-b-0">
                      {/* The place is the link, into the runs this posting
                          contains — the same journey the runs tab's dropdown
                          makes, entered from the other end. */}
                      <td className="px-3 py-2.5">
                        <Link
                          to="/gensets/$gensetId/runs"
                          params={{gensetId: genset.id}}
                          search={{window: DEFAULT_RUN_WINDOW, dep: deployment.id}}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {deployment.locationLabel}
                        </Link>
                        <span className="block text-xs text-tertiary">
                          Carried by {deployment.lorryPlate}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-secondary">
                        <span className="block whitespace-nowrap">
                          {stampAt(deployment.startedAt)}
                        </span>
                        <span className="block whitespace-nowrap text-xs">
                          {deployment.endedAt === null ? (
                            <span className="text-teal">Ongoing</span>
                          ) : (
                            `to ${stampAt(deployment.endedAt)}`
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {duration(deploymentElapsedMs(deployment, now))}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {totals.runtimeHours < 1 && totals.runtimeHours > 0
                          ? 'under 1 h'
                          : `${Math.round(totals.runtimeHours)} h`}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {totals.starts}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {amount(Math.round(totals.energyKwh), 'kWh')}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {amount(Math.round(totals.fuelBurnedLitres), 'L')}
                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                        {sfc}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-secondary">
        Figures are read off the run log, clipped to each posting's window — a posting's row
        here matches the dispatch feed's row for the same posting, and the Runs tab scoped to
        it. Fuel burned is the flow meter's figure; fuel that left the tank without reaching
        the engine is the fuel-integrity alarm's business, not this table's.
      </p>
    </div>
  );
};

const Metric = ({label, value}: {label: string; value: string}) => (
  <div className="flex flex-col gap-1 rounded-md border border-default bg-element px-3 py-2.5">
    <span className="text-xs text-secondary">{label}</span>
    <span className="truncate text-base font-medium text-primary tabular-nums">{value}</span>
  </div>
);

const Th = ({children, align}: {children: React.ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={`px-3 py-2 font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
  >
    {children}
  </th>
);
