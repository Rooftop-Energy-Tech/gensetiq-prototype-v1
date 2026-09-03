import {Link} from '@tanstack/react-router';
import {SearchIcon, SearchXIcon} from 'lucide-react';
import {useMemo, useState} from 'react';

import {Badge} from '@/components/ui/badge';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {systemDetail} from '../../data/systemDetail';
import {systemHealth} from '../../data/systemHealth';
import {useSolarSystems} from '../../data/systems';
import type {SystemCondition} from '../../types/health.type';
import type {SolarSystem} from '../../types/system.type';
import {INVERTER_STATE_META} from '../inverterStateMeta';
import type {SolarRegisterSearch} from '../../types/register.type';

/**
 * `/solar` — a row per solar system, the way `/gensets` is a row per machine.
 *
 * ## What a row is
 *
 * A **system**: everything PV at one site, taken together. Not an inverter — a
 * flat register of boxes would put ten rows from one mini-grid into a portfolio
 * list. Not an array either, which is the correction this page was rebuilt
 * around: an array is the half of a PV system with no electronics, so nothing
 * reads from it, and every "array" reading in a monitoring product is really an
 * inverter describing its own terminals.
 *
 * The system is what a customer names and what survives its own plant being
 * replaced. The boxes are one click down, in `Devices`.
 *
 * ## Sorted by attention, and not by a column header
 *
 * By condition, then by output — worst first. This is a screen read to find work,
 * and a healthy system is not work; `/gensets` sorts by attention for the same
 * reason and neither makes the reader discover it.
 *
 * The sort is applied here rather than in `solarSystems`, and the first draft had
 * it the other way. That function can only sort by *state*, since it does not
 * build a detail — and state is not condition: a system with a string down is
 * generating perfectly well and is the row somebody needs to see, while a healthy
 * one is also `Generating`. Sorting by state put an `Optimum` system above a
 * `Critical` one, which is a list that quietly stops being read.
 *
 * ## Scale
 *
 * One table, one search box, and nothing that grows with the estate — the rule
 * the README states for the solar screens. Each row builds a `systemDetail` to
 * reach its condition and passes `includeCurve: false`, because the intraday
 * curve is the expensive part of that call and no row draws one.
 */

/** Worst first — the order the rows come out in. */
const CONDITION_ORDER: Record<SystemCondition, number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  OPTIMUM: 2,
};

type RegisterRow = {
  system: SolarSystem;
  condition: SystemCondition;
  /** The worst thing wrong, in the rule's own words, or `undefined`. */
  headline: string | undefined;
};

const COLUMNS = [
  {label: 'System', width: '25%'},
  {label: 'State', width: '15%'},
  {label: 'Output', width: '11%'},
  {label: 'Capacity', width: '12%'},
  {label: 'Inverters', width: '15%'},
  {label: 'Health', width: '22%'},
] as const;

export const SolarRegister = ({
  search,
  onSearchChange,
}: {
  search: SolarRegisterSearch;
  onSearchChange: (next: SolarRegisterSearch) => void;
}) => {
  // One clock for the page. See `useSolarSystems`.
  const [now] = useState(() => Date.now());
  const systems = useSolarSystems(now);

  const rows: Array<RegisterRow> = useMemo(
    () =>
      systems.flatMap((system) => {
        const detail = systemDetail(system, now, false);
        if (detail === undefined) return [];

        const {alerts, condition} = systemHealth(system, detail, now);

        return [
          {
            system,
            condition,
            // The worst one only. A register cell listing three faults would be a
            // page of its own squeezed into a sixth of a row; the system's own
            // health band is one click away and lists them all.
            headline: alerts[0]?.name,
          },
        ];
      }),
    [systems, now],
  );

  const ordered = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          CONDITION_ORDER[left.condition] - CONDITION_ORDER[right.condition] ||
          // Within a condition, the biggest plant first. Two criticals are not
          // equally urgent, and a megawatt down the road matters more today than
          // twenty kilowatts on a rooftop.
          right.system.kwp - left.system.kwp,
      ),
    [rows],
  );

  const query = (search.q ?? '').trim().toLowerCase();
  const shown =
    query === ''
      ? ordered
      : ordered.filter(
          (row) =>
            row.system.siteName.toLowerCase().includes(query) ||
            row.system.locationLabel.toLowerCase().includes(query) ||
            row.system.inverters.some((one) => one.model.toLowerCase().includes(query)),
        );

  const totalKwp = systems.reduce((sum, one) => sum + one.kwp, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-24 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {systems.length} {systems.length === 1 ? 'system' : 'systems'} ·{' '}
          {Math.round(totalKwp).toLocaleString('en-MY')} kWp installed
        </p>

        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon className="size-4" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={search.q ?? ''}
            onChange={(event) => onSearchChange({q: event.target.value || undefined})}
            placeholder="Site, place or inverter"
            aria-label="Search solar systems"
          />
        </InputGroup>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <SearchXIcon className="size-5 text-secondary" aria-hidden="true" />
          <p className="text-sm text-secondary">
            {systems.length === 0
              ? 'No site on this estate is configured as a solar hybrid.'
              : 'No system matches that.'}
          </p>
        </div>
      ) : (
        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Every solar system on the estate — where it is, what it is rated at, what it is
              doing now and what is wrong with it
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
              {shown.map((row) => {
                const {system} = row;
                const meta = CONDITION_META[row.condition];
                const state = INVERTER_STATE_META[system.state];
                const silent = system.inverters.filter((one) => one.state === 'OFFLINE').length;

                return (
                  <tr key={system.id}>
                    <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                      {/* The name is the door, as it is on the fleet list. */}
                      <Link
                        to="/solar/$systemId"
                        params={{systemId: system.id}}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {system.siteName}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {system.locationLabel}
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2">
                      <Badge variant="element" className="border-subtle">
                        <state.icon
                          className={cn('size-3', state.iconClassName)}
                          aria-hidden="true"
                        />
                        {state.label}
                      </Badge>
                      {/* The line that the old model could not draw. A system with
                          one silent box out of ten is not offline — it is a system
                          we can only partly see, and that is a different job. */}
                      {silent > 0 && system.state !== 'OFFLINE' && (
                        <span className="block truncate text-xs text-severity-warning">
                          {system.inverters.length - silent} of {system.inverters.length} reporting
                        </span>
                      )}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                      {system.state === 'GENERATING' ? amount(system.outputKw, 'kW', 1) : '—'}
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-secondary tabular-nums">
                      {system.kwp.toLocaleString('en-MY')} kWp
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-secondary tabular-nums">
                      {system.inverters.length} × {system.inverters[0]?.ratedKw} kW
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2">
                      <span className={cn('flex items-center gap-1.5', meta.textClassName)}>
                        <meta.icon className="size-4 shrink-0" aria-hidden="true" />
                        {meta.label}
                      </span>
                      {row.headline !== undefined && (
                        <span className="block truncate text-xs text-tertiary">
                          {row.headline}
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
