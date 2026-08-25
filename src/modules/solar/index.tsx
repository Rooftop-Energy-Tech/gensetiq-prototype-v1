import {Link, useNavigate} from '@tanstack/react-router';
import {InfoIcon, LayoutGridIcon, SearchIcon, SearchXIcon, TableIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import type {ReactNode} from 'react';

import {Button} from '@/components/ui/button';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {SolarYieldChart} from '@/modules/site/components/SolarYieldChart';
import {
  estateSolarMonths,
  hybridPlant,
  solarMonths,
  solarRecent,
  solarYear,
} from '@/modules/site/data/hybrid';
import type {SolarMonth, SolarYear} from '@/modules/site/data/hybrid';
import {useSiteSummaries} from '@/modules/site/data/sites';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {useSitePowerRoles} from '@/modules/site/data/siteConfig';
import type {SiteSummary} from '@/modules/site/data/sites';
import {siteSearch} from '@/modules/site/types/view.type';
import {SOLAR_CARD_THRESHOLD, SOLAR_PAGE, SOLAR_VIEWS} from './types/view.type';
import type {SolarSearch, SolarView} from './types/view.type';

/**
 * `/solar` — the portfolio's generation, and every array in it.
 *
 * ## Why this is its own screen
 *
 * `/energy` answers "what carried the load and what did the plant save", and the
 * arrays are one line of that answer. Generation asks a different set of
 * questions — is the portfolio making what it was bought on, which arrays are
 * not, and since when — and they need the room to be answered rather than a band
 * borrowed from a page about diesel. Splitting them also stops one screen
 * carrying two headline figures that move independently, which is the reliable
 * way to make a reader distrust both.
 *
 * ## The same generation is readable at three levels, on purpose
 *
 *  - **one array**, on its site's own page, where somebody who was sent to look
 *    at a site finds it without knowing this screen exists;
 *  - **the portfolio**, at the top of this page, which is the only figure a
 *    weekly report needs;
 *  - **array by array**, below it, which is where the portfolio figure's working
 *    lives.
 *
 * Every one of those reads `hybrid.ts`, so the three cannot disagree.
 *
 * ## Flexible at four arrays and at four hundred
 *
 * Nothing on this page is sized by the estate. The tiles are five. The portfolio
 * chart is one, whatever it sums. The array list has **two views** — cards with a
 * chart each, and a table — and opens in whichever suits the count, with the
 * choice always available. Cards page in blocks rather than rendering the whole
 * estate, and the search box narrows before either view has to.
 */

const PAGE_PADDING = 'flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-3 pb-24 md:pb-6';

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const kwh = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} GWh`;
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString('en-MY')} MWh`;
  return `${Math.round(value).toLocaleString('en-MY')} kWh`;
};

/**
 * One portfolio figure, in the tile grammar `/energy` and `/overview` share —
 * including its info glyph, which is not optional there and is not here.
 *
 * Every number on this page is **modelled against a design simulation** rather
 * than read off an instrument, and a modelled number a reader cannot interrogate
 * is one they will either believe too readily or dismiss. The glyph carries what
 * the figure was derived from, in the one place somebody wondering will look.
 */
const Tile = ({
  label,
  value,
  detail,
  note,
  tone,
}: {
  label: string;
  value: string;
  detail: ReactNode;
  /** How this figure was arrived at, for the info glyph beside its label. */
  note: ReactNode;
  /** `warning` is used by one tile only — see its own note at the call site. */
  tone?: 'warning';
}) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-md border border-subtle bg-element px-3 py-2.5">
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
  </div>
);

type ArrayRow = {
  summary: SiteSummary;
  kwp: number;
  months: Array<SolarMonth>;
  year: SolarYear;
  recent: SolarYear;
};

/** Under its P90 on the recent window — the test that makes a row a job. */
const isShort = (row: ArrayRow): boolean =>
  row.recent.actualKwh < row.recent.expectedKwh * 0.9;

const share = (year: SolarYear): number =>
  year.expectedKwh > 0 ? year.actualKwh / year.expectedKwh : 0;

