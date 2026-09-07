import {useId, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {ArrowUpRightIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {
  CardNote,
  CountChip,
  Headline,
  SUMMARY_CARD_BOX,
  SUMMARY_CARD_LINK,
  SummaryCard,
  SummaryCardLabel,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {STATUS_META} from '@/modules/genset/data/fleetStatus';
import {gensetSearch} from '@/modules/genset/types/view.type';
import {solarSearch} from '@/modules/solar/types/register.type';
import type {EstateSummary} from '../data/estateSummary';
import type {SiteSearch} from '../types/view.type';

/**
 * The estate's summary strip: **one row, four cards, and none of them a grouping.**
 *
 * It began as the fleet strip counting yards instead of machines — the same four
 * groupings in the same order — and it is no longer that, because the two screens
 * ask different things. The fleet strip is four ways of slicing the fleet. This one
 * has to say what the estate *is* before it offers to narrow it, and that is what
 * these four do: how many sites, what needs doing to them, what is due, and how the
 * hybrid programme is going.
 *
 * ## What moved out, and what stayed
 *
 * `Supply`, the region grouping and `Programme` are now dropdowns in the toolbar —
 * see `FilterSelect` for the argument, and `SitesToolbar` for where they sit. They
 * were three cards' width spent on attributes a reader either wants or does not, and
 * they were what pushed this strip onto two rows.
 *
 * **`Status` stayed a card**, and the asymmetry is deliberate: the four buckets are
 * the estate's readiness, which is the question this screen exists to answer. Their
 * *distribution* is the information — thirteen alarms beside nine clear is a fact you
 * read at a glance — and a dropdown would put it behind a click. It still filters,
 * the same chips as before; it just also has to be visible.
 *
 * ## The two cards that came off the overview
 *
 * `/overview` is gone, and it had two figures nothing else in the app states:
 * **Due for service** and **Solar share**. They land here rather than on `/gensets`
 * or `/solar` because this is the screen that already counts the whole estate, so a
 * reader meets them where they are already reading totals.
 *
 * They differ from the two beside them in one way that had to stay visible: those
 * **filter this list** and these **lead somewhere else**. A count that narrows the
 * table and a count that navigates away must not look like the same control, so
 * these are anchors, the whole card is the target, and each carries the arrow every
 * other way-out in this app carries.
 *
 * The overview's other bands are **not** carried over, and none of them is lost. Its
 * four readiness buckets are the `Status` card's four chips, its region directory is
 * the toolbar's grouping dropdown, and its map is the map this screen has always had
 * beside the list.
 */

type SitesSummaryCardsProps = {
  summary: EstateSummary;
  /** Rows the list is showing, once search and chips are applied. */
  showing: number;
  /**
   * Machines past one of their two service intervals, and the yards they stand in.
   *
   * The headline is the **plant**, where every other card here counts sites, and the
   * asymmetry is the point: a service is booked against a machine, on that machine's
   * own hour meter and its own interval, so two sets due at one site is two jobs
   * whoever happens to drive there. The site count moves to the detail line.
   */
  serviceDue: {gensetCount: number; siteCount: number};
  /** Solar's share of off-grid generation over thirty days, and the kWh behind it. */
  solar: {share: number; kwh: number};
  search: SiteSearch;
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

/**
 * A card whose figure is a way out rather than a filter.
 *
 * Same box as `SummaryCard` — see `SUMMARY_CARD_BOX` — with the hover and focus
 * treatment of a target, and an arrow hard right in the heading. The arrow is the
 * only mark separating these from the cards below, and one mark is enough: it is the
 * same arrow every other way-out in this app carries.
 *
 * **The overview's leading icons did not come with them.** A wrench and a sun were
 * how those tiles were found in a grid of six near-identical boxes; here every card
 * is already headed by its own name, so they are decoration — and at 375px a two-up
 * card is 141px wide, which is not enough for a glyph, `DUE FOR SERVICE` and an
 * arrow. Dropping them is what lets the label read in full.
 */
const LinkCard = ({
  label,
  children,
  ...link
}: {
  label: string;
  children: React.ReactNode;
} & (
  | {to: '/solar'; search: ReturnType<typeof solarSearch>}
  | {to: '/gensets'; search: ReturnType<typeof gensetSearch>}
)) => (
  <Link {...link} aria-label={label} className={cn(SUMMARY_CARD_BOX, SUMMARY_CARD_LINK)}>
    <SummaryCardLabel>
      <span className="truncate">{label}</span>
      {/* Hard right, so both arrows sit on the same edge as each other and as the
          card's own border, rather than wandering with the label's length. */}
      <ArrowUpRightIcon className="ml-auto size-3 shrink-0 text-tertiary" aria-hidden="true" />
    </SummaryCardLabel>
    {children}
  </Link>
);

export const SitesSummaryCards = ({
  summary,
  showing,
  serviceDue,
  solar,
  search,
  onSearchChange,
}: SitesSummaryCardsProps) => {
  const filtered = showing !== summary.total;

  /**
   * Folded away, at phone width only — the fleet screen's control, for the same
   * reason and on the same terms.
   *
   * Four cards stacked two-up are most of a 375px viewport before the list starts.
   * Local state rather than a search param, because the reader's device decides the
   * presentation and a `?cards=closed` followed onto a desktop would name a state
   * that width cannot undo — see `GensetsSummaryCards` for the argument in full.
   *
   * It folds the **summary**, not the filtering, which is why the button says so.
   * Three of the four cards here cannot be filtered by at all now, and the three
   * that could have moved to the toolbar, where they stay visible at every width.
   */
  const [collapsed, setCollapsed] = useState(false);

  // `status`, and only `status`. The other three filters live in the toolbar and are
  // never folded away, so reporting them on this button would name state the reader
  // can already see; `q` has its own visible field for the same reason.
  const activeCount = search.status === undefined ? 0 : 1;

  // Generated rather than a written constant: `aria-controls` has to resolve to a
  // unique node, and `SummaryCardRow` is shared with the fleet screen.
  const cardsId = useId();

  return (
    <div className="flex flex-col gap-3">
      {/* Four narrow cards and nothing wrapping, so they share the row evenly —
          see `columnTemplate`. */}
      <SummaryCardRow id={cardsId} collapsed={collapsed} cappedColumns={4}>
        <SummaryCard label="Sites">
          <Headline
            value={summary.total}
            unit={summary.total === 1 ? 'site' : 'sites'}
            detail={
              filtered
                ? `Showing ${showing}`
                : `${summary.gensetCount} ${summary.gensetCount === 1 ? 'genset' : 'gensets'} standing`
            }
          />
          {filtered && <CardNote>{summary.gensetCount} gensets in total</CardNote>}
        </SummaryCard>

        {/* The one grouping that kept its card — see the note at the head of this
            file. Its chips are unchanged: click `Low fuel` and the list and the map
            both narrow. */}
        <SummaryCard label="Status">
          <div className="flex flex-col gap-0.5">
            {summary.byStatus.map((tally) => (
              <CountChip
                key={tally.key}
                label={tally.label}
                count={tally.count}
                tone={STATUS_META[tally.key].tone}
                active={search.status === tally.key}
                onToggle={(next) => onSearchChange({status: next ? tally.key : undefined})}
                title={STATUS_META[tally.key].detail}
                block
              />
            ))}
          </div>
        </SummaryCard>

        <LinkCard label="Due for service" to="/gensets" search={gensetSearch({service: 'due'})}>
          <Headline
            value={serviceDue.gensetCount}
            unit={serviceDue.gensetCount === 1 ? 'genset' : 'gensets'}
            detail={
              serviceDue.gensetCount === 0
                ? 'nothing booked in'
                : `at ${serviceDue.siteCount} ${serviceDue.siteCount === 1 ? 'site' : 'sites'}`
            }
          />
        </LinkCard>

        {/* To the array register, which is where this figure is accounted for system
            by system — the same destination the overview's tile had. */}
        <LinkCard label="Solar share" to="/solar" search={solarSearch()}>
          {/* No unit beside the figure: `23%` carries its own, and `of generation`
              beside it truncated at phone width for no gain — the label already says
              this is a share. The detail line carries the kWh behind it and the
              window both figures are measured over. */}
          <Headline
            value={`${Math.round(solar.share * 100)}%`}
            detail={`${Math.round(solar.kwh).toLocaleString('en-MY')} kWh over 30 days`}
          />
        </LinkCard>
      </SummaryCardRow>

      <SummaryCollapseButton
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        activeCount={activeCount}
        controls={cardsId}
        noun="summary"
      />
    </div>
  );
};
