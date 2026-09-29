import {Link, useNavigate} from '@tanstack/react-router';
import {FileTextIcon, MapPinIcon, SearchIcon, SearchXIcon} from 'lucide-react';
import type {ReactNode} from 'react';
import {useMemo} from 'react';

import {FilterSelect} from '@/components/global/FilterSelect';
import type {FilterOption} from '@/components/global/FilterSelect';
import {FilterCard, SummaryCardRow} from '@/components/global/SummaryCards';
import type {ChipTone} from '@/components/global/SummaryCards';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {stampDate} from '@/lib/format';
import {useIsCompact} from '@/lib/useIsCompact';
import {cn} from '@/lib/utils';
import {useFleet} from '@/modules/genset/data/deployment';
import {gensetStateName, stateNameFromSlug, stateSlug} from '@/modules/genset/data/gensetState';
import {engineHoursOf, useServiceRecords} from '@/modules/genset/data/services';
import {LogServiceDialog} from '@/modules/genset/components/service/LogServiceDialog';
import {SERVICE_SEVERITY_META} from '@/modules/genset/components/service/serviceMeta';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import type {ServiceCounter, ServiceRecord} from '@/modules/genset/types/service.type';
import {searchGensets} from '@/modules/genset/utils/searchGensets';
import {siteLabel} from '@/modules/site/data/siteSeed';
import {nextDue, recordStateName, useFleetService} from './data/fleetService';
import type {FleetServiceRow} from './data/fleetService';
import {SERVICE_STANDINGS} from './types/view.type';
import type {ServiceSearch, ServiceStanding} from './types/view.type';

/**
 * Service, fleet-wide: which sets are due, and every service on record.
 *
 * The genset's own Service tab answers both questions for one machine; this is the
 * same two answers for all of them, so a workshop lead can plan the week without
 * opening thirty-eight tabs. Every figure is the tab's own — `useFleetService` runs
 * the same `serviceStatus` over the same records, schedule and meter — and `Log
 * service` on a row opens the tab's own dialog.
 *
 * - **Due** is one row per set, worst first: overdue, due soon, never serviced, then
 *   in service, and within each the set furthest through its interval first.
 * - **History** is every logged service, newest first.
 *
 * The cards count the whole fleet and are toggles (`?standing=`), like the gensets
 * register's; the search box and `State` narrow both tabs.
 */

const STANDING_META: Record<ServiceStanding, {label: string; unit: string; detail: string; tone: ChipTone}> = {
  overdue: {label: 'Overdue', unit: 'gensets', detail: 'past a run-hour or calendar limit', tone: 'critical'},
  'due-soon': {label: 'Due soon', unit: 'gensets', detail: 'over 90% of an interval', tone: 'warning'},
  ok: {label: 'In service', unit: 'gensets', detail: 'inside both intervals', tone: 'ok'},
  never: {label: 'Never serviced', unit: 'gensets', detail: 'no service on record yet', tone: 'neutral'},
};

/**
 * The cards: three, not four. `Never serviced` had one and it is gone on request —
 * a never-serviced set still lists, worst-but-two, with its own status.
 */
const CARD_STANDINGS: Array<ServiceStanding> = ['overdue', 'due-soon', 'ok'];

const STANDING_DOT: Record<ServiceStanding, string> = {
  overdue: 'bg-severity-critical',
  'due-soon': 'bg-severity-warning',
  ok: 'bg-severity-ok',
  never: 'bg-tertiary',
};

const CELL = 'px-3 py-2 whitespace-nowrap';

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={cn(
      'sticky top-0 z-[1] h-10 border-b border-subtle bg-canvas px-3 font-medium text-secondary',
      align === 'right' ? 'text-right' : 'text-left',
    )}
  >
    {children}
  </th>
);

/** `463 / 500 h` with a bar under it, in the severity's colour once it matters. */
const CounterCell = ({counter}: {counter: ServiceCounter | undefined}) => {
  if (counter === undefined) return <span className="text-tertiary">—</span>;
  const fraction = counter.interval > 0 ? counter.elapsed / counter.interval : 0;
  const severity = SERVICE_SEVERITY_META[counter.severity];
  const elapsed =
    counter.kind === 'hours' ? Math.round(counter.elapsed).toLocaleString('en-MY') : counter.elapsed.toFixed(1);
  const unit = counter.kind === 'hours' ? 'h' : 'mo';
  return (
    <div className="flex w-28 flex-col gap-1">
      <span className="text-primary tabular-nums">
        {elapsed} <span className="text-secondary">/ {counter.interval.toLocaleString('en-MY')} {unit}</span>
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-tertiary/30" aria-hidden="true">
        <span
          className={cn('block h-full rounded-full bg-current', counter.severity === 'OK' ? 'text-tertiary' : severity.textClassName)}
          style={{width: `${Math.min(100, fraction * 100)}%`}}
        />
      </span>
    </div>
  );
};

