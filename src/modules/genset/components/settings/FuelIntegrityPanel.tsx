import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  DropletsIcon,
  PauseCircleIcon,
  PowerOffIcon,
  UnplugIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {FUEL_INTEGRITY, figuresOf} from '../../types/fuelIntegrity.type';
import type {
  FuelIntegrityFigures,
  FuelIntegrityState,
  InstrumentFeed,
} from '../../types/fuelIntegrity.type';

/**
 * The verdict, and every number behind it.
 *
 * A leak alarm sends somebody to a site, which is a more expensive action than any
 * other alarm on this page provokes — so it is the one that most needs to be
 * arguable. "Leak detected" is an assertion; "expected 1,470 L, measuring 1,375 L,
 * of which 27 L is instrument tolerance, against a line at 49 L" is a claim a
 * commissioning engineer can disagree with, and disagreeing with it is exactly what
 * the threshold above is for.
 *
 * The three states with no figures are written as sentences rather than as a table
 * of dashes, because they are not a reading of zero — they are the app declining to
 * make a claim, and each names what would let it make one.
 */

/** How each state reads and which glyph carries it. */
const VERDICT: Record<
  FuelIntegrityState['kind'],
  {label: string; icon: LucideIcon; className: string}
> = {
  unavailable: {label: 'Cannot be checked', icon: UnplugIcon, className: 'text-tertiary'},
  off: {label: 'Switched off', icon: PowerOffIcon, className: 'text-tertiary'},
  suspended: {label: 'Paused', icon: PauseCircleIcon, className: 'text-tertiary'},
  ok: {label: 'Reconciles', icon: CircleCheckIcon, className: 'text-severity-ok'},
  warning: {label: 'Losing fuel', icon: CircleAlertIcon, className: 'text-severity-warning'},
  critical: {label: 'Losing fuel', icon: CircleXIcon, className: 'text-severity-critical'},
  surplus: {label: 'Gaining fuel', icon: DropletsIcon, className: 'text-severity-warning'},
};

const FEED_PROSE: Record<InstrumentFeed, string> = {
  'not-fitted': 'is not fitted',
  'no-reading': 'is fitted but not reporting',
  reporting: 'is reporting',
};

/**
 * The sentence under the verdict.
 *
 * Each of the states that makes no claim says what it would take to make one,
 * because they are fixed by completely different acts — a purchase order, a site
 * visit, a switch, or simply waiting. A single "unavailable" would leave the reader
 * to work out which.
 */
const explain = (state: FuelIntegrityState): string => {
  switch (state.kind) {
    case 'unavailable': {
      // Both quiet at once is the panel, not the instruments — worth saying,
      // because sending somebody to look at two devices that are both fine is a
      // wasted trip.
      if (state.levelSensor === 'no-reading' && state.flowMeter === 'no-reading') {
        return 'This panel has stopped reporting, so neither instrument can be read. Nothing about this tank can be checked until it is back.';
      }
      if (state.flowMeter === 'not-fitted' && state.levelSensor === 'not-fitted') {
        return 'Neither a tank level sensor nor a fuel flow meter is fitted. This check needs both.';
      }
      return `The fuel flow meter ${FEED_PROSE[state.flowMeter]} and the tank level sensor ${FEED_PROSE[state.levelSensor]}. This check needs both, reporting.`;
    }
    case 'off':
      return 'Both instruments are fitted and reporting. Nothing is being compared because the alarm is switched off.';
    case 'suspended':
      return state.reason === 'settling'
        ? `The tank was disturbed within the last ${FUEL_INTEGRITY.blankingMinutes} minutes — by a delivery, or by the engine starting or stopping. Fuel that is still moving reads as volume on a level probe, so the check waits for it to settle.`
        : `Less than ${FUEL_INTEGRITY.minimumCoverageHours} hours of the ${FUEL_INTEGRITY.windowHours}-hour window are covered by both instruments. A meter has nothing to reconcile against until it has been fitted long enough to have a yesterday.`;
    case 'ok': {
      const hours = Math.round(state.figures.coveredHours);
      // Two different clean bills of health, and conflating them was a live bug:
      // a shortfall the instruments cannot account for but that sits under the
      // operator's line is *not* "within what the instruments could be wrong by",
      // and saying so would hide a real loss behind a sentence about tolerance.
      // Raise the threshold above a genuine leak and the page has to keep saying
      // the leak is there.
      return state.figures.confirmedShortfallLitres > 0
        ? `${Math.round(state.figures.confirmedShortfallLitres)} L is unaccounted for over the last ${hours} hours — more than the instruments can explain, but under the threshold set below. Nothing is raised.`
        : `Over the last ${hours} hours the tank has fallen by what the engine burned, within what the instruments could be wrong by.`;
    }
    case 'surplus':
      return 'The tank holds more than it should. Either a delivery was not recorded, or an instrument is reading wrongly — nothing here can tell which, and both are worth checking.';
    default:
      return `Fuel has left this tank without passing the injectors. ${
        state.figures.span === 'STOPPED'
          ? 'The engine did not run in this window, so the flow meter reading zero is the meter being right — which leaves the tank or somebody with a hose.'
          : state.figures.span === 'RUNNING'
            ? 'The engine was running throughout, so a return-line leak or a meter reading low are also live explanations.'
            : 'The loss spans running and stopped hours.'
      }`;
  }
};

