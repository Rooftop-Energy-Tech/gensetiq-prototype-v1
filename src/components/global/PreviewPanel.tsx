import type {ReactNode} from 'react';

import {cn} from '@/lib/utils';

/**
 * The 393px preview that floats over a register's map — the box, the placeholder and
 * the label column, shared.
 *
 * ## Why this one is shared
 *
 * `GensetDetailPanel` and `SiteDetailPanel` each declare their own `DetailRow`, and
 * the second one's comment is the whole argument for stopping: *"122px matches the
 * fleet panel's label column, so the two previews line up their values at the same
 * place."* That is a measurement held in step by a comment, and the solar and battery
 * registers would have made it four. So the **shape** lives here and each module
 * supplies its rows, which is exactly the split `SummaryCards` already makes.
 *
 * What is not shared is the way out of the panel. The arrow is a typed router `Link`,
 * and a shared component cannot know a module's routes without every module
 * depending on it sideways — so the caller builds the link and passes it as `action`.
 *
 * As with `PlantMap`, the two existing panels are left alone: they carry rows and
 * badges this knows nothing about, and rewriting two working previews is not the
 * price of standing up two new ones.
 */

/**
 * One label-and-value line.
 *
 * 122px is the design's label column, and it is what keeps every value on the panel
 * flush with the ones above it.
 */
export const PreviewRow = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-center gap-px">
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">
      {label}
    </dt>
    <dd className="flex min-w-0 flex-1 items-center truncate text-primary">{children}</dd>
  </div>
);

type PreviewPanelProps = {
  /** The panel's accessible name — `Solar system details`. */
  label: string;
  /**
   * The selected thing's name, or `undefined` for nothing selected — in which case
   * the panel is the placeholder and `children` are not drawn.
   *
   * The empty state is the panel's, not the caller's, because it is the state a
   * reader is in on arrival with the toggle switched on: 393px that has to say what
   * it is waiting for rather than sitting blank.
   */
  heading: string | undefined;
  /** What to say while nothing is selected — `Select a system to see its details.` */
  emptyMessage: string;
  /**
   * The way out of the preview — the caller's own typed `Link`, in a button.
   *
   * Over the map this is the *only* way into the thing's own pages: a map pin has
   * nowhere to put a link, and clicking one has to keep you on the map or the
   * selection is useless.
   */
  action?: ReactNode;
  /** The rows — a `<dl>` of `PreviewRow`s. */
  children?: ReactNode;
  className?: string;
};

export const PreviewPanel = ({
  label,
  heading,
  emptyMessage,
  action,
  children,
  className,
}: PreviewPanelProps) => (
  <aside
    aria-label={label}
    className={cn(
      'flex flex-col gap-3 overflow-y-auto rounded-md border border-default bg-overlay px-4 py-3 text-sm',
      className,
    )}
  >
    {heading === undefined ? (
      <p className="my-auto px-2 text-center text-secondary">{emptyMessage}</p>
    ) : (
      <>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate font-medium text-primary">{heading}</h2>
          {action}
        </div>
        <dl className="flex flex-col">{children}</dl>
      </>
    )}
  </aside>
);