/**
 * One array as a card: the twelve months, and the two figures that read it.
 *
 * The card links into the site rather than opening something here. Everything a
 * reader wants after seeing a short array — the plant, the battery, the genset
 * that has been covering for it, its runs — is on that page already, and a second
 * detail surface here would be a copy of it.
 */
const ArrayCard = ({row}: {row: ArrayRow}) => {
  const short = isShort(row);

  return (
    <Link
      to="/sites"
      search={siteSearch({id: row.summary.site.id, panel: true})}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-md border bg-element px-3 py-3 transition-colors outline-none',
        'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
        short ? 'border-severity-warning/40' : 'border-subtle',
      )}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-primary">
            {row.summary.site.name}
          </span>
          <span className="block truncate text-xs text-tertiary">
            {row.summary.site.locationLabel} · {row.kwp} kWp
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 text-sm tabular-nums',
            short ? 'text-severity-warning' : 'text-secondary',
          )}
        >
          {percent(share(row.recent))}
        </span>
      </div>

      <SolarYieldChart months={row.months} variant="compact" />

      <span className="truncate text-xs text-tertiary">
        {percent(share(row.year))} of design over twelve months
        {row.year.onsetLabel !== undefined && ` · stepped down in ${row.year.onsetLabel}`}
      </span>
    </Link>
  );
};

const COLUMNS = [
  {label: 'Site', width: '26%'},
  {label: 'Array', width: '12%'},
  {label: 'Generated', width: '14%'},
  {label: 'Design P50', width: '14%'},
  {label: 'Twelve months', width: '12%'},
  {label: 'Last three months', width: '16%'},
] as const;

/**
 * The same arrays as a table.
 *
 * Both yield columns are here and the recent one is last, which is the order a
 * reader works in: the annual figure is what gets reported and the recent figure
 * is what gets acted on, so the actionable one sits at the end of the row where
 * the eye stops.
 */