const Row = ({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-subtle py-2 last:border-b-0">
    <div className="flex min-w-0 flex-col">
      <span className="text-sm text-secondary">{label}</span>
      {note !== undefined ? <span className="text-xs text-tertiary">{note}</span> : null}
    </div>
    <span
      className={
        emphasis
          ? 'text-base font-medium whitespace-nowrap text-primary'
          : 'text-sm whitespace-nowrap text-primary'
      }
    >
      {value}
    </span>
  </div>
);

/**
 * The arithmetic, in the order it is performed.
 *
 * Read top to bottom it is the calculation: what was there, what went in, what was
 * burned, what should be left, what is left, and the two deductions that turn the
 * difference into something worth alarming on. Any other order — severity first, or
 * the inputs grouped by instrument — would show the same numbers and stop being a
 * derivation.
 */
const Working = ({figures}: {figures: FuelIntegrityFigures}) => (
  <div className="flex flex-col rounded-lg border border-default bg-element px-4 py-2">
    <Row
      label="Tank at the start of the window"
      note={`${Math.round(figures.coveredHours)} hours ago`}
      value={amount(Math.round(figures.openingLitres), 'L')}
    />
    <Row label="Delivered since" value={`+ ${amount(Math.round(figures.refuelledLitres), 'L')}`} />
    <Row
      label="Metered to the engine"
      note="what the flow meter totalled"
      value={`− ${amount(Math.round(figures.meteredBurnLitres), 'L')}`}
    />
    <Row
      label="So the tank should hold"
      value={amount(Math.round(figures.expectedLitres), 'L')}
      emphasis
    />
    <Row
      label="The level sensor reads"
      value={amount(Math.round(figures.measuredLitres), 'L')}
      emphasis
    />
    <Row
      label="Unaccounted for"
      value={amount(Math.round(figures.unaccountedLitres), 'L')}
      emphasis
    />
    <Row
      label="Instrument tolerance"
      note="probe accuracy on this tank, plus meter accuracy on that burn"
      value={`± ${amount(Math.round(figures.toleranceLitres), 'L')}`}
    />
    <Row
      label="Confirmed shortfall"
      note="what is left once the instruments have been allowed for"
      value={amount(Math.round(figures.confirmedShortfallLitres), 'L')}
      emphasis
    />
    <Row
      label="Your threshold"
      note={`${figures.thresholdPercent}% of tank capacity`}
      value={amount(figures.thresholdLitres, 'L')}
    />
  </div>
);

export const FuelIntegrityPanel = ({state}: {state: FuelIntegrityState}) => {
  const verdict = VERDICT[state.kind];
  const VerdictIcon = verdict.icon;
  const figures = figuresOf(state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="element" size="md" className="border-subtle">
          <VerdictIcon className={verdict.className} aria-hidden="true" />
          {verdict.label}
        </Badge>

        {/* The headline figure belongs to a raised alarm. On an `ok` verdict a
            loss figure beside the word "Reconciles" reads as a contradiction, and
            the sentence below is the place that can hold both halves. */}
        {figures !== undefined &&
        figures.confirmedShortfallLitres > 0 &&
        (state.kind === 'warning' || state.kind === 'critical') ? (
          <span className="text-base font-medium text-primary">
            {amount(Math.round(figures.confirmedShortfallLitres), 'L')} over{' '}
            {Math.round(figures.coveredHours)} hours ·{' '}
            {amount(Math.round(figures.lossRateLitresPerHour * 10) / 10, 'L/hr', 1)}
          </span>
        ) : null}
      </div>

      <p className="max-w-prose text-sm text-secondary">{explain(state)}</p>

      {figures === undefined ? null : <Working figures={figures} />}
    </div>
  );
};
