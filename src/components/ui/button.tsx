import {cva} from 'class-variance-authority';
import type {VariantProps} from 'class-variance-authority';
import {Slot} from 'radix-ui';
import type * as React from 'react';

import {cn} from '@/lib/utils';

const buttonVariants = cva(
  "relative isolate cursor-pointer inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-outline focus-visible:ring-[3px] focus-visible:ring-outline disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:content-[''] hover:after:bg-button-hover",
  {
    variants: {
      variant: {
        // The brand button's hover overlay is white in BOTH modes, because
        // `brand` itself does not change between modes — so it needs
        // `brand-button-hover`, not the base's `button-hover` (which is the
        // primary button's, and darkens in dark mode). `cn`'s twMerge keeps the
        // variant's utility over the base's.
        default:
          'bg-brand text-brand-text shadow-xs hover:after:bg-brand-button-hover',
        primary: 'bg-primary-button text-primary-button-text shadow-xs',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive-hover focus-visible:ring-destructive/20',
        outline: 'border border-default bg-element text-primary shadow-xs hover:bg-highlight',
        secondary: 'bg-element text-primary hover:bg-highlight',
        ghost: 'text-primary hover:bg-hover',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({variant, size, className}))}
      {...props}
    />
  );
}

export {Button, buttonVariants};
