import {useMemo, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {CheckIcon, ClockIcon, SearchIcon, SearchXIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {relativeTime, stampAt} from '@/lib/format';
import {gensetDeployments} from '@/modules/genset/data/deployments';
import {gensetById} from '@/modules/genset/data/detail';
import {REFUEL_ORDERS} from '@/modules/genset/data/refuelOrders';
import type {RefuelOrder} from '@/modules/genset/types/refuelOrder.type';

/**
 * Where the fuel went in — the *posting's* place, not the machine's current one.
 *
 * A completed delivery is history: the set may have moved twice since. Only an
 * order with no posting (a top-up between jobs) or no record falls back.
 */
const deliveryLocation = (order: RefuelOrder): string | undefined =>
  gensetDeployments(order.gensetId).find((deployment) => deployment.id === order.deploymentId)
    ?.locationLabel;

/**
 * `/refuel` — the refuel log, as work orders.
 *
 * The question this page answers is the operations room's: **what has been
 * booked, and what is the tanker still owed?** Outstanding orders lead — each
 * one is a set the overview already counts as needing fuel, with the litres to
 * take out to it. The completed rows underneath are the deliveries themselves,
 * read off the same fuel curve every chart in the app draws, so a delivery
 * listed here is a step-up visible on the tank chart at the same instant.
 *
 * An order's life is two timestamps: *issued*, when somebody books the tanker,
 * and *refuelled*, when the fuel goes in. The status is derived from whether
 * the second exists, exactly as in the production model.
 */

const COLUMNS = [
  {label: 'Genset', width: '18%'},
  {label: 'Status', width: '14%'},
  {label: 'Location', width: '20%'},
  {label: 'Litres', width: '12%'},
  {label: 'Issued', width: '18%'},
  {label: 'Refuelled', width: '18%'},
] as const;

const matches = (order: RefuelOrder, needle: string): boolean => {
  const genset = gensetById(order.gensetId);
  return [
    genset?.tag ?? '',
    genset?.model ?? '',
    genset?.locationLabel ?? '',
    order.issuedBy,
  ].some((field) => field.toLowerCase().includes(needle));
};

export const RefuelPage = () => {
  const [q, setQ] = useState('');
  const [now] = useState(() => Date.now());

  const all = REFUEL_ORDERS;
  const orders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle === '' ? all : all.filter((order) => matches(order, needle));
  }, [all, q]);

  const outstanding = all.filter((order) => order.refueledAt === null);
  const litresOwed = outstanding.reduce((sum, order) => sum + order.litres, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* The fleet screen's search box, for the same job: it matches the tag,
            the model, the placename and who issued the order. */}
        <InputGroup className="w-full max-w-[373px]">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search refuels"
            aria-label="Search refuels"
          />
        </InputGroup>

        {/* The position in one line, and it is deliberately about what is owed
            rather than what was done: the completed rows are the record, but the
            outstanding litres are the morning's work. */}
        <p className="text-sm text-secondary">
          {outstanding.length} outstanding ·{' '}
          {litresOwed.toLocaleString('en-MY')} L to deliver
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
          <p className="text-sm text-secondary">No refuels match “{q}”.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Refuel orders, outstanding first, each with who issued it and when the
              fuel went in
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
              {orders.map((order) => {
                const genset = gensetById(order.gensetId);

                return (
                  <tr key={order.id}>
                    <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: order.gensetId}}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {genset?.tag ?? order.gensetId}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {genset?.model ?? ''}
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2">
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

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      <span className="block truncate">
                        {deliveryLocation(order) ?? genset?.locationLabel ?? '—'}
                      </span>
                      {order.deploymentId === null && (
                        <span className="block truncate text-xs text-tertiary">
                          Between deployments
                        </span>
                      )}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {order.litres.toLocaleString('en-MY')} L
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2">
                      <span className="block truncate text-primary" title={stampAt(order.issuedAt)}>
                        {relativeTime(order.issuedAt, now)}
                      </span>
                      <span className="block truncate text-xs text-tertiary">
                        by {order.issuedBy}
                      </span>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {order.refueledAt === null ? (
                        <span className="text-tertiary">—</span>
                      ) : (
                        <span className="block truncate" title={stampAt(order.refueledAt)}>
                          {stampAt(order.refueledAt)}
                        </span>
                      )}
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
