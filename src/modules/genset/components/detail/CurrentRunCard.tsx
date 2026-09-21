import {Link} from '@tanstack/react-router';
import {ArrowRightIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, clockTime, durationCompact, stampDay} from '@/lib/format';
import {cn} from '@/lib/utils';
import {isOpen, runElapsedMs} from '../../types/run.type';
import type {GensetRun} from '../../types/run.type';
import {DEFAULT_RUN_WINDOW} from '../../types/runsView.type';

/**
 * One end of the interval — the time large, the day quiet beneath it.
 *
 * Split across two lines rather than `stampAt`'s one because the card now sets the
 * two stamps *opposite* each other with the duration between them: on one line
 * each stamp is 117px of unbreakable text, the pair eats 234px of a 390px card and
 * the figure in the middle is left with a gap it cannot sit in. Stacked, a stamp
 * is as wide as its date — about 70px — and the same row fits a phone.
 *
 * The split also sorts the two facts by how often they are read. Two runs out of
 * three start and finish inside one day, so the day is usually the same word
 * twice; the times never are. The times get the weight.
 */
const Stamp = ({iso, className}: {iso: string; className?: string}) => (
  <div className={cn('flex shrink-0 flex-col', className)}>
    <span className="text-sm font-medium whitespace-nowrap text-primary">
      {clockTime(iso)}
    </span>
    <span className="text-xs whitespace-nowrap text-secondary">{stampDay(iso)}</span>
  </div>
);

/**
 * The run card — the numbers an operator asks for first, on the one run in front
 * of them.
 *
 * ## The interval is the card
 *
 * A run is an interval, and this reads as one: started here, ran this long, ended
 * there, left to right along a rule. The three facts were a stamp column beside a
 * stack of label/value rows before, which said the same thing in a shape that hid
 * it — `Time ran ─── 12 h` was a row in a list of three, ranked level with fuel
 * and energy, and the two stamps were a separate column the reader had to relate
 * to it themselves. Set on the rule the duration *is* the distance between the
 * stamps, and there is nothing left to relate.
 *
 * Fuel consumed and energy produced stay, and stay *totals* rather than
 * instantaneous readings — that is why they belong on this card and not in the
 * gauge row: they are what work gets judged on afterwards (litres per kWh
 * delivered, hours against the service interval), and they keep accumulating
 * whether or not anybody is watching the dials. But they are the run's receipt,
 * not its shape, so they read as one quiet line under the interval instead of two
 * more rows competing with it — the words grey, the figures at the same weight as
 * everything else on the card. Greying a figure to keep a line quiet is the wrong
 * economy: an operator scanning three sets for the one burning litres per kWh is
 * scanning these two numbers, and it is the `Produced`/`Consumed` that can afford
 * to recede once they have been read the first time.
 *
 * ## One run, and nothing in a second column beside it
 *
 * Today's totals were a column here, on the argument that the day is the context a
 * run is read against. They are gone, and what killed the column is what killed
 * the `Today` *card* before it: on a set with one run today — much the commonest
 * case — every figure in the second column was the figure already printed to its
 * left, so the card spent most of its life saying `5 hours`, `15 kWh`, `7 L`
 * twice.
 *
 * The day has a home already. Band 5's chart answers *how much today* with a day
 * stepper and a period control beside it — against yesterday, against the week —
 * which is the comparison that makes a day's figure worth reading at all. A card
 * about one start does not need to answer it a second time, worse.
 *
 * ## An open run still has two ends
 *
 * For an open run the right-hand stamp is the latest telemetry rather than a stop
 * time. Blanking it would leave the rule running into nothing, and the reader
 * already knows which it is: the badge says `Current run`, and a card that says
 * `Current run` cannot be reporting a time the machine stopped.
 */
export const CurrentRunCard = ({
  run,
  gensetId,
  now,
}: {
  run: GensetRun;
  gensetId: string;
  now: number;
}) => {
  const open = isOpen(run);
  const endStamp = run.endedAt ?? new Date(now).toISOString();

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 rounded-md border border-default bg-element px-3 pt-3 pb-4">
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

      {/* Start, duration, end — one line, in the order they happened.

          The rule carries the duration rather than sitting under it: a figure
          floating between two stamps is a third stamp until something ties it to
          them, and the arrowhead landing on the end stamp is what says which way
          the line runs. It survives at phone width because the stamps are stacked
          and narrow — the middle is the only part that has to give, and a rule is
          the one element here that can.

          `items-start` with a 20px middle rather than `items-center`: centred on a
          two-line stamp the rule floats between the clock time and the date, and
          the three figures that make the sentence — 2:03, 12 h, 14:03 — no longer
          sit on one line. Pinned to the first line they do, and the dates drop out
          of the sentence into the quiet row beneath it, which is where they
          belong. */}
      <div className="flex items-start gap-3">
        <Stamp iso={run.startedAt} />

        <div className="flex h-5 min-w-0 flex-1 items-center gap-2">
          <span className="h-0 flex-1 border-t border-subtle" aria-hidden="true" />
          <span className="text-sm font-medium whitespace-nowrap text-primary">
            {durationCompact(runElapsedMs(run, now))}
          </span>
          <span className="flex min-w-0 flex-1 items-center">
            <span className="h-0 flex-1 border-t border-subtle" aria-hidden="true" />
            <ArrowRightIcon
              className="-ml-1 size-3.5 shrink-0 text-subtle"
              aria-hidden="true"
            />
          </span>
        </div>

        <Stamp iso={endStamp} className="items-end text-right" />
      </div>

      {/* The receipt. `truncate` on the left half and not the right: on a card too
          narrow for both, `Consumed 24 L` is the shorter string and the one an
          operator with a fuel problem came here for, so the litres stay whole and
          the kWh give up their label first. */}
      <div className="flex items-baseline justify-between gap-3 text-sm text-secondary">
        <span className="min-w-0 truncate">
          Produced{' '}
          <span className="font-medium text-primary">
            {amount(run.energyProducedKwh, 'kWh')}
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap">
          Consumed{' '}
          <span className="font-medium text-primary">
            {amount(run.fuelConsumedLitres, 'L')}
          </span>
        </span>
      </div>
    </div>
  );
};
