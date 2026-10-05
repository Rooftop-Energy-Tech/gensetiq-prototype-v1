import {ChevronRightIcon, TriangleAlertIcon} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {CardPill, SummaryCardLabel} from '@/components/global/SummaryCards';
import {Badge, verdictVariant} from '@/components/ui/badge';
import {relativeTime, stampAt} from '@/lib/format';
import {DepotTankGlyph} from './DepotTankGlyph';
import {cn} from '@/lib/utils';
import {
  depotCapacityLitres,
  depotSeries,
  reconcile,
  varianceSeverity,
} from './data/depotTank';
import type {Depot, DepotReconciliation, VarianceVerdict} from './data/depotTank';
import {amount} from './format';

/** The tank's percentage, centred on the vessel's body, not on the saddles too. */
const PERCENT = 'absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-semibold tabular-nums';

/**
 * A verdict's badge, in the strongest words that are true (Jeff, 2026-09-30).
 *
 * A shortfall is `252 L missing in transit`: fuel left the tank and never arrived in
 * a genset this depot supplied, and the amount is in the badge so a reader knows how
 * bad before reading on. There was a second, `Sensor fault`, for a gap past the
 * 100 L floor too small to be a loss, until 2026-10-05 (Jeff). They were
 * `Fuel did not arrive` and `Check calibration` first, then `252 L missing at depot`
 * until 2026-10-01, then `252 L unlogged` until 2026-10-05.
 */
export const verdictLabel = (varianceLitres: number): string =>
  `${amount(Math.round(varianceLitres), 'L')} missing in transit`;

/**
 * The yard's bulk tank, drawn as a genset's is.
 *
 * ## Why this replaced the list of every tank
 *
 * The page opened on all thirty-eight machine tanks ranked worst-first, which is a
 * fleet fuel *status* board — and the fleet register already ranks by fuel, and each
 * machine's own page carries its tank in more detail than a bar can. What this page
 * has that no other does is **the depot**: the one tank whose level says how much
 * fuel left the yard, which is the whole basis of the reconciliation beside it.
 *
 * It gets its own mark rather than the genset glyph — see `DepotTankGlyph`. A yard's
 * bulk tank is a horizontal vessel on saddles, and drawing it as a machine's upright
 * belly tank made the page's one *place* look like a thirty-ninth machine.
 *
 * ## It has no reserve line, and should not
 *
 * A machine's tank has a reserve because running it dry strands a set mid-load and
 * needs the fuel system bled. A depot running low is a purchasing problem with days
 * of warning, so the glyph carries the level and the capacity and nothing about
 * urgency — the reconciliation beside it is where this page raises alarms.
 */
