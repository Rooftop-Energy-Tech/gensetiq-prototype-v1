import {Link, useMatches, useRouter} from '@tanstack/react-router';
import {ArrowLeftIcon, ChevronRightIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';

type Crumb = {label: string; to?: string};

/**
 * The breadcrumb trail, deepest match wins.
 *
 * A route names its own label instead of the layout keeping a path → title map
 * that drifts. Two ways to name it, because two kinds of route need it:
 *
 *   - `staticData.crumb` for a fixed label ("Gensets", "Refuel");
 *   - `crumb` on the route's **loader data** when the label depends on the params,
 *     which is how `/gensets/brf9540` reads `BRF9540 | Cummins 1000 kVa`.
 *
 * `staticData.crumbParent` adds one ancestor in front. The genset detail route is
 * a *sibling* of `/gensets` rather than a child — it has to be, or it would try to
 * render inside a screen with no `<Outlet />` — so the match chain does not contain
 * the fleet screen and cannot supply "Gensets" on its own.
 */
const useCrumbs = (): Array<Crumb> => {
  const matches = useMatches();

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const dynamic = (match.loaderData as {crumb?: string} | undefined)?.crumb;
    const label = dynamic ?? match.staticData.crumb;
    if (label === undefined) continue;

    const parent = match.staticData.crumbParent;
    return parent === undefined ? [{label}] : [{label: parent.label, to: parent.to}, {label}];
  }

  return [{label: 'GensetIQ'}];
};

export const TopNav = () => {
  const router = useRouter();
  const crumbs = useCrumbs();

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-default pr-4 pl-3">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={() => router.history.back()}
        aria-label="Go back"
      >
        <ArrowLeftIcon aria-hidden="true" />
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2">
        {crumbs.map((crumb, index) => (
          <span key={crumb.label} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <ChevronRightIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            )}
            {crumb.to === undefined ? (
              <span className="truncate text-sm font-medium text-primary">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.to}
                className="truncate text-sm font-medium text-secondary transition-colors hover:text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
};