const StandingBadge = ({row}: {row: FleetServiceRow}) => {
  if (row.status.kind === 'never-serviced') {
    return <span className="text-secondary">Never serviced</span>;
  }
  const meta = SERVICE_SEVERITY_META[row.status.severity];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', meta.textClassName)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const ReportLink = ({record}: {record: ServiceRecord}) =>
  record.document.url === null ? (
    <span className="text-tertiary" title="Attached in an earlier session; the file itself is not stored.">
      {record.document.fileName}
    </span>
  ) : (
    <a
      href={record.document.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="text-primary underline-offset-4 hover:underline"
    >
      Report
    </a>
  );

const DueTable = ({rows}: {rows: Array<FleetServiceRow>}) => {
  const navigate = useNavigate();
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <Th>Number plate</Th>
          <Th>State</Th>
          <Th>Location</Th>
          <Th>Status</Th>
          <Th>Next due</Th>
          <Th>Run hours</Th>
          <Th>Time</Th>
          <Th>Last service</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const {genset, status} = row;
          const due = nextDue(row);
          return (
            <tr
              key={genset.id}
              onClick={() => void navigate({to: '/gensets/$gensetId/service', params: {gensetId: genset.id}})}
              className="cursor-pointer hover:bg-hover"
            >
              <td className={cn(CELL, 'border-b border-subtle font-medium')}>
                <Link
                  to="/gensets/$gensetId/service"
                  params={{gensetId: genset.id}}
                  onClick={(event) => event.stopPropagation()}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {gensetLabel(genset)}
                </Link>
              </td>
              <td className={cn(CELL, 'border-b border-subtle text-primary')}>{gensetStateName(genset) ?? '—'}</td>
              <td className={cn(CELL, 'max-w-56 truncate border-b border-subtle text-primary')} title={genset.address}>
                {genset.locationLabel}
              </td>
              <td className={cn(CELL, 'border-b border-subtle')}>
                <StandingBadge row={row} />
              </td>
              <td className={cn(CELL, 'border-b border-subtle tabular-nums')}>
                {due === undefined ? (
                  <span className="text-secondary">first service</span>
                ) : (
                  <span className={due.overdue ? 'text-severity-critical' : 'text-primary'}>{due.text}</span>
                )}
              </td>
              <td className={cn(CELL, 'border-b border-subtle')}>
                <CounterCell counter={status.kind === 'tracked' ? status.hours : undefined} />
              </td>
              <td className={cn(CELL, 'border-b border-subtle')}>
                <CounterCell counter={status.kind === 'tracked' ? status.calendar : undefined} />
              </td>
              <td className={cn(CELL, 'border-b border-subtle')}>
                {status.kind === 'tracked' ? (
                  <span className="flex flex-col">
                    <span className="text-primary">{stampDate(status.lastService.performedAt)}</span>
                    <span className="text-xs text-secondary">
                      {status.lastService.technicianName} · <ReportLink record={status.lastService} />
                    </span>
                  </span>
                ) : (
                  <span className="text-tertiary">—</span>
                )}
              </td>
              {/* Stops here: the dialog is portalled, but its clicks still bubble
                  through React's tree to the row, which would navigate away. */}
              <td className={cn(CELL, 'border-b border-subtle text-right')} onClick={(event) => event.stopPropagation()}>
                <LogServiceDialog genset={genset} currentEngineHours={engineHoursOf(genset.id)} compact />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

/** A thin interval bar, in the counter's severity once it matters. */
const IntervalBar = ({counter}: {counter: ServiceCounter}) => {
  const fraction = counter.interval > 0 ? counter.elapsed / counter.interval : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-tertiary/30" aria-hidden="true">
      <span
        className={cn(
          'block h-full rounded-full bg-current',
          counter.severity === 'OK' ? 'text-tertiary' : SERVICE_SEVERITY_META[counter.severity].textClassName,
        )}
        style={{width: `${Math.min(100, fraction * 100)}%`}}
      />
    </span>
  );
};

const counterText = (counter: ServiceCounter): string =>
  counter.kind === 'hours'
    ? `${Math.round(counter.elapsed).toLocaleString('en-MY')} / ${counter.interval.toLocaleString('en-MY')} h`
    : `${counter.elapsed.toFixed(1)} / ${counter.interval} mo`;

/**
 * The Due list at phone width: a card per set, in the table's order.
 *
 * The table is nine columns and 1,200px; at 358px it showed plate, state and
 * location and put everything a reader came for a swipe away. The card leads with
 * plate and status, then where, when it is due, the two intervals side by side, the
 * last visit, and `Log service` full width at the foot — the phone form the gensets
 * and deployments registers already use. `pb-20` clears the floating nav, as theirs.
 */
const DueCards = ({rows}: {rows: Array<FleetServiceRow>}) => (
  <ul aria-label="Gensets by service standing" className="flex flex-col gap-2 pb-20">
    {rows.map((row) => {
      const {genset, status} = row;
      const due = nextDue(row);
      const tone =
        status.kind === 'never-serviced'
          ? 'border-subtle'
          : status.severity === 'OVERDUE'
            ? 'border-severity-critical/45'
            : status.severity === 'DUE_SOON'
              ? 'border-severity-warning/45'
              : 'border-subtle';
      return (
        <li key={genset.id} className={cn('flex flex-col gap-2.5 rounded-lg border bg-element p-3 text-sm', tone)}>
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/gensets/$gensetId/service"
              params={{gensetId: genset.id}}
              className="text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
            >
              {gensetLabel(genset)}
            </Link>
            <StandingBadge row={row} />
          </div>
          <p className="flex min-w-0 items-center gap-1.5 text-secondary">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {/* The state only when the placename does not already carry it —
                `Workshop, Kapar · Selangor`, but not `Klang, Selangor · Selangor`. */}
            <span className="truncate">
              {genset.locationLabel}
              {(() => {
                const state = gensetStateName(genset);
                return state !== undefined && !genset.locationLabel.includes(state) ? ` · ${state}` : '';
              })()}
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-secondary">Next due</span>
            {due === undefined ? (
              <span className="text-secondary">first service</span>
            ) : (
              <span className={cn('font-medium tabular-nums', due.overdue ? 'text-severity-critical' : 'text-primary')}>
                {due.text}
              </span>
            )}
          </p>
          {status.kind === 'tracked' && (
            <div className="grid grid-cols-2 gap-3">
              {[status.hours, status.calendar].map((counter) => (
                <div key={counter.kind} className="flex flex-col gap-1.5">
                  <span className="text-xs text-secondary">
                    {counter.kind === 'hours' ? 'Run hours' : 'Time'}{' '}
                    <span className="text-primary tabular-nums">{counterText(counter)}</span>
                  </span>
                  <IntervalBar counter={counter} />
                </div>
              ))}
            </div>
          )}
          {status.kind === 'tracked' && (
            <p className="flex items-center justify-between gap-2 text-xs text-secondary">
              <span className="truncate">
                Last: {stampDate(status.lastService.performedAt)} · {status.lastService.technicianName}
              </span>
              <ReportLink record={status.lastService} />
            </p>
          )}
          {/* Full width and 44px: the one thing a technician standing at the set
              came to do. The dialog is the Service tab's own. */}
          <div className="[&_button]:h-11 [&_button]:w-full [&_button]:text-sm">
            <LogServiceDialog genset={genset} currentEngineHours={engineHoursOf(genset.id)} compact />
          </div>
        </li>
      );
    })}
  </ul>
);

/**
 * The History list at phone width: two lines a row instead of seven columns. The
 * plate and date lead; technician, site and hours follow; the report is a 44px
 * target on the right. State is left to the filter, where it already is.
 */
const HistoryRows = ({records, byId}: {records: Array<ServiceRecord>; byId: Map<string, Genset>}) => (
  <ul aria-label="Service history" className="mb-20 flex flex-col overflow-hidden rounded-lg border border-subtle bg-element">
    {records.map((record) => {
      const genset = byId.get(record.gensetId);
      return (
        <li key={record.id} className="flex min-h-15 items-center gap-3 border-subtle px-3 py-2 not-first:border-t">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm text-primary">
              {genset === undefined ? (
                <span className="font-semibold">{record.gensetId}</span>
              ) : (
                <Link
                  to="/gensets/$gensetId/service"
                  params={{gensetId: genset.id}}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {gensetLabel(genset)}
                </Link>
              )}{' '}
              <span className="text-secondary">· {stampDate(record.performedAt)}</span>
            </span>
            <span className="truncate text-xs text-secondary">
              {record.technicianName} · {siteLabel(record.siteId)} · {record.engineHoursAtService.toLocaleString('en-MY')} h
            </span>
          </div>
          {record.document.url === null ? (
            <span className="shrink-0 text-xs text-tertiary" title="Attached in an earlier session; the file itself is not stored.">
              No file
            </span>
          ) : (
            <a
              href={record.document.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Report for ${genset === undefined ? record.gensetId : gensetLabel(genset)}, ${stampDate(record.performedAt)}`}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-end gap-1.5 text-sm font-medium text-primary"
            >
              <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
              Report
            </a>
          )}
        </li>
      );
    })}
  </ul>
);

const HistoryTable = ({records, byId}: {records: Array<ServiceRecord>; byId: Map<string, Genset>}) => (
  <table className="w-full border-separate border-spacing-0 text-sm">
    <thead>
      <tr>
        <Th>Date</Th>
        <Th>Number plate</Th>
        <Th>State</Th>
        <Th>Site</Th>
        <Th>Technician</Th>
        <Th align="right">Engine hours</Th>
        <Th>Report</Th>
      </tr>
    </thead>
    <tbody>
      {records.map((record) => {
        const genset = byId.get(record.gensetId);
        return (
          <tr key={record.id}>
            <td className={cn(CELL, 'border-b border-subtle text-primary')}>{stampDate(record.performedAt)}</td>
            <td className={cn(CELL, 'border-b border-subtle font-medium')}>
              {genset === undefined ? (
                record.gensetId
              ) : (
                <Link
                  to="/gensets/$gensetId/service"
                  params={{gensetId: genset.id}}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {gensetLabel(genset)}
                </Link>
              )}
            </td>
            <td className={cn(CELL, 'border-b border-subtle text-primary')}>{recordStateName(record, genset) ?? '—'}</td>
            <td className={cn(CELL, 'border-b border-subtle text-primary')}>{siteLabel(record.siteId)}</td>
            <td className={cn(CELL, 'border-b border-subtle text-primary')}>{record.technicianName}</td>
            <td className={cn(CELL, 'border-b border-subtle text-right text-primary tabular-nums')}>
              {record.engineHoursAtService.toLocaleString('en-MY')} h
            </td>
            <td className={cn(CELL, 'border-b border-subtle')}>
              <ReportLink record={record} />
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const ServicePage = ({
  search,
  onSearchChange,
}: {
  search: ServiceSearch;
  onSearchChange: (next: Partial<ServiceSearch>) => void;
}) => {
  const {tab, q = '', location, standing} = search;
  const compact = useIsCompact();
  const fleet = useFleet();
  const rows = useFleetService(fleet);
  const records = useServiceRecords();
  const byId = useMemo(() => new Map(fleet.map((genset) => [genset.id, genset])), [fleet]);

  // Whole fleet, as the gensets register's cards are.
  const counts = useMemo(() => {
    const tally = Object.fromEntries(SERVICE_STANDINGS.map((key) => [key, 0])) as Record<ServiceStanding, number>;
    for (const row of rows) tally[row.standing] += 1;
    return tally;
  }, [rows]);

  const matching = useMemo(() => new Set(searchGensets(fleet, q).map((genset) => genset.id)), [fleet, q]);
  const inState = (name: string | undefined) =>
    location === undefined || (name !== undefined && stateSlug(name) === location);

  const dueRows = rows.filter(
    (row) =>
      matching.has(row.genset.id) &&
      inState(gensetStateName(row.genset)) &&
      (standing === undefined || row.standing === standing),
  );
  const historyRows = records.filter((record) => {
    const genset = byId.get(record.gensetId);
    return (q === '' || matching.has(record.gensetId)) && inState(recordStateName(record, genset));
  });

  // The State options: states the fleet stands in, counted over the current tab
  // under the other filters — the register's rule.
  const stateOptions = useMemo((): Array<FilterOption<string>> => {
    const names = new Set(fleet.map(gensetStateName).filter((name): name is string => name !== undefined));
    const tally = new Map<string, number>();
    if (tab === 'due') {
      for (const row of rows) {
        if (!matching.has(row.genset.id) || (standing !== undefined && row.standing !== standing)) continue;
        const name = gensetStateName(row.genset);
        if (name !== undefined) tally.set(name, (tally.get(name) ?? 0) + 1);
      }
    } else {
      for (const record of records) {
        if (q !== '' && !matching.has(record.gensetId)) continue;
        const name = recordStateName(record, byId.get(record.gensetId));
        if (name === undefined) continue;
        names.add(name);
        tally.set(name, (tally.get(name) ?? 0) + 1);
      }
    }
    const options = [...names]
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({key: stateSlug(name), label: name, count: tally.get(name) ?? 0}));
    if (location !== undefined && !options.some((option) => option.key === location)) {
      const label = stateNameFromSlug(location);
      if (label !== undefined) options.push({key: location, label, count: 0});
    }
    return options;
  }, [fleet, rows, records, matching, standing, tab, q, location, byId]);

  const shown = tab === 'due' ? dueRows.length : historyRows.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      {/* One row at phone width too: tighter gaps and a search box that gives way,
          so the Due/History switch does not drop to a line of its own. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 md:gap-x-4">
        <InputGroup className="w-full min-w-0 flex-1 md:max-w-[187px] md:min-w-[140px]">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(event) => onSearchChange({q: event.target.value || undefined})}
            // `Plate` at phone width, where `Number plate` is cut to `Numb`.
            placeholder={compact ? 'Plate' : 'Number plate'}
            aria-label="Search gensets"
          />
        </InputGroup>
        <FilterSelect
          label="State"
          allLabel="All states"
          options={stateOptions}
          value={location}
          onChange={(next) => onSearchChange({location: next})}
        />
        <Tabs value={tab} onValueChange={(next) => onSearchChange({tab: next as ServiceSearch['tab']})} className="ml-auto">
          <TabsList>
            <TabsTrigger value="due" tabIndex={tab === 'due' ? 0 : -1} className="px-3">
              Due
            </TabsTrigger>
            <TabsTrigger value="history" tabIndex={tab === 'history' ? 0 : -1} className="px-3">
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'due' && compact && (
        // Three across at phone width, label and count only: the explanation lines
        // are what made them cards on a desktop, and here they would push the list
        // below the fold.
        <div className="grid grid-cols-3 gap-2">
          {CARD_STANDINGS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={standing === key}
              onClick={() => onSearchChange({standing: standing === key ? undefined : key})}
              className={cn(
                'flex min-h-16 cursor-pointer flex-col items-start justify-between gap-1.5 rounded-md border px-2.5 py-2 text-left',
                'outline-none focus-visible:ring-2 focus-visible:ring-outline',
                standing === key ? 'border-strong bg-highlight' : 'border-subtle bg-element',
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-secondary uppercase">
                <span className={cn('size-1.5 shrink-0 rounded-full', STANDING_DOT[key])} aria-hidden="true" />
                {STANDING_META[key].label}
              </span>
              <span className="text-xl leading-none font-semibold text-primary tabular-nums">{counts[key]}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'due' && !compact && (
        <SummaryCardRow cappedColumns={3}>
          {CARD_STANDINGS.map((key) => (
            <FilterCard
              key={key}
              label={STANDING_META[key].label}
              count={counts[key]}
              unit={counts[key] === 1 ? 'genset' : STANDING_META[key].unit}
              detail={STANDING_META[key].detail}
              tone={STANDING_META[key].tone}
              active={standing === key}
              onToggle={(next) => onSearchChange({standing: next ? key : undefined})}
            />
          ))}
        </SummaryCardRow>
      )}

      <p className="text-sm text-secondary">
        {tab === 'due'
          ? `${shown} of ${rows.length} gensets`
          : `${shown} ${shown === 1 ? 'service' : 'services'} on record`}
      </p>

      <div className="min-h-0 flex-1 overflow-auto">
        {shown === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">
              {tab === 'due' ? 'No gensets match the current filters.' : 'No services match the current filters.'}
            </p>
          </div>
        ) : tab === 'due' ? (
          compact ? <DueCards rows={dueRows} /> : <DueTable rows={dueRows} />
        ) : compact ? (
          <HistoryRows records={historyRows} byId={byId} />
        ) : (
          <HistoryTable records={historyRows} byId={byId} />
        )}
      </div>
    </div>
  );
};
