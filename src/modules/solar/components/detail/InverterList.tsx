import {Link} from '@tanstack/react-router';

import {Badge} from '@/components/ui/badge';
import {amount, relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {SystemAlert} from '../../types/health.type';
import type {Inverter, SolarSystem} from '../../types/system.type';
import {INVERTER_STATE_META} from '../inverterStateMeta';

/**
 * Band 2 — **what the system is made of, and what each part is doing.**
 *
 * ## Why this replaced a control pad and four dials
 *
 * The band used to be one pad and one set of gauges, which was only coherent
 * because every system on the demo estate had exactly one inverter. Ask a
 * 1.3 MW plant with ten boxes for "the DC current" and there is no answer —
 * there are ten, and the whole diagnostic value is in which one is different.
 *
 * So the dials and the pad moved down onto each box's own page, and this band
 * became the list that points at them. It is the same move `SiteHome` makes for
 * gensets: a place shows you its machines with enough state to pick one, and the
 * machine's own page has the controls.
 *
 * ## Always a list, even at one row
 *
 * At every CelcomDigi site this is a single row, and inlining that one box's
 * dials here instead would be a layout that changes shape with the data — the
 * thing the README warns about, because a screen that looks different depending
 * on what is at the site teaches a reader that they cannot trust what they
 * learned last time.
 *
 * ## The share column is the point of the table
 *
 * Every other column says what a box *is*. `Share` says what it is contributing
 * against what it should — its output as a fraction of the system's, over its
 * nameplate as a fraction of the system's. A healthy plant is a column of
 * hundreds. One box at 60% is the fault, found by scanning rather than by
 * opening ten pages.
 */

const COLUMNS = [
  {label: 'Inverter', width: '24%'},
  {label: 'State', width: '13%'},
  {label: 'Output', width: '11%'},
  {label: 'Share', width: '10%'},
  {label: 'Strings', width: '13%'},
  {label: 'Mode', width: '10%'},
  {label: '', width: '19%'},
] as const;

/**
 * What this box is delivering against what its size says it should, as a
 * percentage. `null` where the system is making nothing, since every box's share
 * of zero is zero and a column of `—` is more honest than a column of `0%`.
 */
const shareOf = (system: SolarSystem, inverter: Inverter): number | null => {
  if (system.outputKw <= 0 || inverter.state !== 'GENERATING') return null;
  const expected = system.kwp > 0 ? inverter.kwp / system.kwp : 0;
  if (expected <= 0) return null;
  return (inverter.outputKw / system.outputKw) / expected;
};

const InverterRow = ({
  system,
  inverter,
  alerts,
  now,
}: {
  system: SolarSystem;
  inverter: Inverter;
  alerts: Array<SystemAlert>;
  now: number;
}) => {
  const meta = INVERTER_STATE_META[inverter.state];
  const share = shareOf(system, inverter);
  const short = share !== null && share < 0.9;
  const worst = alerts.find((alert) => alert.inverterId === inverter.id);

  return (
    <tr>
      <td className="h-13 truncate border-b border-subtle p-2 font-medium">
        <Link
          to="/solar/$systemId/inverters/$inverterId"
          params={{systemId: system.id, inverterId: inverter.id}}
          className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          {inverter.label}
        </Link>
        <span className="block truncate text-xs text-tertiary">
          {inverter.model} · {inverter.kwp} kWp
        </span>
      </td>

      <td className="h-13 border-b border-subtle p-2">
        <Badge variant="element" className="border-subtle">
          <meta.icon className={cn('size-3', meta.iconClassName)} aria-hidden="true" />
          {meta.label}
        </Badge>
        {inverter.state === 'OFFLINE' && (
          <span className="block truncate text-xs text-tertiary">
            {relativeTime(inverter.lastUpdated, now)}
          </span>
        )}
      </td>

      <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
        {/* Blank rather than `0 kW` where there is no output to report — a box at
            night has none, and a silent one has none we know of. */}
        {inverter.state === 'GENERATING' ? amount(inverter.outputKw, 'kW', 1) : '—'}
      </td>

      <td
        className={cn(
          'h-13 truncate border-b border-subtle p-2 tabular-nums',
          short ? 'text-severity-warning' : 'text-primary',
        )}
      >
        {share === null ? '—' : `${Math.round(share * 100)}%`}
      </td>

      <td className="h-13 truncate border-b border-subtle p-2 tabular-nums">
        <span className={inverter.downStrings > 0 ? 'text-severity-critical' : 'text-secondary'}>
          {inverter.strings - inverter.downStrings} of {inverter.strings}
        </span>
      </td>

      <td className="h-13 truncate border-b border-subtle p-2 text-xs text-secondary">
        {inverter.controlMode}
      </td>

      <td className="h-13 truncate border-b border-subtle p-2 text-xs">
        {worst !== undefined && (
          <span
            className={
              worst.severity === 'CRITICAL' ? 'text-severity-critical' : 'text-severity-warning'
            }
          >
            {worst.name}
          </span>
        )}
      </td>
    </tr>
  );
};

export const InverterList = ({
  system,
  alerts,
  now,
}: {
  system: SolarSystem;
  alerts: Array<SystemAlert>;
  now: number;
}) => (
  <section aria-label="Inverters" className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <h3 className="text-sm font-medium text-primary">
        {system.inverters.length === 1
          ? 'Inverter'
          : `${system.inverters.length} inverters · ${system.acKw} kW AC`}
      </h3>
      <span className="text-xs text-tertiary">
        {/* The two capacities side by side, and only when they differ. This is the
            figure a silence actually costs: not "offline", but how much of the
            plant nobody can currently see. */}
        {system.reportingKwp === system.kwp
          ? `${system.kwp} kWp reporting`
          : `${system.reportingKwp} of ${system.kwp} kWp reporting`}
      </span>
    </div>

    <div className="min-h-0 overflow-auto">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Every inverter in this system — what it is rated at, what it is doing, and how much
          of the system's output it is carrying
        </caption>
        <colgroup>
          {COLUMNS.map((column, index) => (
            <col key={index} style={{width: column.width}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column, index) => (
              <th
                key={index}
                scope="col"
                className="h-9 border-b border-subtle px-2 text-left font-medium whitespace-nowrap text-secondary"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {system.inverters.map((inverter) => (
            <InverterRow
              key={inverter.id}
              system={system}
              inverter={inverter}
              alerts={alerts}
              now={now}
            />
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