export const DepotTank = ({
  depot,
  from,
  to,
  periodLabel,
  onOpen,
}: {
  depot: Depot;
  from: number;
  to: number;
  /** `last 30 days`, for the corner pill — the page's window decides it. */
  periodLabel: string;
  /** Opens this yard's page. The whole card is the target. */
  onOpen: () => void;
}) => {
  const series = depotSeries(depot.id);
  const capacity = depotCapacityLitres(depot.id);
  // The page's window. `useMemo` is not worth it: `reconcile` walks a 60-day hourly
  // series once per card and the page draws four.
  const movement = reconcile(depot.id, from, to);
  // `252 L missing in transit` for a gap over 100 L; otherwise quiet. See
  // `varianceSeverity`.
  const verdict = varianceSeverity(movement.varianceLitres);
  const level = series.at(-1)?.litres ?? 0;
  // The level sensor's last report. A sample can carry a stamp half a step ahead
  // (the walk records a draw mid-hour), so the newest one not in the future.
  const reported = [...series].reverse().find((sample) => sample.t <= Date.now())?.t;
  const fraction = capacity > 0 ? level / capacity : 0;

  return (
    // ## Saying the card opens something, before the pointer is on it
    //
    // The card is the click target, as a row is in a register. A faint `Details`
    // in the footer did not say so (Jeff, 2026-09-30), so the name says it instead:
    // `KLANG DEPOT ›`, a link, as a genset's plate is on the register. Hovering
    // anywhere on the card lifts it and underlines the name, so the whole tile is
    // seen to answer, not only the words. The name is also the keyboard's way in,
    // so the section itself is not focusable.
    <section
      onClick={onOpen}
      className="group flex min-w-0 cursor-pointer flex-col gap-2 self-stretch rounded-md border border-subtle bg-element px-5 py-4 transition hover:-translate-y-px hover:border-strong hover:shadow-md"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <SummaryCardLabel>
          {/* A real link, so a keyboard reaches it and a middle-click opens a tab. */}
          <Link
            to="/fuel/depots/$depotId"
            params={{depotId: depot.id}}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-0.5 rounded-sm underline-offset-2 outline-none group-hover:underline focus-visible:ring-2 focus-visible:ring-outline"
          >
            {`${depot.name} depot`}
            <ChevronRightIcon
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </SummaryCardLabel>

        {/* The verdict, where a reader's eye lands first on a grid of four yards.
            Absent when the two sides agree, rather than a green `Reconciled` chip:
            four cards each declaring success is four things to read past to find
            the one that did not. */}
        {/* The window once, as a pill like the overview cards', not on each row
            (Jeff, 2026-10-01). */}
        <div className="flex items-center gap-2">
          {/* No place beside the name (Jeff, 2026-10-01): `Klang, Selangor` said
              Klang twice, and the state alone was not worth the space. */}
          {verdict !== undefined && (
            <Badge variant={verdictVariant(verdict.severity)}>
              <TriangleAlertIcon aria-hidden="true" />
              {verdictLabel(movement.varianceLitres)}
            </Badge>
          )}
          <CardPill>{periodLabel}</CardPill>
        </div>
      </header>

      {/* ## Stacked on a phone, side by side from `sm`
          The tank is a fixed 200px and the figures took what was left, which on a
          390px screen is about ninety — narrower than `Missing in transit`
          itself, so every label broke over four lines and every value orphaned its
          `L` onto a second. Below `sm` the tank sits on top and the list runs the
          full width of the card. */}
      <div className="flex flex-col items-center gap-3 py-1.5 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex w-full max-w-[200px] shrink-0 flex-col items-center gap-1.5">
          {/* The percentage sits on the tank it measures, and the litres under it,
              smaller: one line of three figures at one weight gave the eye nothing
              to land on. `top-[50%]` is the vessel's own middle — its body spans
              28 to 104 of the glyph's 132 — not the saddles'. */}
          <div className="relative w-full">
            <DepotTankGlyph fraction={fraction} className="block w-full" />
            <span aria-hidden="true" className={cn(PERCENT, 'text-primary')}>
              {`${Math.round(fraction * 100)}%`}
            </span>
          </div>
          <p className="text-base font-semibold text-primary tabular-nums">
            {`${amount(level, '')} / ${amount(capacity, 'L')}`}
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col">
          <DepotBreakdown movement={movement} verdict={verdict} />
        </div>
      </div>

      {/* When the level was read, as the fleet table's `Last updated` says it for a
          genset: a tank figure is only as good as its age. Pinned to the card's
          bottom-left by `mt-auto`, so it lines up across a row of cards of unequal
          height. The exact time is the tooltip. */}
      {reported !== undefined && (
        <footer className="mt-auto text-xs text-secondary" title={stampAt(new Date(reported).toISOString())}>
          {`Last updated: ${relativeTime(new Date(reported).toISOString())}`}
        </footer>
      )}
    </section>
  );
};

/**
 * The card's reconciliation, as rows.
 *
 * ## Every row, on every card
 *
 * `Fuel In`, `Fuel Out`, the share of `Fuel Out` that reached gensets, and `Missing
 * in transit`, on every card whether or not it has a verdict (Jeff, 2026-10-01). It
 * was the gap row alone on a quiet card, on the reasoning that four cards of six
 * rows each was a lot to read past; but a depot's month — what came in, what went
 * out and whether it arrived — is worth reading on a quiet day too. A `Show
 * breakdown` toggle was tried and removed on 2026-09-30.
 */
