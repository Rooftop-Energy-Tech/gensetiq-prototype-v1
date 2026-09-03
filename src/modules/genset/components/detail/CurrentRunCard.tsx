import {Link} from '@tanstack/react-router';
import {ArrowDownIcon, ArrowRightIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, durationCompact, stampAt} from '@/lib/format';
import {isOpen, runElapsedMs} from '../../types/run.type';
import type {GensetRun} from '../../types/run.type';
import {DEFAULT_RUN_WINDOW} from '../../types/runsView.type';

/** What `runTotalsIn` returns for the window since midnight. */
export type DayTotals = {
  starts: number;
  runtimeMs: number;
  energyKwh: number;
  fuelLitres: number;
};

/**
 * The run card — the numbers an operator asks for first, on one run and on the
 * day that run belongs to.
 *
 * Fuel consumed, energy produced and time running are *totals*, not instantaneous
 * readings, and that is why they belong here rather than in the gauge row: they
 * are what work gets judged on afterwards (litres per kWh delivered, hours against
 * the service interval), and they keep accumulating whether or not anybody is
 * watching the dials.
 *
 * ## Why the day is a column and not a card
 *
 * It was a card beside this one for about an hour. The trouble is that on a set
 * with one run today — much the commonest case — every figure in it was the figure
 * already printed to its left, so two cards sat side by side saying `5 hours`,
 * `15 kWh`, `7 L` twice. That reads as a rendering fault rather than as an
 * arithmetic identity.
 *
 * As a column the identity is the point: when this run *is* today's work the two
 * columns agree and a reader can see that they agree, and when they diverge —
 * three starts since midnight, or a run that began before it — the difference is
 * the thing worth reading, on the same row, at the same scale.
 *
 * The shape does not change either way. A card that collapsed to one column
 * whenever the numbers happened to match would teach a reader that they cannot
 * trust what they learned last time they opened it.
 *
 * ## What each column means
 *
 * The run column is one start to one stop, so its `Starts` cell is `1` by
 * definition — printed rather than dashed, because it is the denominator that makes
 * the row's other cell mean something ("three starts today, this is one of them").
 *
 * The day column is midnight to now and is **apportioned**, so a run that began
 * last night contributes only the part that fell after midnight and contributes no
 * start at all. That is why `Starts` can read `1 · 0`: this run is a start, and
 * yesterday is the day that owns it.
 *
 * Both stamps are shown because a run is an interval. For an open run the second
 * stamp is the latest telemetry rather than a stop time — the run has no end yet,
 * and blanking the field would leave the arrow pointing at nothing.
 */
export const CurrentRunCard = ({
  run,
  today,
  gensetId,
  now,
}: {
  run: GensetRun;
  /** Everything this machine has done since midnight, apportioned to it. */
  today: DayTotals;
  gensetId: string;
  now: number;
}) => {
  const open = isOpen(run);
  const endStamp = run.endedAt ?? new Date(now).toISOString();

  const rows: Array<{label: string; run: string; day: string}> = [
    {
      label: open ? 'Time running' : 'Time ran',
      run: durationCompact(runElapsedMs(run, now)),
      // `none` rather than `duration(0)`, which reads "under a minute" — a set
      // that has not turned today has not *nearly* turned today.
      day: today.runtimeMs === 0 ? 'none' : durationCompact(today.runtimeMs),
    },
    {
      label: 'Energy produced',
      run: amount(run.energyProducedKwh, 'kWh'),
      day: amount(today.energyKwh, 'kWh'),
    },
    {
      label: 'Fuel consumed',
      run: amount(run.fuelConsumedLitres, 'L'),
      day: amount(today.fuelLitres, 'L'),
    },
    {label: 'Starts', run: '1', day: amount(today.starts, '')},
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 rounded-md border border-default bg-element px-3 pt-3 pb-4">
      <div className="flex items-center justify-between">
        <Badge variant="element">{open ? 'Current run' : 'Last run'}</Badge>

        {/* The design's arrow. It goes to the run log rather than nowhere: a
            reader looking at one run's totals is one click from asking how it
            compares with the last twenty. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7" asChild>
              <Link
                to="/gensets/$gensetId/runs"
                params={{gensetId}}
                // The tab's own default. A link has to name the whole search
                // object — the schema's defaults settle a URL that is parsed, not
                // one that is built — so this is where the arrow says which
                // window the log opens on.
                search={{window: DEFAULT_RUN_WINDOW}}
                aria-label="All runs"
              >
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">All runs</TooltipContent>
        </Tooltip>
      </div>

      {/* `gap-10` is the design's, and a phone gives that space to the figures.
          **The interval stacks below `md`, and with two value columns it has to.**
          One column left ~180px for a label at 390px, which truncates but reads;
          two leave 18px, which collapses the label away entirely and prints a grid
          of unlabelled figures. Stacked, the table gets the card's full width and
          the labels come back. */}
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:gap-10">
        {/* The interval, drawn as one. The arrow is the design's, and it is
            doing real work — without it the two stamps read as a pair of
            unrelated timestamps rather than a start and an end. */}
        {/* A row at phone width, the design's column from `md` up — and the arrow
            turns with it. An arrow pointing down a line that reads left to right is
            the one part of this block that cannot simply reflow: it is what says the
            two stamps are a start and an end rather than two unrelated times. */}
        <div className="flex w-full shrink-0 flex-row items-center justify-center gap-3 text-sm font-medium text-primary md:w-[117px] md:flex-col">
          <span className="whitespace-nowrap">{stampAt(run.startedAt)}</span>
          <ArrowDownIcon
            className="size-4 -rotate-90 text-secondary md:rotate-0"
            aria-hidden="true"
          />
          <span className="whitespace-nowrap">{stampAt(endStamp)}</span>
        </div>

        {/* Three columns: the label takes the slack, the two figures are fixed and
            right-aligned so they line up down their own edges — `MetricRow`'s
            arrangement, extended by one column rather than replaced. The figures
            are `shrink-0` for `MetricRow`'s reason too: a truncated number is
            useless in a way a truncated label is not, and "Energy produce…" still
            reads. */}
        <div
          role="table"
          aria-label={open ? 'Current run and today' : 'Last run and today'}
          className="flex min-w-0 flex-1 flex-col gap-4 text-sm font-medium"
        >
          <div role="row" className="flex w-full items-center gap-4 text-xs text-secondary">
            <span role="columnheader" className="min-w-0 flex-1" />
            <span role="columnheader" className="w-[76px] shrink-0 text-right">
              {open ? 'This run' : 'Last run'}
            </span>
            <span role="columnheader" className="w-[76px] shrink-0 text-right">
              Today
            </span>
          </div>

          {rows.map((row) => (
            <div key={row.label} role="row" className="flex w-full items-center gap-4">
              <span role="rowheader" className="min-w-0 flex-1 truncate text-secondary">
                {row.label}
              </span>
              <span
                role="cell"
                className="w-[76px] shrink-0 text-right whitespace-nowrap text-primary tabular-nums"
              >
                {row.run}
              </span>
              <span
                role="cell"
                className="w-[76px] shrink-0 text-right whitespace-nowrap text-primary tabular-nums"
              >
                {row.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
