import {Link} from '@tanstack/react-router';
import {CheckIcon, ClockIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, stampAt} from '@/lib/format';
import {DEFAULT_RUN_WINDOW} from '../../types/runsView.type';
import {gensetDeployments} from '../../data/deployments';
import {gensetRefuelOrders} from '../../data/refuelOrders';
import type {Genset} from '../../types/genset.type';

/**
 * One genset's refuel log — the dashboard's cut of the same orders the
 * fleet-wide Refuel page lists, so a delivery can never say one thing on the
 * operations screen and another on the machine's own page.
 *
 * The shape mirrors the fleet page's reading of an order: a refuel is a work
 * order, *issued* by the operations room and *completed* when the fuel goes
 * in, and the status is derived from whether the second timestamp exists.
 * Outstanding orders lead, because "what is the tanker still owed" is the
 * question a reader opens this tab with.
 */
export const GensetRefuelLog = ({genset}: {genset: Genset}) => {
  const orders = gensetRefuelOrders(genset.id);
  const deployments = gensetDeployments(genset.id);

  const outstanding = orders.filter((order) => order.refueledAt === null);
  const owedLitres = outstanding.reduce((sum, order) => sum + order.litres, 0);

  const postingOf = (deploymentId: string | null) =>
    deploymentId === null
      ? undefined
      : deployments.find((deployment) => deployment.id === deploymentId);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Orders held" value={String(orders.length)} />
        <Metric label="Outstanding" value={String(outstanding.length)} />
        <Metric label="Litres owed" value={amount(owedLitres, 'L')} />
        <Metric
          label="Litres delivered"
          value={amount(
            orders
              .filter((order) => order.refueledAt !== null)
              .reduce((sum, order) => sum + order.litres, 0),
            'L',
          )}
        />
      </div>

      <p className="text-xs text-secondary">
        Every completed order here is a delivery the fuel chart already draws — same instant,
        same litres. An order still outstanding is a tanker owed, not fuel in the tank.
      </p>

      <div className="overflow-hidden rounded-md border border-subtle bg-element">
        {orders.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-secondary">
            No refuel orders held for this genset.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-xs text-secondary">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Issued
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Litres
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Refuelled
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Posting
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => {
                const posting = postingOf(order.deploymentId);

                return (
                  <tr key={order.id} className="border-b border-subtle last:border-b-0">
                    <td className="px-3 py-2.5">
                      <span className="block text-primary">{stampAt(order.issuedAt)}</span>
                      <span className="block text-xs text-tertiary">by {order.issuedBy}</span>
                    </td>

                    <td className="px-3 py-2.5">
                      {order.refueledAt === null ? (
                        <Badge variant="secondary">
                          <ClockIcon className="text-severity-warning" aria-hidden="true" />
                          Issued
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <CheckIcon className="text-severity-ok" aria-hidden="true" />
                          Completed
                        </Badge>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                      {amount(order.litres, 'L')}
                    </td>

                    <td className="px-3 py-2.5 text-secondary">
                      {order.refueledAt === null ? (
                        <span className="text-severity-warning">Tanker owed</span>
                      ) : (
                        stampAt(order.refueledAt)
                      )}
                    </td>

                    {/* The posting the delivery landed in, linking to the runs it
                        fuelled — or the honest in-between: a tank topped up in the
                        depot belongs to no posting, and inventing one would break
                        the reconciliation this log exists for. */}
                    <td className="px-3 py-2.5">
                      {posting === undefined ? (
                        <span className="text-xs text-tertiary">Between postings</span>
                      ) : (
                        <Link
                          to="/gensets/$gensetId/runs"
                          params={{gensetId: genset.id}}
                          search={{window: DEFAULT_RUN_WINDOW, dep: posting.id}}
                          className="text-secondary underline-offset-4 hover:text-primary hover:underline"
                        >
                          {posting.locationLabel}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const Metric = ({label, value}: {label: string; value: string}) => (
  <div className="flex flex-col gap-1 rounded-md border border-default bg-element px-3 py-2.5">
    <span className="text-xs text-secondary">{label}</span>
    <span className="text-base font-medium text-primary tabular-nums">{value}</span>
  </div>
);
