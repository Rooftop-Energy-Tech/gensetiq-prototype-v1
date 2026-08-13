import {Outlet} from '@tanstack/react-router';

import {Sidebar} from '@/components/global/Sidebar';
import {TopNav} from '@/components/global/TopNav';

export const AuthenticatedLayout = () => {
  return (
    // `grid-rows-[minmax(0,1fr)]` rather than the implicit `auto` row: it pins
    // the row to the viewport with a zero minimum, so `h-full`/`min-h-0` inside
    // each column resolves against a known height instead of collapsing to
    // content — which is what lets the map and the table scroll internally.
    <div className="grid h-screen w-screen grid-cols-[auto_1fr] grid-rows-[minmax(0,1fr)] overflow-hidden bg-sidebar">
      <Sidebar />
      <div className="flex min-h-0 flex-col overflow-hidden rounded-tl-lg border-t-2 border-l-2 border-subtle bg-canvas">
        <TopNav />
        <Outlet />
      </div>
    </div>
  );
};