export const DepotBreakdown = ({
  movement,
  verdict,
  withFuelIn = true,
}: {
  movement: DepotReconciliation;
  verdict: VarianceVerdict | undefined;
  /**
   * Draw the `Fuel In` row. Off on the depot's page, whose `Fuel balance` card
   * already says it, so the breakdown there is `Fuel Out` and where it went.
   */
  withFuelIn?: boolean;
}) => (
  // Rules under `Fuel In` and under `Reached gensets` only (Jeff, 2026-10-01), so
  // `Fuel Out` and the share under it read as one block, between the depot's
  // deliveries above and the gap below.
  <dl className="flex w-full min-w-0 flex-col">
    {/* The two movements a level sensor can see, over the last 30 days.
        Fuel In is every rise, Fuel Out is every fall, In first (Jeff,
        2026-10-01), and they are kept apart
        rather than netted: a 50,000 L delivery into the yard would otherwise
        cancel a week of issues and the tile would read as a quiet
        month. Thirty days, the page's fixed window (`useFuelWindow`) — long
        enough that every yard has taken at least one delivery in it. */}
    {withFuelIn && (
      <div className="flex items-baseline justify-between gap-4 border-b border-subtle py-1.5">
        <dt className="shrink-0 text-sm font-medium text-secondary">Fuel In</dt>
        <dd className="text-right text-sm font-semibold whitespace-nowrap text-primary tabular-nums">
          {movement.receivedLitres === 0 ? (
            <span className="text-tertiary">No delivery</span>
          ) : (
            // Signed, as the depot page's `Tank refills` rows are:
            // fuel in reads `+12, 670 L` wherever it is listed (2026-10-05).
            `+${amount(movement.receivedLitres, 'L')}`
          )}
        </dd>
      </div>
    )}
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm font-medium text-secondary">Fuel Out</dt>
      <dd className="text-right text-sm font-semibold whitespace-nowrap text-primary tabular-nums">
        {amount(movement.outLitres, 'L')}
      </dd>
    </div>
    {/* ## The other end of the pipe (Jeff, 2026-10-05)
        Indented under `Fuel Out`, since it is where that fuel should be: what
        the gensets this depot supplied saw arrive in their own tanks. It was
        `Mobile gensets` and `Fuel trucks` until then, the yard pump log's two
        shares; the trucks were removed and the depot is now reconciled
        against its gensets. */}
    <div className="flex items-baseline justify-between gap-4 border-b border-subtle py-1.5">
      <dt className="shrink-0 pl-3 text-sm font-medium text-secondary">Reached gensets</dt>
      <dd className="text-right text-sm font-semibold whitespace-nowrap text-primary tabular-nums">
        {amount(movement.arrivedLitres, 'L')}
      </dd>
    </div>

    {/* **Fuel that left the tank and never reached a genset** — the case worth
        chasing (Jeff, 2026-10-05). It never reads below zero: the gensets
        recording more than the tank fell, a sensor reading short, had its own
        label (`Over-logged fuel`) and was set aside on 2026-10-01.

        It was `Fuel Out − Fuel Arrived` first, the subtraction as its own
        working; then `Fuel missing`, then `Missing at depot`, then `Unlogged
        fuel` (2026-10-01) while the depot was checked against its own pump
        log. `Missing in transit` since 2026-10-05. */}
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm font-medium text-secondary">Missing in transit</dt>
      <dd
        className={cn(
          'shrink-0 text-right text-sm font-semibold whitespace-nowrap tabular-nums',
          verdict?.severity === 'CRITICAL' ? 'text-severity-critical' : 'text-primary',
        )}
      >
        {amount(movement.varianceLitres, 'L')}
        {movement.variancePercent !== null && (
          <span className="font-medium text-secondary">{` (${movement.variancePercent.toFixed(1)}%)`}</span>
        )}
      </dd>
    </div>
  </dl>
);
