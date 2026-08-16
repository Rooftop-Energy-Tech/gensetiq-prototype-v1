import {Link} from '@tanstack/react-router';
import {ActivityIcon, CircleIcon, PackageIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {METER_POINT_LABEL} from '../types/meter.type';
import type {PowerMeter} from '../types/meter.type';
import {meterSiteName} from '../data/meters';

/**
 * The metering estate as a list.
 *
 * Built in the sites table's language — sticky 40px header, 52px rows, hairline
 * rules — because it answers the same shape of question about a different object,
 * and a third table pattern would be a third thing to learn for no gain.
 *
 * The columns are the questions a meter gets asked, in order: *which device*, *is it
 * working*, *where is it*, *what is it wired to*, *what does it say*. Site and circuit
 * are separate columns rather than one "Fitted at" string, because the reader
 * scanning for gaps is scanning one of them at a time — either "which sites have
 * nothing" or "how many mains circuits are covered".
 */
const COLUMNS = [
  {label: 'Meter', width: '24%'},
  {label: 'Status', width: '16%'},
  {label: 'Site', width: '20%'},
  {label: 'Circuit', width: '20%'},
  {label: 'Reading', width: '20%'},
] as const;

/**
 * What this device is reporting right now.
 *
 * A meter in stores is not a fault and does not get one: it reads `—`, because a box
 * on a shelf has nothing to say and "0 kW" would be a measurement it never took.
 */
const reading = (meter: PowerMeter, kw: number | null): string => {
  if (meter.fitting === null) return '—';
  if (!meter.online) return 'No reading';
  return kw === null ? '—' : amount(kw, 'kW');
};

export const MetersTable = ({
  meters,
  /** What each fitted meter reads, by meter id — the site's load, from `sites.ts`. */
  readings,
}: {
  meters: Array<PowerMeter>;
  readings: Record<string, number | null>;
}) => (
  <div className="h-full overflow-auto">
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <caption className="sr-only">
        Power meters, with where each is fitted and what it is reading
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
        {meters.map((meter) => {
          const fitting = meter.fitting;

          return (
            <tr key={meter.id}>
              <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                <span className="block truncate text-primary">{meter.serial}</span>
                <span className="block truncate text-xs text-tertiary">{meter.model}</span>
              </td>

              <td className="h-13 border-b border-subtle p-2">
                {fitting === null ? (
                  <Badge variant="secondary">
                    <PackageIcon className="text-tertiary" aria-hidden="true" />
                    In stores
                  </Badge>
                ) : meter.online ? (
                  <Badge variant="secondary">
                    <CircleIcon className="text-severity-ok" aria-hidden="true" />
                    Reporting
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <ActivityIcon className="text-severity-warning" aria-hidden="true" />
                    Not reporting
                  </Badge>
                )}
              </td>

              <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                {fitting === null ? (
                  <span className="text-tertiary">—</span>
                ) : (
                  // Straight through to the site's Settings tab, which is where this
                  // meter's fitting is actually changed — a list that showed a
                  // placement with no route to editing it would be a dead end.
                  <Link
                    to="/sites/$siteId/settings"
                    params={{siteId: fitting.siteId}}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {meterSiteName(fitting.siteId)}
                  </Link>
                )}
              </td>

              <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                {fitting === null ? (
                  <span className="text-tertiary">—</span>
                ) : (
                  METER_POINT_LABEL[fitting.point]
                )}
              </td>

              <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                {reading(meter, readings[meter.id] ?? null)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
