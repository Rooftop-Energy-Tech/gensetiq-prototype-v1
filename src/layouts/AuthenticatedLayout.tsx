import {Outlet} from '@tanstack/react-router';

import {MobileNav} from '@/components/global/MobileNav';
import {Sidebar} from '@/components/global/Sidebar';
import {TopNav} from '@/components/global/TopNav';

/**
 * The app shell. One column on a phone, sidebar + content from `md` up.
 *
 * `grid-rows-[minmax(0,1fr)]` rather than the implicit `auto` row: it pins the row
 * to the viewport with a zero minimum, so `h-full`/`min-h-0` inside each column
 * resolves against a known height instead of collapsing to content — which is what
 * lets the map and the table scroll internally.
 *
 * Below `md` the sidebar is dropped for the floating bar and the content column
 * loses its inset corner. The corner and the two-pixel rules are what make the
 * content read as a panel inset into the sidebar's surface; with no sidebar behind
 * it there is nothing to be inset *from*, and the rounded edge over a full-bleed
 * screen just clips the first row of the list.
 */
export const AuthenticatedLayout = () => {
  return (
    <div className="grid h-screen w-screen grid-cols-[1fr] grid-rows-[minmax(0,1fr)] overflow-hidden bg-sidebar md:grid-cols-[auto_1fr]">
      <Sidebar />
      <div className="flex min-h-0 flex-col overflow-hidden bg-canvas md:rounded-tl-lg md:border-t-2 md:border-l-2 md:border-subtle">
        <TopNav />
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
};
