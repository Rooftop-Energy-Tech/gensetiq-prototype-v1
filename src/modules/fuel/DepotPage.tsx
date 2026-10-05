import {Link} from '@tanstack/react-router';
import {useState} from 'react';
import {ChevronLeftIcon, TriangleAlertIcon} from 'lucide-react';

import {relativeTime, stampAt} from '@/lib/format';
import {CardPill, SummaryCard, SummaryCardLabel} from '@/components/global/SummaryCards';
import {cn} from '@/lib/utils';
import {seededGenset} from '@/modules/genset/data/fleet';
import {RangePicker} from '@/modules/genset/components/detail/analysis/RangePicker';
import {TimeSeriesChart} from '@/modules/genset/components/detail/analysis/TimeSeriesChart';
import {historyStart} from '@/modules/genset/data/history';
import {analysisRange} from '@/modules/genset/types/analysisView.type';
import type {AnalysisWindow} from '@/modules/genset/types/analysisView.type';
import type {SeriesSlot} from '@/modules/genset/components/detail/analysis/seriesMeta';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import type {ReadingSeries, Sample} from '@/modules/genset/types/series.type';
import {DepotTankGlyph} from './DepotTankGlyph';
import {FuelBalanceCard} from './FuelBalanceCard';
import {FuelNav} from './FuelNav';
import {useFuelWindow} from './PeriodControl';
import {depotCapacityLitres, depotSeries, reconcile, varianceSeverity} from './data/depotTank';
import type {Depot, DepotSample} from './data/depotTank';
import {depotFills} from './data/fills';
import {amount, figure} from './format';

/**
 * `/fuel/depots/$depotId` — one yard, on a page of its own (Jeff, 2026-09-30).
 *
 * The card on the Depots tab says whether the yard is fine; this says why. It was a
 * drawer over the tab first, and became a page because a yard is a place a reader
 * works in — they come back to it, share its address, and read it at length —
 * rather than a row they glance at on the way past.
 *
 * Top to bottom (Jeff, 2026-10-01): the name and street address; the `Tank`, two
 * cards tall, beside `Fuel balance` stacked over `Missing in transit` (2026-10-05); `Fuel level`, the tank's level over the period, with its own range
 * picker; then `Tank refills` and `Gensets fuelled`, side by side (2026-10-05). A
 * `Fuel breakdown` card (`Fuel Out`, reached gensets, missing in transit) was
 * removed the same day (Jeff): the overview cards say it. A `Fuel trucks loaded here` card sat
 * beside them until the trucks were removed (Jeff, 2026-10-05).
 *
 * It keeps the Fuel rail, with this depot's row lit in the list under *Depot tanks*,
 * so the reader can see which tab they came down from and step to any other yard
 * or tab. It reports on the last month, as the Fuel page does, with no period
 * control (Jeff, 2026-09-30) — see `useFuelWindow`.
 */

/** Gensets listed before the rest are left to the History tab. */
const LIST_LIMIT = 10;

