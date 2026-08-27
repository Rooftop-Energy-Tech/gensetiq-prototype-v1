import {Link, Outlet} from '@tanstack/react-router';
import type {LinkProps} from '@tanstack/react-router';
import type {ReactNode} from 'react';

/**
 * A top-level section with tabs across the top, and an `<Outlet />` under them.
 *
 * The same strip `GensetDetailShell` puts over one machine, lifted to a whole
 * destination. It is shared rather than written twice because `/solar` and
 * `/battery` are the same shape — a title, a subtitle, six tabs — over two sets of
 * plant, and the thing that differs between them is entirely in the tab list.
 *
 * ## Why these sections are tabbed at all, when Gensets is not
 *
 * `/gensets` is a register: a list of machines, and the tabs live one level down
 * on each machine. These two are scaffolds for pages that have not been designed
 * yet, and the tab strip is the part of the design that *is* decided — Home,
 * Analysis, Service, Alarms, Equipment, Settings, the same six a genset has minus
 * the two (Runs, Refuel) that are facts about an engine. Standing the strip up
 * first means each page can be planned in the place it will actually live.
 *
 * Every tab is empty on purpose. See the route files for what each one is for.
 */
export type SectionTab = {
  label: string;
  to: LinkProps['to'];
  /** The section's landing tab — matched exactly, or it stays lit on every child. */
  end?: boolean;
};

type SectionTabsProps = {
  title: string;
  /** The line under the title: what this section counts, in a phrase. */
  subtitle?: ReactNode;
  tabs: ReadonlyArray<SectionTab>;
  /** For `aria-label` on the strip — "Solar sections". */
  ariaLabel: string;
};

export const SectionTabs = ({title, subtitle, tabs, ariaLabel}: SectionTabsProps) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2">
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <h1 className="max-w-full truncate text-base font-medium text-primary">{title}</h1>
        {subtitle !== undefined && (
          <p className="max-w-full truncate text-sm text-secondary">{subtitle}</p>
        )}
      </div>

      {/* Hidden below `md`, the rule the genset shell and the bottom nav both
          follow: none of these tabs has a phone layout yet, and offering a door
          the app cannot open properly is worse than not offering it. The routes
          still resolve if one is typed. */}
      <div className="hidden items-center gap-5 md:flex">
        <nav
          aria-label={ariaLabel}
          className="flex h-9 items-center gap-0 rounded-lg bg-element p-[3px]"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              activeOptions={{exact: tab.end ?? false, includeSearch: false}}
              className="flex h-full items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:text-primary data-[status=active]:border-subtle data-[status=active]:bg-highlight data-[status=active]:text-primary"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>

    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Outlet />
    </div>
  </div>
);
