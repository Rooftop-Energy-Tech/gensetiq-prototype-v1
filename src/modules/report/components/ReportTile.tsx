import {Link} from '@tanstack/react-router';
import {InfoIcon} from 'lucide-react';
import type {LinkProps} from '@tanstack/react-router';
import type {ReactNode} from 'react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';

/**
 * One headline figure, in the grammar all three report tabs share.
 *
 * It was written twice — once on the page that is now `Overall`, once on `Solar`
 * — and the second copy was already carrying a tone the first did not have while
 * the first carried a link the second did not. Two near-identical tiles is what a
 * shared component costs; three, on tabs a reader moves between in one sitting,
 * is a drift the reader would see. So the copies were merged when the reports
 * were consolidated, and the union of what they each grew is what this takes.
 *
 * ## Every figure explains itself
 *
 * `note` is not optional and there is no tile without one. These pages are the
 * only screens in the app whose numbers are **modelled** rather than read off an
 * instrument, and a modelled number a reader cannot interrogate is one they will
 * either believe too readily or dismiss. The glyph carries what it was derived
 * from, in the one place somebody wondering will look.
 *
 * ## Colour is withheld unless the figure is a verdict
 *
 * Most of these are quantities — hours, litres, kilowatt-hours — and a coloured
 * number would rank what is only a tally. `tone` exists for the handful that are
 * genuinely a judgement: diesel that left a tank without reaching an engine is
 * not a quantity anybody is neutral about.
 */
export const ReportTile = ({
  label,
  value,
  detail,
  note,
  tone,
  to,
  search,
}: {
  label: string;
  value: string;
  detail: ReactNode;
  /** How this figure was arrived at, for the info glyph beside its label. */
  note: ReactNode;
  /** Reserved for figures that are a verdict rather than a tally — see above. */
  tone?: 'warning';
  /** Where the figure's working lives, when it is not on this page. */
  to?: LinkProps['to'];
  /** View state for `to`, where the destination validates its search params. */
  search?: LinkProps['search'];
}) => (
  <TileShell to={to} search={search}>
    <span className="flex items-center gap-1.5">
      <span className="truncate text-xs font-medium text-secondary">{label}</span>
      <Tooltip>
        <TooltipTrigger className="shrink-0 cursor-help text-tertiary hover:text-primary">
          <InfoIcon className="size-3" aria-hidden="true" />
          <span className="sr-only">How {label} is worked out</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          {note}
        </TooltipContent>
      </Tooltip>
    </span>
    <span
      className={cn(
        'text-2xl leading-none font-semibold tabular-nums',
        tone === 'warning' ? 'text-severity-warning' : 'text-primary',
      )}
    >
      {value}
    </span>
    <span className="truncate text-xs text-secondary">{detail}</span>
  </TileShell>
);

/** The box the tile is drawn in — shared so the two shapes cannot diverge. */
const BOX = 'flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5';

/**
 * The tile's box, as a link where the figure has a screen behind it and a plain
 * div where it does not.
 *
 * Split out rather than branched inline because the two have to be visually
 * identical: a tile that grew a border or a shade because it happened to be
 * clickable would say the figure was more important than its neighbours, which is
 * not what a link means. The only difference is the hover and focus treatment,
 * which is a property of the control rather than of the number.
 */
const TileShell = ({
  to,
  search,
  children,
}: {
  to?: LinkProps['to'];
  search?: LinkProps['search'];
  children: ReactNode;
}) =>
  to === undefined ? (
    <div className={BOX}>{children}</div>
  ) : (
    <Link
      to={to}
      search={search}
      className={cn(
        BOX,
        'transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
      )}
    >
      {children}
    </Link>
  );

/**
 * A column heading with the same glyph, for the table columns that are derived
 * too.
 *
 * Beside the tile rather than in its own file because it is the same promise: a
 * number this page worked out says where it came from, whether it is in a tile or
 * at the top of a column.
 */
export const ReportColumnHead = ({label, note}: {label: string; note?: ReactNode}) => (
  <span className="flex items-center gap-1.5">
    {label}
    {note !== undefined && (
      <Tooltip>
        <TooltipTrigger className="shrink-0 cursor-help text-tertiary hover:text-primary">
          <InfoIcon className="size-3" aria-hidden="true" />
          <span className="sr-only">How {label} is worked out</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          {note}
        </TooltipContent>
      </Tooltip>
    )}
  </span>
);