const ArrayTable = ({rows}: {rows: Array<ArrayRow>}) => (
  <div className="min-h-0 overflow-auto">
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <caption className="sr-only">
        Every array, its size, what it generated over twelve months and how that compares with
        its design
      </caption>
      <colgroup>
        {COLUMNS.map((column) => (
          <col key={column.label} style={{width: column.width}} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th
              key={column.label}
              scope="col"
              className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const short = isShort(row);

          return (
            <tr key={row.summary.site.id}>
              <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                <Link
                  to="/sites"
                  search={siteSearch({id: row.summary.site.id, panel: true})}
                  className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                >
                  {row.summary.site.name}
                </Link>
                <span className="block truncate text-xs text-tertiary">
                  {row.summary.site.locationLabel}
                </span>
              </td>
              <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                {row.kwp} kWp
              </td>
              <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                {kwh(row.year.actualKwh)}
              </td>
              <td className="h-13 truncate border-b border-subtle p-2 text-secondary tabular-nums">
                {kwh(row.year.expectedKwh)}
              </td>
              <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                {percent(share(row.year))}
                {row.year.onsetLabel !== undefined && (
                  <span className="block truncate text-xs text-tertiary">
                    stepped down in {row.year.onsetLabel}
                  </span>
                )}
              </td>
              <td
                className={cn(
                  'h-13 truncate border-b border-subtle p-2 tabular-nums',
                  short ? 'text-severity-warning' : 'text-primary',
                )}
              >
                {percent(share(row.recent))}
                <span className="block truncate text-xs text-tertiary">
                  {short ? 'under P90' : 'inside the band'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export const SolarPage = ({
  search,
  onSearchChange,
}: {
  search: SolarSearch;
  onSearchChange: (next: SolarSearch) => void;
}) => {
  const summaries = useSiteSummaries();
  const roles = useSitePowerRoles();
  const [now] = useState(() => Date.now());

  const rows: Array<ArrayRow> = useMemo(
    () =>
      summaries
        .map((summary) => {
          const seed = siteSeed(summary.site.id);
          if (seed === undefined) return null;
          const role = roles[summary.site.id] ?? seed.powerRole;
          const months = solarMonths(seed, role, now);
          if (months.length === 0) return null;
          return {
            summary,
            kwp: hybridPlant(seed, role).pvKwp,
            months,
            year: solarYear(months),
            recent: solarRecent(months),
          };
        })
        .filter((row): row is ArrayRow => row !== null)
        // Worst recent first. This page is read to find work, and an array inside
        // its band is not work — so the ones that are sit at the top whichever
        // view is showing, and the sort is not a column a reader has to discover.
        .sort((left, right) => share(left.recent) - share(right.recent)),
    [summaries, roles, now],
  );

  const estateMonths = useMemo(() => estateSolarMonths(roles, now), [roles, now]);
  const estateYear = useMemo(() => solarYear(estateMonths), [estateMonths]);
  const estateRecent = useMemo(() => solarRecent(estateMonths), [estateMonths]);

  const installedKwp = rows.reduce((sum, row) => sum + row.kwp, 0);
  const short = rows.filter(isShort);

  const query = search.q ?? '';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return rows;
    return rows.filter((row) =>
      [row.summary.site.name, row.summary.site.locationLabel].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [rows, query]);

  // The view the reader asked for, or the one the estate's size implies. See
  // `SOLAR_CARD_THRESHOLD` for why the count decides rather than a constant.
  const view: SolarView = search.view ?? (rows.length > SOLAR_CARD_THRESHOLD ? 'table' : 'cards');
  const shown = search.shown ?? SOLAR_PAGE;
  const paged = view === 'cards' ? filtered.slice(0, shown) : filtered;

  if (rows.length === 0) {
    return (
      <div className={PAGE_PADDING}>
        <p className="max-w-lg pt-6 text-sm text-secondary">
          No arrays are fitted on this estate. Sites configured as solar hybrid appear here with
          their generation against the design they were bought on.
        </p>
      </div>
    );
  }

  return (
    <div className={PAGE_PADDING}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-none font-semibold text-primary tabular-nums">
            {rows.length}
          </span>
          <span className="text-sm text-secondary">{rows.length === 1 ? 'array' : 'arrays'}</span>
        </p>
        <p className="text-sm text-secondary tabular-nums">
          {installedKwp.toLocaleString('en-MY')} kWp installed
        </p>
        <p className="text-sm text-secondary">
          {short.length === 0
            ? 'All inside their P90 band'
            : `${short.length} under design in the last three months`}
        </p>
      </header>

      <section aria-label="Twelve months" className="flex min-w-0 flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile
            label="Generated"
            value={kwh(estateYear.actualKwh)}
            detail="twelve closed months"
            note="What every array on the estate actually made, added together. The month still running is excluded: it has made part of a month against a whole month of design, and counting it would report a shortfall the size of the days left."
          />
          <Tile
            label="Design P50"
            value={kwh(estateYear.expectedKwh)}
            detail="the same twelve months"
            note="What the design simulations say those arrays should make in an average year, month by month. Fixed when each site was designed and never re-derived from what the array went on to do."
          />
          <Tile
            label="Yield against design"
            value={percent(share(estateYear))}
            detail="P90 band starts at 90%"
            note="Generated over design across the twelve months. A P50 is the average year, so an estate a few points either side of it is having ordinary weather; the P90 at 90% is where weather stops being the explanation."
          />
          <Tile
            label="Last three months"
            value={percent(share(estateRecent))}
            detail="where a fault shows"
            note="The same comparison over a shorter window. An array that stepped down in March is still inside its band for the year while being short every month since, so the recent window is what the array list is ranked on."
          />
          {/* The only tile on the page that takes a colour, and it takes it
              conditionally: a count of nothing wrong is not a warning, and a tile
              that is always amber stops meaning anything. */}
          <Tile
            label="Under design"
            value={String(short.length)}
            detail={short.length === 0 ? 'nothing needs a visit' : 'arrays below their P90'}
            note="Arrays under 90% of their design over the last three months. Every array is a point or two off its simulation in any year, so the P90 rather than the P50 is the line: ranking on the P50 would put the whole estate on a list headed as though something were wrong."
            tone={short.length > 0 ? 'warning' : undefined}
          />
        </div>
      </section>

      <section aria-label="Portfolio generation" className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Portfolio</h2>
          <p className="text-xs text-tertiary">
            Every array summed, against the P50 each was bought on. Monthly is the design's own
            resolution. The running month is hatched and counts towards nothing
          </p>
        </header>

        <div className="rounded-md border border-subtle bg-element px-3 py-3">
          <SolarYieldChart months={estateMonths} />
        </div>
      </section>

      <section aria-label="Arrays" className="flex min-h-0 min-w-0 flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-medium text-primary">Arrays</h2>
          {/* The card view's encoding needs explaining and the table's does not,
              so the line follows the view. A sentence about charts printed over a
              table is the reader's first evidence that the page is not paying
              attention. */}
          <p className="text-xs text-tertiary">
            {view === 'cards'
              ? 'Furthest under design first. Each card plots the month’s distance from its own design, so an array meeting its number is a flat line and a shortfall hangs below it. The percentage is the last three months'
              : 'Furthest under design first. The last three months is the window a fault shows in; the twelve-month figure is what gets reported'}
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <InputGroup className="w-full max-w-[373px]">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) =>
                onSearchChange({
                  ...search,
                  q: event.target.value === '' ? undefined : event.target.value,
                  // Back to the first page: a search that kept the reader's scroll
                  // depth would open a narrowed list already half revealed.
                  shown: undefined,
                })
              }
              placeholder="Site or place"
              aria-label="Search arrays"
            />
          </InputGroup>

          <div className="flex items-center gap-3">
            <p className="text-sm text-secondary tabular-nums">
              {filtered.length} of {rows.length} {rows.length === 1 ? 'array' : 'arrays'}
            </p>

            {/* The same segmented control the fleet and sites screens use for
                their own views, so a reader who has met one has met all three. */}
            <div
              role="radiogroup"
              aria-label="Array view"
              className="flex h-9 items-center gap-0 rounded-lg bg-element p-[3px]"
            >
              {SOLAR_VIEWS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={view === option}
                  aria-label={option === 'cards' ? 'Cards' : 'Table'}
                  onClick={() => onSearchChange({...search, view: option})}
                  className={cn(
                    'flex h-full items-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium transition-colors outline-none',
                    'focus-visible:ring-2 focus-visible:ring-outline',
                    view === option
                      ? 'border-subtle bg-highlight text-primary'
                      : 'text-secondary hover:text-primary',
                  )}
                >
                  {option === 'cards' ? (
                    <LayoutGridIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <TableIcon className="size-4" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
            <p className="text-sm text-secondary">No arrays match “{query}”.</p>
          </div>
        ) : view === 'table' ? (
          <ArrayTable rows={filtered} />
        ) : (
          <>
            {/* `auto-fill` rather than a fixed column count: the grid takes as
                many 20rem columns as the width allows, so one array fills the row
                at a narrow width and six sit across a wide one, with no
                breakpoint deciding it. */}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
              {paged.map((row) => (
                <ArrayCard key={row.summary.site.id} row={row} />
              ))}
            </div>

            {paged.length < filtered.length && (
              <div className="flex items-center justify-center pt-1">
                <Button
                  variant="secondary"
                  onClick={() => onSearchChange({...search, shown: shown + SOLAR_PAGE})}
                >
                  Show {Math.min(SOLAR_PAGE, filtered.length - paged.length)} more of{' '}
                  {filtered.length - paged.length}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

/** Route-level wrapper: the URL is the state, so the page only reads and writes it. */
export const SolarRoute = ({search}: {search: SolarSearch}) => {
  const navigate = useNavigate();

  return (
    <SolarPage
      search={search}
      onSearchChange={(next) => void navigate({to: '/solar', search: next, replace: true})}
    />
  );
};
