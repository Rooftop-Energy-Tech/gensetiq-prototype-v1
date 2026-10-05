import {SummaryCard} from '@/components/global/SummaryCards';
import {figure} from './format';

/**
 * A period's fuel in two figures and what is left: `Fuel In`, `Fuel Out`, then
 * `Balance` ruled off under them (Jeff, 2026-10-01; `In` and `Out` until 2026-10-05,
 * now the depot tile's names for the same two rows). On `/fuel` it sums every yard;
 * on a depot's page it is that one yard, where `Balance` is litres only since the
 * tank card beside it carries the percentage.
 *
 * Titled `Fuel balance`, for the line it ends on, with the period once, in the
 * card's corner pill, not on each line. It was `Days of stock` on `/fuel` until then.
 */
export const FuelBalanceCard = ({
  fuelIn,
  fuelOut,
  balance,
  balanceNote,
  periodLabel,
}: {
  fuelIn: number;
  fuelOut: number;
  balance: number;
  /** The line beside `Balance` — `left in all depots, 78% full`. */
  balanceNote: string;
  periodLabel: string;
}) => (
  <SummaryCard label="Fuel balance" pill={periodLabel}>
    {/* Three columns — label, figure, note — so the three figures sit in one
      right-aligned column and their digits line up (Jeff, 2026-10-01), with
      a wider gap after the labels than a two-column row gave them. `Balance`
      is set at `Headline`'s size, the card's one headline figure, and `In`
      and `Out` a step under it; every `L` is `Headline`'s unit, small and grey
      (2026-10-05). As wide as its longest line, not the card, so the rule ends
      where the words do. */}
    <dl className="grid w-fit max-w-full grid-cols-[auto_auto_minmax(0,auto)] items-baseline gap-x-5 gap-y-1">
      <dt className="text-sm font-medium text-severity-ok">Fuel In</dt>
      <dd className="text-right text-lg leading-tight font-semibold text-primary tabular-nums">
        {figure(Math.round(fuelIn))}
        <span className="text-sm font-normal text-secondary"> L</span>
      </dd>
      <dd className="truncate text-xs text-secondary">from suppliers</dd>
      <dt className="text-sm font-medium text-severity-critical">Fuel Out</dt>
      <dd className="text-right text-lg leading-tight font-semibold text-primary tabular-nums">
        {figure(Math.round(fuelOut))}
        <span className="text-sm font-normal text-secondary"> L</span>
      </dd>
      <dd className="truncate text-xs text-secondary">to mobile gensets and fuel trucks</dd>
      {/* What is in the tanks now, ruled off under the period's movement
            as a balance is (Jeff, 2026-10-01). The rule is its own element
            across every column: a border on each cell sat at two heights,
            since the row aligns the label and the figure on their baseline. */}
      <div className="col-span-3 my-0.5 border-t border-subtle" aria-hidden="true" />
      <dt className="text-sm font-medium text-secondary">Balance</dt>
      <dd className="text-right text-2xl leading-none font-semibold text-primary tabular-nums">
        {figure(Math.round(balance))}
        <span className="text-sm font-normal text-secondary"> L</span>
      </dd>
      <dd className="truncate text-xs text-secondary">{balanceNote}</dd>
    </dl>
  </SummaryCard>
);
