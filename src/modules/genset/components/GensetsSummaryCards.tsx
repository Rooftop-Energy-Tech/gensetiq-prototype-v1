import {useId, useState} from 'react';

import {
  CardNote,
  CountChip,
  FilterCard,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {STATUS_META} from '../data/fleetStatus';
import type {FleetSummary} from '../data/fleetSummary';
import {gensetStateName} from '../data/gensetState';
import {isDueForService} from '../data/services';
import type {Genset} from '../types/genset.type';
import type {GensetSearch} from '../types/view.type';

/**
 * The fleet's summary: four cards, in the shape the telcoIQ estate strip draws —
 * `Gensets`, `Status`, `Due for service`, `Fuel on hand`.
 *
 * ## History
 *
 * It was five cards, then **one line** from 2026-09-21 (Tristan's call: a summary
 * standing 146px above a register competes with it), and cards again from 2026-09-28
 * at Jeff's request, matching the telcoIQ Sites strip. The line's rules carry over:
 *
 * - **The cards count the whole fleet**, and only `Showing N` follows the filters. The
 *   strip is a picture of the estate that holds still while the list below answers a
 *   narrower question; the toolbar's dropdowns are what follow the filters.
 * - **The status buckets are always drawn, zero or not** — a fixed scale a reader
 *   learns once. Each is still a toggle (`?status=`), as the chips were.
 *
 * `Due for service` is a toggle too (`?service=due`), not a link as on the estate
 * strip: that card sends a reader here, and this is here. `Fuel on hand` stands where
 * the estate's `Solar share` does — this estate has no solar, and diesel on hand is
 * the figure a fleet's day turns on.
 */

type GensetsSummaryCardsProps = {
  summary: FleetSummary;
  /** The whole fleet, for the service and fuel cards. */
  fleet: Array<Genset>;
  /** How many rows the list is actually showing, once search and filters are applied. */
  showing: number;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

export const GensetsSummaryCards = ({
  summary,
  fleet,
  showing,
  search,
  onSearchChange,
}: GensetsSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  // Folded at phone width on request, as the estate strip is; the row is always
  // open on a desktop. See `SummaryCollapseButton`.
  const [collapsed, setCollapsed] = useState(false);
  const cardsId = useId();

  const due = fleet.filter((genset) => isDueForService(genset.id));
  const dueStates = new Set(due.map(gensetStateName).filter((name) => name !== undefined)).size;

  const litres = fleet.reduce((sum, genset) => sum + genset.fuelLitres, 0);
  const capacity = fleet.reduce((sum, genset) => sum + genset.fuelCapacityLitres, 0);
  const share = capacity === 0 ? 0 : litres / capacity;

  const activeCount = (search.status === undefined ? 0 : 1) + (search.service === undefined ? 0 : 1);

  return (
    <div className="flex flex-col gap-3">
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={4}>
        <SummaryCard label="Gensets">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'genset' : 'gensets'}
            detail={filtered ? `Showing ${showing}` : `across ${summary.byState.length} states`}
          />
          {filtered && <CardNote>across {summary.byState.length} states</CardNote>}
        </SummaryCard>

        <SummaryCard label="Status">
          <div className="flex flex-col gap-0.5">
            {summary.byStatus.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                tone={STATUS_META[tally.key].tone}
                active={search.status === tally.key}
                onToggle={(next) => onSearchChange({status: next ? tally.key : undefined})}
                title={STATUS_META[tally.key].detail}
                block
              />
            ))}
          </div>
        </SummaryCard>

        <FilterCard
          label="Due for service"
          count={due.length}
          unit={due.length === 1 ? 'genset' : 'gensets'}
          detail={
            due.length === 0
              ? 'nothing booked in'
              : `in ${dueStates} ${dueStates === 1 ? 'state' : 'states'}`
          }
          active={search.service === 'due'}
          onToggle={(next) => onSearchChange({service: next ? 'due' : undefined})}
        />

        <SummaryCard label="Fuel on hand">
          {/* No unit beside the figure — `62%` carries its own; the litres behind it
              are the detail line, as the estate's solar card does with its kWh. */}
          <Headline
            value={`${Math.round(share * 100)}%`}
            detail={`${Math.round(litres).toLocaleString('en-MY')} L of ${Math.round(capacity).toLocaleString('en-MY')} L`}
          />
        </SummaryCard>
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        activeCount={activeCount}
        controls={cardsId}
        noun="summary"
      />
    </div>
  );
};
