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

export const serviceSearchSchema = z.object({
  tab: z.enum(SERVICE_TABS).default('due').catch('due'),
  q: z.string().optional().catch(undefined),
  /** A state, as `stateSlug` writes it — the gensets register's `location`. */
  location: z.string().optional().catch(undefined),
  standing: z.enum(SERVICE_STANDINGS).optional().catch(undefined),
});

export type ServiceSearch = z.infer<typeof serviceSearchSchema>;