const Card = ({
  title,
  pill,
  className,
  children,
}: {
  title: string;
  /** The period, as the corner pill the overview cards wear — `last 30 days`. */
  pill?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section
    className={cn('flex min-w-0 flex-col gap-3 rounded-md border border-subtle bg-element px-5 py-4', className)}
  >
    <div className="flex items-start justify-between gap-2">
      <SummaryCardLabel>{title}</SummaryCardLabel>
      {pill !== undefined && <CardPill>{pill}</CardPill>}
    </div>
    {children}
  </section>
);

const Empty = ({children}: {children: React.ReactNode}) => <p className="text-sm text-secondary">{children}</p>;

/**
 * The sensor's readings over the window, and the one before it so the line starts
 * at the window's left edge rather than an hour in.
 */
const windowSamples = (series: ReadonlyArray<DepotSample>, from: number, to: number): ReadonlyArray<DepotSample> => {
  const first = series.findIndex((sample) => sample.t >= from);
  if (first === -1) return series.slice(-1);
  return series.slice(Math.max(0, first - 1)).filter((sample) => sample.t <= Math.min(to, Date.now()));
};

/** The fuel violet, on the left axis: the page draws one trace, the tank's level. */
const LEVEL_SLOT: SeriesSlot = {
  stroke: 'stroke-fuel',
  fill: 'fill-fuel',
  background: 'bg-fuel',
  text: 'text-fuel',
  axis: 'left',
};

const HOUR = 3_600_000;

/**
 * The tank's level over the window, drawn by the genset analysis tab's chart
 * (Jeff, 2026-10-01): its scale, gridlines, crosshair and readout, so a depot's
 * level reads like any other trace in the app. It was a bare area chart of its own.
 *
 * ## Its own window
 *
 * The one date filter on the page, and it moves only this chart (Jeff,
 * 2026-10-01): the analysis tab's picker, its presets and its custom range,
 * opening on 30 days. The cards and lists above and below stay on the page's
 * fixed last 30 days. Held in the component, not the URL — the depot page has no
 * search params of its own yet.
 *
 * ## Evenly spaced, and scaled to the tank
 *
 * The chart's crosshair assumes evenly spaced samples, and a depot's are not — a
 * supplier delivery is a sample of its own between two hourly readings. So the
 * level is read at a fixed step — every 15 minutes over two days or less, so a
 * 24-hour window is more than twenty-four points, and hourly past that.
 *
 * ## A saw-tooth, not every reading (Jeff, 2026-10-05)
 *
 * Drawn through the refills only: one straight slope down from each refill to the
 * next, and a slope up during the refill. The tank only falls while a genset is
 * being filled, so every reading drawn was a stair — flat for hours, then a drop —
 * and the reader wants the rate it runs down at, not each fill, which the
 * `Gensets fuelled` card lists. Between refills the line is that rate, not the
 * sensor: the crosshair there reads the trend. Until then it was the newest
 * reading at or before each step.
 *
 * The axis runs from empty to full rather than fitting the readings. Fitted, a
 * week that moved 3% fills the chart top to bottom and reads as a crisis; against
 * the tank, it is the small slope it is, and a refill is the steep climb it
 * really is.
 */
const LevelChart = ({series, capacity}: {series: ReadonlyArray<DepotSample>; capacity: number}) => {
  const [now] = useState(() => Date.now());
  const [window, setWindow] = useState<AnalysisWindow>('30d');
  const [custom, setCustom] = useState<{from: string; to: string} | undefined>(undefined);
  const earliest = series[0]?.t ?? historyStart();
  const range = analysisRange(
    {keys: '', window, run: undefined, dep: undefined, from: custom?.from, to: custom?.to},
    [],
    now,
    earliest,
  );
  const {from} = range;
  const end = range.to;
  const step = end - from <= 2 * 24 * HOUR ? HOUR / 4 : HOUR;

  // A saw-tooth (Jeff, 2026-10-05): the level only at the refills — the reading
  // before each rise and the reading after it — plus the first and newest, with a
  // straight line between. So the tank runs down on one slope from each refill to
  // the next and climbs on another during the refill. Every reading drawn was a
  // stair: flat for hours, then a genset fill's drop.
  const knots = series.filter((sample, index) => {
    if (index === 0 || index === series.length - 1) return true;
    const rises = sample.litres > series[index - 1].litres;
    const beforeRise = series[index + 1].litres > sample.litres;
    return rises || beforeRise;
  });
  // Each step on the line between the knots either side; past the newest, held.
  const readings: Array<Sample> = [];
  let index = 0;
  for (let t = from; t <= end; t += step) {
    while (index < knots.length && knots[index].t <= t) index += 1;
    const before = knots[index - 1];
    const after = knots[index];
    const value =
      before === undefined
        ? null
        : after === undefined
          ? before.litres
          : before.litres + ((after.litres - before.litres) * (t - before.t)) / (after.t - before.t);
    readings.push({t, value});
  }
  const level: ReadingSeries = {
    key: 'depot-level',
    label: 'Depot tank level',
    unit: 'L',
    precision: 0,
    samples: readings,
    domain: {min: 0, max: capacity},
    threshold: undefined,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <RangePicker
          window={window}
          range={range}
          runs={[]}
          customFrom={custom?.from}
          customTo={custom?.to}
          earliest={earliest}
          now={now}
          onWindowChange={(next) => {
            setCustom(undefined);
            setWindow(next);
          }}
          onRunChange={() => undefined}
          onCustomChange={(nextFrom, nextTo) => setCustom({from: nextFrom, to: nextTo})}
          showRuns={false}
        />
      </div>
      {/* No frame of its own: the `Fuel level` card around it is the frame. */}
      <div className="flex min-h-[320px] flex-col">
        <TimeSeriesChart
          series={[level]}
          runs={[]}
          from={from}
          to={end}
          slots={[LEVEL_SLOT]}
          formatValue={(value) => figure(Math.round(value))}
        />
      </div>
      {/* The key, centred under the frame, as the analysis tab's is. */}
      <div className="flex items-center justify-center gap-1.5 text-xs">
        <span className="h-0.5 w-3.5 shrink-0 rounded-full bg-fuel" aria-hidden="true" />
        <span className="text-secondary">{level.label}</span>
      </div>
    </div>
  );
};

const DepotBody = ({depot, from, to, periodLabel}: {depot: Depot; from: number; to: number; periodLabel: string}) => {
  const series = depotSeries(depot.id);
  const capacity = depotCapacityLitres(depot.id);
  const movement = reconcile(depot.id, from, to);
  const verdict = varianceSeverity(movement.varianceLitres);
  const level = series.at(-1)?.litres ?? 0;
  const fraction = capacity > 0 ? level / capacity : 0;
  const reported = [...series].reverse().find((sample) => sample.t <= Date.now())?.t;
  const samples = windowSamples(series, from, to);

  // A supplier delivery is a rise between two readings: nothing else puts diesel
  // into a bulk tank. Newest first.
  const supplies = samples
    .slice(1)
    .map((sample, index) => ({at: sample.t, litres: sample.litres - samples[index].litres}))
    .filter((rise) => rise.litres > 0)
    .reverse();

  const fills = depotFills(depot.id)
    .filter((fill) => fill.at >= from && fill.at <= to)
    .sort((a, b) => b.at - a.at);
  const filledLitres = fills.reduce((sum, fill) => sum + fill.litres, 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold text-primary">{`${depot.name} depot`}</h1>
          <p className="text-sm text-secondary">{depot.address}</p>
        </div>
        {/* No verdict badge here (Jeff, 2026-10-01): the `Missing in transit` card
            under it carries the warning, and the badge said it a second time. */}
      </header>

      {/* ## The yard's tank, beside the Depots tab's two cards for it (Jeff, 2026-10-01)
          The `Tank` on the left, two cards tall, with `Fuel balance` stacked over
          `Missing in transit` beside it (Jeff, 2026-10-05; the three were one row,
          tank first, until then). `Fuel in stock` and its days left, and `Fuel
          out`, were cut: the tank card has the level, and the balance card has
          what went out. Stacked below `sm`. The tank's column is 30% and the
          stack's 70% (Jeff, 2026-10-05). */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        {/* Two rows tall, so the drawing is drawn larger than it was in the row. */}
        <SummaryCard label="Tank" className="sm:row-span-2">
          {/* The litres under the drawing, not beside it (Jeff, 2026-10-05), so the
              narrow column holds both. */}
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="relative w-48 max-w-full shrink-0">
              <DepotTankGlyph fraction={fraction} className="block w-full" />
              <span
                aria-hidden="true"
                className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-semibold text-primary tabular-nums"
              >
                {`${Math.round(fraction * 100)}%`}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-1 text-center">
              {/* No `Headline` figure: the percentage in the drawing is the headline,
                  and these litres are its gloss. */}
              <p className="text-lg font-semibold text-primary tabular-nums">
                {`${amount(level, '')} / ${amount(capacity, '')}`}
                <span className="text-sm font-normal text-secondary"> L</span>
              </p>
              {reported !== undefined && (
                <p className="text-xs text-secondary" title={stampAt(new Date(reported).toISOString())}>
                  {`Last updated: ${relativeTime(new Date(reported).toISOString())}`}
                </p>
              )}
            </div>
          </div>
        </SummaryCard>
        <FuelBalanceCard
          fuelIn={movement.receivedLitres}
          fuelOut={movement.outLitres}
          balance={level}
          balanceNote="left in the tank"
          periodLabel={periodLabel}
        />
        {/* ## A warning when there is one (Jeff, 2026-10-01)
            Grey like its neighbour, a red verdict read as one more figure. With a
            verdict the card takes its colour — tinted ground and border, the figure
            and an alert mark in the severity's colour, the same tokens the badge
            uses — and the line under it says what to do. Quiet, it stays a plain
            card: four depots shouting on a good day would teach a reader to look
            past it. */}
        <SummaryCard
          label="Missing in transit"
          pill={periodLabel}
          className={cn(
            verdict?.severity === 'CRITICAL' && 'border-severity-critical/40 bg-severity-critical/10',
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                'flex items-baseline gap-1.5 text-2xl leading-none font-semibold tabular-nums',
                verdict?.severity === 'CRITICAL' ? 'text-severity-critical' : 'text-primary',
              )}
            >
              {verdict !== undefined && (
                <TriangleAlertIcon className="size-5 shrink-0 self-center" aria-hidden="true" />
              )}
              {amount(Math.round(movement.varianceLitres), '')}
              {/* `Headline`'s unit: small and grey whatever colour the figure is. */}
              <span className="text-sm font-normal text-secondary">L</span>
            </p>
            {/* The share, then what to do on a line of its own (Jeff, 2026-10-01). */}
            {movement.variancePercent !== null && (
              <p className="mt-1 text-xs text-secondary">{`${movement.variancePercent.toFixed(1)}% of Fuel Out`}</p>
            )}
            <p className={cn('text-xs', verdict === undefined ? 'text-secondary' : 'font-medium text-primary')}>
              {verdict === undefined ? 'within tolerance' : 'past the limit, trace it from depot to gensets'}
            </p>
          </div>
        </SummaryCard>
      </div>

      {/* No pill: the chart has its own date filter, which the pill would contradict.
          `Fuel level` since 2026-10-05 (Jeff); it was `Level`. */}
      <Card title="Fuel level">
        <LevelChart series={series} capacity={capacity} />
      </Card>

      {/* What the supplier brought beside the gensets this depot supplied (Jeff,
          2026-10-01; side by side again since 2026-10-05). */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* `Tank refills` since 2026-10-05 (Jeff); it was `Deliveries into the depot`. */}
        <Card title={`Tank refills · ${figure(supplies.length)}`} pill={periodLabel}>
          {supplies.length === 0 ? (
            <Empty>No refill in this period.</Empty>
          ) : (
            <ol className="flex flex-col divide-y divide-subtle text-sm">
              {supplies.map((supply) => (
                <li key={supply.at} className="flex justify-between gap-3 py-1.5">
                  <span className="text-secondary">{stampAt(new Date(supply.at).toISOString())}</span>
                  <span className="font-semibold text-primary tabular-nums">{`+${amount(Math.round(supply.litres), 'L')}`}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        {/* Every fill charged to this depot, in the yard or out at a posting, at
            the gensets' own sensors — what the depot cards count as reached gensets (Jeff,
            2026-10-05; `Mobile gensets filled here` until then, yard fills only).
            Where the set stood is under its name, since a fill is no longer
            always at the yard. */}
        {/* `Gensets fuelled` since 2026-10-05 (Jeff); it was `Genset fills supplied`.
            The figure counts fills, not gensets. */}
        <Card title={`Gensets fuelled · ${figure(fills.length)}`} pill={periodLabel}>
          {fills.length === 0 ? (
            <Empty>No genset fill in this period.</Empty>
          ) : (
            <>
              <p className="text-sm text-secondary tabular-nums">{`${amount(Math.round(filledLitres), 'L')} in all`}</p>
              <ol className="flex flex-col divide-y divide-subtle text-sm">
                {fills.slice(0, LIST_LIMIT).map((fill) => {
                  const genset = seededGenset(fill.gensetId);
                  return (
                    <li key={fill.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: fill.gensetId}}
                        className="truncate text-primary underline-offset-2 outline-none hover:underline focus-visible:underline"
                      >
                        {genset === undefined ? fill.gensetId : gensetLabel(genset)}
                      </Link>
                      <span className="text-right font-semibold text-primary tabular-nums">
                        {amount(Math.round(fill.litres), 'L')}
                      </span>
                      <span className="col-span-2 truncate text-xs text-tertiary">
                        {`${stampAt(new Date(fill.at).toISOString())} · ${fill.place}`}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {fills.length > LIST_LIMIT && (
                <Link
                  to="/fuel"
                  // Opens History filtered to this yard (Jeff, 2026-10-05).
                  search={{view: 'history', depot: depot.id}}
                  className="self-start text-sm font-medium text-secondary underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:underline"
                >
                  {`See all ${figure(fills.length)} in History`}
                </Link>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
};

export const DepotPage = ({depot}: {depot: Depot}) => {
  const {from, to, periodLabel} = useFuelWindow();

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FuelNav />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-24 md:pb-4">
        {/* The way back on a phone, where there is no rail. Phone only (Jeff,
            2026-10-01): wider, the rail and the breadcrumb already say it. */}
        <Link
          to="/fuel"
          className="inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline md:hidden"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          All depots
        </Link>

        <DepotBody depot={depot} from={from} to={to} periodLabel={periodLabel} />
      </div>
    </div>
  );
};
