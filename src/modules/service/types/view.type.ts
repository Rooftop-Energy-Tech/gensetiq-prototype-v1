import {z} from 'zod';

/**
 * The fleet service page's URL: which tab, and what narrows it.
 *
 * Each is optional and unset means "all", as on the gensets register, so a bare
 * `/service` is the whole fleet on the Due tab and every filtered view is a link.
 */
export const SERVICE_TABS = ['due', 'history'] as const;
export type ServiceTab = (typeof SERVICE_TABS)[number];

/**
 * A set's standing against its schedule — the Service tab's three severities, plus
 * the case they cannot express: a set with no service on record, which has no
 * counters to be due on and still needs its first visit.
 */
export const SERVICE_STANDINGS = ['overdue', 'due-soon', 'ok', 'never'] as const;
export type ServiceStanding = (typeof SERVICE_STANDINGS)[number];

/**
 * How the Due table is ordered — the gensets register's sortable headers, over service
 * standing. `standing` is the default and the page's own ranking: worst first.
 */
export const SERVICE_SORTS = ['standing', 'name', 'location', 'due', 'hours', 'time', 'last'] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

export const SERVICE_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type ServiceSortDirection = (typeof SERVICE_SORT_DIRECTIONS)[number];

/**
 * Which way each key runs when first picked: the end a workshop lead wants on top.
 * Soonest due, furthest through each interval, and the longest since a visit.
 */
export const SERVICE_SORT_DEFAULT_DIRECTION: Record<ServiceSort, ServiceSortDirection> = {
  standing: 'asc',
  name: 'asc',
  location: 'asc',
  due: 'desc',
  hours: 'desc',
  time: 'desc',
  last: 'asc',
};

/**
 * How the History table is ordered (Jeff, 2026-10-05) — the Due table's sortable
 * headers, over the log. `date` is the default: newest first, the order the log has
 * always had. `Report` is a link, not a value, and does not sort.
 *
 * Its own `hsort` / `hdir` params rather than the Due table's `sort` / `dir`: the two
 * tables share no key, so one param would have to be thrown away on every tab switch;
 * apart, each tab keeps its order while the other is open.
 */
export const SERVICE_HISTORY_SORTS = ['name', 'date', 'technician', 'hours'] as const;
export type ServiceHistorySort = (typeof SERVICE_HISTORY_SORTS)[number];

/** The History table's unset sort — `hsort` absent means this. */
export const SERVICE_HISTORY_DEFAULT_SORT: ServiceHistorySort = 'date';

/** Text A→Z; the latest visit and the highest meter reading on top. */
export const SERVICE_HISTORY_SORT_DEFAULT_DIRECTION: Record<ServiceHistorySort, ServiceSortDirection> = {
  name: 'asc',
  date: 'desc',
  technician: 'asc',
  hours: 'desc',
};

/** Rows per table page (2026-09-30) — `GENSET_PAGE_SIZE`, for the same reason. */
export const SERVICE_PAGE_SIZE = 20;

export const serviceSearchSchema = z.object({
  tab: z.enum(SERVICE_TABS).default('due').catch('due'),
  q: z.string().optional().catch(undefined),
  /** A state, as `stateSlug` writes it — the gensets register's `location`. */
  location: z.string().optional().catch(undefined),
  standing: z.enum(SERVICE_STANDINGS).optional().catch(undefined),
  sort: z.enum(SERVICE_SORTS).default('standing').catch('standing'),
  dir: z.enum(SERVICE_SORT_DIRECTIONS).optional().catch(undefined),
  /**
   * The History table's `sort` / `dir`. Optional rather than defaulted, so the Due tab's
   * links do not carry a History key; a key that is not a History one falls back to
   * `SERVICE_HISTORY_DEFAULT_SORT`.
   */
  hsort: z.enum(SERVICE_HISTORY_SORTS).optional().catch(undefined),
  hdir: z.enum(SERVICE_SORT_DIRECTIONS).optional().catch(undefined),
  /** The table's page, 1-based — the gensets schema's `page`, for its reasons. Both tabs share it. */
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export type ServiceSearch = z.infer<typeof serviceSearchSchema>;
