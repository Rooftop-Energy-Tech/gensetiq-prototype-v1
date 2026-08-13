import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {canTakeLoad} from '../types/site.type';
import type {SiteSummary} from '../data/sites';

/**
 * The changeover: which set is on the bus.
 *
 * A site has one load and one changeover, so this is a **single-select** — picking
 * a set hands it the load and isolates the others. That is the operation the
 * design's diagram draws the outcome of (one isolator closed, one open) without
 * ever showing the control that causes it.
 *
 * ## What is enabled, and why
 *
 * Only a set that is already **turning** can be handed the load. The three refusals
 * are all real ones rather than UI caution:
 *
 * - a **stopped** set has to be started first, and that is a `START` command — one
 *   of the two buttons this prototype deliberately leaves inert;
 * - a **faulted** set is isolated by its own controller; closing onto it is not an
 *   operation the changeover can perform;
 * - an **unreachable** set cannot be commanded at all, and we do not know what its
 *   engine is doing.
 *
 * Each refused option says which of those it is, in a tooltip, rather than simply
 * refusing. On the site the design draws — one running set beside a faulted one —
 * *every* option but the current one is refused, and that is the honest answer:
 * there is nothing to transfer to.
 *
 * ## Why only the duty set carries a glyph
 *
 * The design gives the selected option a raised, taller chip with its run-state
 * glyph, and leaves the rest as plain dimmed text. That costs something worth
 * naming: a faulted option and a merely stopped one now look identical, where a red
 * triangle used to tell them apart at a glance. The reason moves entirely into the
 * tooltip — which is where the *specific* reason always lived, and which is now the
 * only place it lives.
 *
 * ## What it does and does not do
 *
 * Transferring is **modelled, not commanded**. It moves the load in the drawing and
 * in the site's draw figure, because that is what a changeover does and it is worth
 * being able to see. It does not start or stop an engine, and it does not pretend a
 * breaker moved in Johor — the same line this app's `START` and `STOP` hold.
 */
export const SiteChangeover = ({
  summary,
  dutyId,
  onDutyChange,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  onDutyChange: (dutyId: string) => void;
}) => (
  <div className="flex shrink-0 flex-col items-start gap-4 self-start">
    <p className="text-sm font-medium text-secondary">Load on</p>

    <div
      role="group"
      aria-label="Changeover — which genset carries the load"
      className="flex items-center gap-0 rounded-lg bg-element p-[3px]"
    >
      {summary.gensets.map(({genset}) => {
        const selected = genset.id === dutyId;
        const available = canTakeLoad(genset.runState);
        const meta = RUN_STATE_META[genset.runState];
        const Icon = meta.icon;

        const hint = selected
          ? `${genset.tag} is carrying the load`
          : available
            ? `Transfer the load to ${genset.tag}`
            : genset.runState === 'IDLE'
              ? `${genset.tag} is stopped — it has to be started before it can take the load`
              : genset.runState === 'FAULT'
                ? `${genset.tag} is faulted and isolated by its controller`
                : `${genset.tag} is not reporting — it cannot be commanded`;

        const inert = !available || selected;

        return (
          <Tooltip key={genset.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={selected}
                // `aria-disabled`, not `disabled`. A genuinely disabled control
                // receives no pointer events in Chrome or Safari, so its tooltip
                // never opens — and here the tooltip *is* the explanation of why the
                // option is refused, which is the most useful thing on the control.
                // This keeps it focusable and hoverable, and the handler below
                // refuses the press instead.
                aria-disabled={inert}
                onClick={() => {
                  if (inert) return;
                  onDutyChange(genset.id);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-[3px] focus-visible:ring-outline focus-visible:outline-none',
                  // The duty set gets the full height of the track; the rest are a
                  // shorter, quieter 28px, so which one is carrying the load is
                  // legible from the shape alone.
                  selected
                    ? 'h-12 border-subtle bg-highlight text-primary'
                    : available
                      ? 'h-7 cursor-pointer text-secondary hover:text-primary'
                      : 'h-7 cursor-not-allowed text-tertiary',
                )}
              >
                {/* Only on the duty set. An option nobody has selected is a name and
                    a tooltip; adding a glyph to each one made the track read as four
                    equal buttons rather than one live choice among alternatives. */}
                {selected && <Icon className={cn('size-3', meta.iconClassName)} aria-hidden="true" />}
                {genset.tag}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64">
              {hint}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  </div>
);
