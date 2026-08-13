import {cva} from 'class-variance-authority';
import type {VariantProps} from 'class-variance-authority';
import {Slot} from 'radix-ui';
import type * as React from 'react';

import {cn} from '@/lib/utils';

/**
 * Figma's badge sits on `deprecated-base/secondary` (#222934) — a token the
 * design system itself flags as on the way out. It maps to `bg-inset` (#202632)
 * here, which is the live token for "a tier raised above `element`". The two are
 * a hair apart and the swap keeps the badge on the real scale.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-1 font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3 [&>svg:not([class*='text-'])]:text-current",
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-text',
        secondary: 'bg-inset text-primary',
        outline: 'border-default text-primary',
        /**
         * A badge that sits *on* the canvas rather than inside a card: it brings
         * its own `element` surface and a visible edge. The genset home page's
         * severity and tag chips are all this variant — over `bg-canvas` a
         * borderless `secondary` badge has no silhouette at all.
         */
        element: 'border-default bg-element text-primary',
      },
      size: {
        /** 24px — the table and detail-panel pill. */
        sm: 'text-xs',
        /** 28px — the chip row on the genset home page, at body size. */
        md: 'py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'sm',
    },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & {asChild?: boolean}) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({variant, size}), className)}
      {...props}
    />
  );
}

export {Badge, badgeVariants};
