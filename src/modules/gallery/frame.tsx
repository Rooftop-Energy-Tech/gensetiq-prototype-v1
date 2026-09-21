import type {ReactNode} from 'react';

import {cn} from '@/lib/utils';

/**
 * The gallery's own furniture — the boxes the specimens sit in.
 *
 * Deliberately plain, and deliberately built from the app's own tokens rather
 * than from anything bespoke. A gallery drawn in colours the app does not use
 * would be the one screen where a wrong token could not be spotted, which is the
 * opposite of what it is for.
 */

export type SectionId = string;

/**
 * One band of the gallery — `Primitives`, `Alarms`, `Tokens`.
 *
 * The `id` is the scroll target the rail on the left links to, so it has to
 * match the entry in `SECTIONS`; both come from the same array in `index.tsx`
 * rather than being written twice.
 */
export const Section = ({
  id,
  title,
  blurb,
  children,
}: {
  id: SectionId;
  title: string;
  blurb: string;
  children: ReactNode;
}) => (
  <section id={id} className="flex scroll-mt-6 flex-col gap-4">
    <div className="flex flex-col gap-1 border-b border-subtle pb-3">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <p className="max-w-3xl text-sm text-secondary">{blurb}</p>
    </div>
    <div className="flex flex-col gap-5">{children}</div>
  </section>
);

/**
 * One component, with its name, where it is imported from, and the variants
 * worth looking at.
 *
 * `source` is the import path rather than a description, because the question a
 * reader arrives at the gallery with is usually *which file is this* — and a
 * path is the only answer that survives a rename of the thing beside it.
 *
 * `note` is for the one line that is not obvious from looking at the render: a
 * constraint, a gotcha, or the reason the component exists at all. The component
 * files themselves carry the long argument; repeating it here would guarantee the
 * two drift apart, so this stays to a sentence and the reader opens the file.
 */
export const Specimen = ({
  name,
  source,
  note,
  children,
}: {
  name: string;
  source: string;
  note?: string;
  children: ReactNode;
}) => (
  <article className="flex flex-col gap-3 rounded-md border border-subtle bg-element px-4 py-3.5">
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-sm font-semibold text-primary">{name}</h3>
        <code className="font-mono text-xs text-tertiary">{source}</code>
      </div>
      {note !== undefined && <p className="max-w-3xl text-xs text-secondary">{note}</p>}
    </header>
    {children}
  </article>
);

/**
 * The bench a specimen's variants are laid out on.
 *
 * `bg-canvas` rather than the card's own `bg-element`: several of these
 * components bring their own `element` surface, and on a matching background
 * they have no silhouette — the same argument `badge.tsx` makes for its
 * `element` variant. The bench is the page behind them, so what is drawn here is
 * what a reader would see on a real screen.
 */
export const Bench = ({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  /** Stack the variants instead of flowing them — for anything full-width. */
  wide?: boolean;
}) => (
  <div
    className={cn(
      'rounded-md border border-subtle bg-canvas p-4',
      wide ? 'flex flex-col gap-4' : 'flex flex-wrap items-end gap-x-6 gap-y-4',
      className,
    )}
  >
    {children}
  </div>
);

/**
 * A single variant on the bench, under the caption that says which one it is.
 *
 * The caption is what makes this a gallery rather than a page of shapes: three
 * badges side by side tell a reader nothing until each one is named for the prop
 * that produced it, so the label is the `variant="outline"` a reader would type.
 */
export const Variant = ({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex min-w-0 flex-col items-start gap-1.5', className)}>
    <span className="font-mono text-[11px] leading-4 text-tertiary">{label}</span>
    {children}
  </div>
);
