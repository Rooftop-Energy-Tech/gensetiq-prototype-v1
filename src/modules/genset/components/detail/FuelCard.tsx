import {
  ContainerIcon,
  FuelIcon,
  HourglassIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {ComponentType, ReactNode, SVGProps} from 'react';

import {TankGlyph} from '@/components/global/TankGlyph';
import {amount, fuelFraction, fuelHeadline, runtimeSpan, stampDate} from '@/lib/format';
import type {GensetDetail} from '../../data/detail';
import {fuelRunway} from '../../types/fuelLevel.type';
import type {Genset} from '../../types/genset.type';

/**
 * The tank card: a glyph, what is in it, and the three figures beside them.
 *
 * ## What used to be here
 *
 * This file held `GeneratorColumns` — conditions and output as two cards of
 * label/value rows — from the day the gauge row was replaced by lists until
 * 2026-09-22, when every figure on them moved into the band above as a mark or a
 * bar. Nothing was dropped in the move: oil and coolant became marks, running hours
 * and hours on deployment became counter tiles, and line voltage, phase current,
 * power factor, frequency, load, active power and energy produced became bars. A
 * card restating them a rule apart is a second place for the same numbers to
 * disagree.
 *
 * The tank stayed a card because it is the one reading with a shape. `Row` and
 * `Column` stayed with it — they were written for the two cards that have gone, and
 * the one that remains is built from them. `Column` is exported: the marks band
 * takes the same card, so the two sit on one surface at one padding rather than
 * being two shapes that happen to look alike.
 */

/**
 * One reading: its name, and its figure.
 *
 * **Typed exactly as `MetricStrip`'s columns are**, which is the strip at the top of
 * this page carrying Fuel level, Fuel remaining, Service and Alarm. Label
 * `text-sm font-medium text-secondary`, figure `font-semibold text-primary`.
 *
 * The colour token was always shared; the weight was not, and at 60% opacity a
 * regular label beside a medium one reads as a lighter grey rather than as the same
 * grey set differently. Two kinds of label on one page is one kind too many, and the
 * strip is the one that was there first.
 */
const Row = ({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  /** Lucide's, or a hand-drawn one of the same construction — see `OilCanIcon`. */
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <dt className="flex min-w-0 shrink items-center gap-2.5 text-sm font-medium text-secondary">
      {/* The glyph in a tinted square, which is the reference UI's treatment and
          worth borrowing: a row of labels all set in the same grey is scanned by
          reading, where a column of small marks is scanned by shape, and a reader
          coming back to this page twice a day is looking for *the coolant row*
          rather than for the word.

          `bg-highlight` rather than the reference's saturated fill. Ten saturated
          squares down two cards would make the marks the loudest thing on a band
          whose subject is the figures beside them; the tint is enough to read as a
          chip without competing. */}
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-highlight">
        <Icon className="size-4 text-secondary" aria-hidden="true" />
      </span>
      <span className="truncate">{label}</span>
    </dt>
    <dd className="min-w-0 truncate text-right text-sm font-semibold text-primary tabular-nums">
      {children}
    </dd>
  </div>
);


/**
 * One group of readings, as a tile.
 *
 * The whole list inside one card rather than a card per reading — Afifah's call,
 * 2026-09-22, and the right one. A tile per figure turns six readings into six
 * bordered boxes and spends the border on separating things nobody needs separated:
 * the reader's unit is the *group*, and what they want is to find Output and then
 * scan down it. A card around the group draws exactly that boundary and leaves the
 * rows inside it to a hairline, which is all the separation a label-value pair needs.
 *
 * `self-stretch` on the section so the three cards match heights across the band
 * whatever each holds — a four-row card and a six-row card with different bottoms
 * read as two unfinished things rather than two groups.
 *
 * The heading is `text-secondary`, the same 60% every label on this page carries.
 * It was `text-tertiary` at 40% on the argument that a group's name is a step below
 * the readings in it — true in the abstract, and wrong here: three cards whose
 * titles are the palest text on the band read as three faded things beside a strip
 * whose labels are solid. One page, one label colour.
 *
 * **The surface is `MetricStrip`'s, down to the padding.** That strip is what draws
 * `Fuel level` and `Fuel remaining` at the top of this page, and a card lower down
 * the same page in a different shade would read as a different *kind* of thing
 * rather than the same kind further on. `bg-element` over the page's `bg-canvas` is
 * the app's one rule for a raised surface; `px-5 py-4` is the strip's own, matched
 * here so the two do not drift by a pixel either.
 */
export const Column = ({title, children}: {title: string; children: ReactNode}) => (
  <section className="flex min-w-0 flex-1 basis-0 flex-col gap-2 self-stretch rounded-md border border-subtle bg-element px-5 py-4">
    <h3 className="text-xs font-medium tracking-wide text-secondary uppercase">{title}</h3>
    {children}
  </section>
);


/**
 * The tank, beside the generator columns rather than a band below them.
 *
 * **Rendered whether or not the engine is turning, and that is the point.** The two
 * columns beside it are about a machine in motion and have nothing to say about one
 * standing still. A tank always has something to say, and on a standby estate it has
 * the most to say precisely when the set is stopped: what is in it now is what the
 * next outage gets. So the labels change with the run state and the figures do not
 * disappear — a stopped set's burn rate is what it *was* metering, and its runway is
 * runtime it would get rather than a countdown of wall-clock.
 *
 * **The glyph stays**, at `2xl`. The rows are the numbers; the tank is the one thing
 * on this band a reader takes in without reading, and a column of aligned figures is
 * exactly what it is good against. It has been `lg`, then `xl`, then `lg` again as
 * the card changed shape around it; `2xl` is for the card it is in now, which
 * stretches to the height of the output card beside it and left a 46px tank sitting
 * in the corner of a tall box.
 */
export const FuelColumn = ({
  genset,
  detail,
  running,
}: {
  genset: Genset;
  detail: GensetDetail;
  running: boolean;
}) => {
  const belowReserve = genset.fuelLitres <= detail.fuel.reserveFraction * detail.fuel.maxLitres;

  return (
    <Column title="Fuel">
      {/* Tank on the left, figures on its right — the arrangement the fuel panel
          had before this became a column, and the reason for going back to it is
          the glyph's size. Stacked, the tank had a column's width to fill and took
          46px of it; beside its own figures it can take 72 × 96 and still leave the
          three rows their labels. The two other columns are rows all the way down,
          so this one reads as the odd column out — which it is: it is the only one
          whose subject has a shape.

          `items-start` rather than `items-center`: the tank's cap should line up
          with the first row's baseline, not float against the middle of three. */}
      <div className="flex items-start gap-4 py-1.5">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <TankGlyph
            fraction={fuelFraction(genset.fuelLitres, detail.fuel.maxLitres)}
            tone="fuel"
            size="2xl"
          />
          <p className="text-sm font-semibold whitespace-pre text-primary">
            {fuelHeadline(genset.fuelLitres, detail.fuel.maxLitres)}
          </p>
          <p className="text-xs text-secondary">
            {fuelRunway(genset.fuelLitres, detail.fuel, running)}
          </p>
        </div>

        <dl className="flex min-w-0 flex-1 flex-col divide-y divide-subtle">
          <Row label="Max capacity" icon={ContainerIcon}>{amount(detail.fuel.maxLitres, 'L')}</Row>
          {/* ⚠️ The label no longer says whether the figure is metered or
              estimated. It read `Metered rate` / `Estimated rate` until 2026-09-22
              — Afifah's call — and the distinction is real: without a flow meter
              this is computed from the electrical load, a good estimate and not a
              measurement. `instrumentsOf` still knows which machines have one, so
              restoring it is a word in this label or a suffix on the value. */}
          <Row label={running ? 'Fuel burn rate' : 'Fuel burn rate, last run'} icon={FuelIcon}>
            {amount(detail.fuel.litresPerHour, 'L/hr', 1)}
          </Row>
          <Row label={running ? 'Refuel by' : 'Runtime to reserve'} icon={HourglassIcon}>
            {running
              ? stampDate(detail.fuel.refuelBy)
              : belowReserve
                ? 'none'
                : runtimeSpan(detail.fuel.hoursToReserve)}
          </Row>
        </dl>
      </div>
    </Column>
  );
};
