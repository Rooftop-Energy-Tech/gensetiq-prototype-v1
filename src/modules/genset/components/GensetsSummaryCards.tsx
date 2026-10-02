import {useId, useState} from 'react';

import {
  CardNote,
  CountChip,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import type {ChipTone} from '@/components/global/SummaryCards';
import {ALARM_OPTION} from './GensetsToolbar';
import type {FleetSummary} from '../data/fleetSummary';
import {RUN_STATES} from '../types/genset.type';
import {GENSET_ALARM_FILTERS} from '../types/view.type';
import type {RunState} from '../types/genset.type';
import {RUN_STATE_META} from './runStateMeta';
import type {GensetSearch} from '../types/view.type';

/**
 * The fleet's summary: two cards, in the shape the telcoIQ estate strip draws —
 * `Status` and `Alarm`. `Status` splits the fleet
 * into running, idle and offline (2026-09-29), each a `?run=` toggle. The first two
 * were `Gensets` and `Status` until 2026-09-29, renamed to the table columns they
 * count: the run state is the `Status` column, and the buckets are the `Alarm` one.
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
 * - **Every chip is always drawn, zero or not** — a fixed scale a reader learns
 *   once. Each is a toggle (`?run=`, `?alarm=`), as the chips were.
 *
 * `Due for service` was a third card, a toggle for `?service=due`, until 2026-09-29;
 * the filter still works from a link and clears from its chip. A fourth card stood where
 * the estate's `Solar share` does — `Fuel on hand`, then `Today` (run hours and
 * litres since midnight, and why the running sets started) — and came off on
 * 2026-09-29 at Jeff's request.
 */

const RUN_TONE: Record<RunState, ChipTone> = {
  RUNNING: 'running',
  IDLE: 'idle',
  OFFLINE: 'offline',
};

type GensetsSummaryCardsProps = {
  summary: FleetSummary;
  /** How many rows the list is actually showing, once search and filters are applied. */
  showing: number;
  search: GensetSearch;
  onSearchChange: (next: Partial<GensetSearch>) => void;
};

export const GensetsSummaryCards = ({
  summary,
  showing,
  search,
  onSearchChange,
}: GensetsSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  // Folded at phone width on request, as the estate strip is; the row is always
  // open on a desktop. See `SummaryCollapseButton`.
  const [collapsed, setCollapsed] = useState(false);
  const cardsId = useId();

  const activeCount =
    (search.run === undefined ? 0 : 1) +
    (search.alarm === undefined ? 0 : 1);

  return (
    <div className="flex flex-col gap-3">
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={2}>
        {/* What the engines are doing, one toggle per run state (`?run=`) — the
            Alarm card's shape, so the two read as a pair.
            The fleet total is not stated; the three add up to it. */}
        <SummaryCard label="Status">
          <div className="flex flex-col gap-0.5">
            {RUN_STATES.map((state) => (
              <CountChip
                key={state}
                label={RUN_STATE_META[state].label}
                count={summary.byRunState[state]}
                tone={RUN_TONE[state]}
                active={search.run === state}
                onToggle={(next) => onSearchChange({run: next ? state : undefined})}
                block
              />
            ))}
          </div>
          {/* Only while filtered: the unfiltered `38 across 8 states` came off on
              2026-09-29 — the three counts already add up to the fleet. */}
          {filtered && <CardNote>{`Showing ${showing} of ${summary.total}`}</CardNote>}
        </SummaryCard>

        <SummaryCard label="Alarm">
          <div className="flex flex-col gap-0.5">
            {/* The Alarm dropdown's own options, counts and `?alarm=` — a set's worst
                standing alarm, so the four add up to the fleet. It drew the fleet
                status buckets (`Alarms raised`, `Low fuel`, `All OK`) until
                2026-09-29, which no control above it could show once picked. */}
            {GENSET_ALARM_FILTERS.map((key) => (
              <CountChip
                key={key}
                label={ALARM_OPTION[key].label}
                count={summary.byAlarm[key]}
                tone={ALARM_OPTION[key].tone ?? 'neutral'}
                active={search.alarm === key}
                onToggle={(next) => onSearchChange({alarm: next ? key : undefined})}
                block
              />
            ))}
          </div>
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
