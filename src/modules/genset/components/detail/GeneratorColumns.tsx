import type {ReactNode} from 'react';

import {activePosting} from '@/modules/deployment/data/store';
import {gensetTotalsIn} from '@/modules/deployment/data/seed';
import {postingEnd} from '@/modules/deployment/types/deployment.type';
import type {GensetDetail} from '../../data/detail';
import type {Reading} from '../../types/telemetry.type';

/**
 * What the running set is doing, in the two questions a reader actually asks.
 *
 * ## Why this replaced five dials and two bar charts
 *
 * The band was a gauge row — frequency, active power, oil pressure, coolant and the
 * charge alternator — with line voltage and phase current drawn as bars under it.
 * Dials earn their place where a reading *moves* and the movement is the diagnosis:
 * oil pressure falling through a run, coolant climbing towards its shutdown. They
 * earn nothing on **frequency**, which a governor holds at 50.0 Hz until something
 * is very wrong, or on **active power**, whose whole meaning is a number against a
 * nameplate rather than a needle position. Afifah's call, 2026-09-22: the meters go.
 *
 * ## The split, and why these two headings
 *
 * **Conditions** is the engine's own health — what a fitter looks at. **Output** is
 * what the alternator is delivering — what an operations room bills and plans on.
 * A reader arrives with one of those two questions and almost never both, so the
 * page answers each in its own column rather than interleaving them by instrument
 * type, which is how a gauge row orders things and is nobody's question.
 *
 * Running hours appear in Conditions rather than Output because they are wear: a
 * service falls due on hours turned, not on kWh sold.
 */

const Row = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <dt className="shrink-0 text-sm text-secondary">{label}</dt>
    <dd className="min-w-0 truncate text-right text-sm text-primary tabular-nums">{children}</dd>
  </div>
);

const Column = ({title, children}: {title: string; children: ReactNode}) => (
  <section className="flex min-w-0 flex-1 flex-col gap-1">
    <h3 className="text-xs font-medium tracking-wide text-tertiary uppercase">{title}</h3>
    <dl className="flex flex-col divide-y divide-subtle">{children}</dl>
  </section>
);

/** A reading's value and unit, or an em dash where the controller reports nothing. */
const value = (reading: Reading | undefined): string =>
  reading === undefined
    ? '—'
    : `${reading.value.toLocaleString('en-MY', {
        minimumFractionDigits: reading.precision ?? 0,
        maximumFractionDigits: reading.precision ?? 0,
      })}${reading.unit === '' ? '' : ` ${reading.unit}`}`;

/** `195.4 h`, to a tenth — the resolution a service interval is quoted at. */
const hours = (value_: number): string =>
  `${value_.toLocaleString('en-MY', {minimumFractionDigits: 1, maximumFractionDigits: 1})} h`;

export const GeneratorColumns = ({
  gensetId,
  detail,
  now,
}: {
  gensetId: string;
  detail: GensetDetail;
  now: number;
}) => {
  const read = (key: string): Reading | undefined => detail.readings[key];

  // Hours on the job this machine is standing on. `undefined` where it is standing
  // on none — a set in the workshop between postings has no current deployment, and
  // an hours figure against a job that does not exist would be a number about
  // nothing. The totals are the same ones the deployment's own page reads, clipped
  // to the posting's window, so the two cannot disagree.
  const posting = activePosting(gensetId, now);
  const postingHours =
    posting === undefined
      ? undefined
      : gensetTotalsIn(
          gensetId,
          new Date(posting.deployment.startsAt).getTime(),
          (() => {
            const end = postingEnd(posting);
            return end === null ? now : new Date(end).getTime();
          })(),
          now,
        ).runtimeHours;

  const loadKw = detail.loadKw ?? 0;
  // Load as a share of the nameplate. The kW figure is the fact and this is its
  // altitude: 236 kW means nothing until you know whether the machine is rated 300
  // or 1,250, and a reader scanning a fleet reads the percentage first.
  const loadPercent = detail.ratedKw > 0 ? Math.round((loadKw / detail.ratedKw) * 100) : 0;

  const lineVoltages = ['voltage-l1l2', 'voltage-l2l3', 'voltage-l3l1']
    .map((key) => read(key)?.value)
    .filter((entry): entry is number => entry !== undefined);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 md:flex-row md:gap-16">
      <Column title="Generator conditions">
        <Row label="Oil pressure">{value(read('oil-pressure'))}</Row>
        <Row label="Coolant temperature">{value(read('coolant-temp'))}</Row>
        <Row label="Running hours">{value(read('engine-hours'))}</Row>
        {/* Named for the job rather than as "this deployment", so the row reads on
            its own: a reader who has not scrolled to the posting card still knows
            which window the hours belong to. */}
        <Row label="Hours on current deployment">
          {postingHours === undefined ? (
            <span className="text-tertiary">Not deployed</span>
          ) : (
            hours(postingHours)
          )}
        </Row>
      </Column>

      <Column title="Generator output">
        {/* Three phases on one row, separated rather than stacked: the reader's
            question is whether they agree, and three figures side by side answer it
            faster than three labelled rows. The label carries the phases' order. */}
        <Row label="Line voltage L1-L2 / L2-L3 / L3-L1">
          {lineVoltages.length === 0
            ? '—'
            : `${lineVoltages.map((entry) => Math.round(entry)).join(' / ')} V`}
        </Row>
        <Row label="Power factor">{value(read('power-factor'))}</Row>
        <Row label="Load">{`${loadPercent}% of ${Math.round(detail.ratedKw).toLocaleString('en-MY')} kW`}</Row>
        <Row label="Active power">{`${Math.round(loadKw).toLocaleString('en-MY')} kW`}</Row>
        <Row label="Frequency">{value(read('frequency'))}</Row>
        {/* This run's, not the day's and not the machine's life. The run card below
            carries the same figure; it is here because a reader asking what the set
            is producing is asking the output column, and sending them down the page
            for the last of six answers is the band failing at its one job. */}
        <Row label="Energy produced">
          {`${Math.round(detail.run.energyProducedKwh).toLocaleString('en-MY')} kWh`}
        </Row>
      </Column>
    </div>
  );
};
