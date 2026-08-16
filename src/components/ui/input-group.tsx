import type * as React from 'react';

import {cn} from '@/lib/utils';

/**
 * An input with inline addons either side of it — the toolbar's search field is
 * the one instance (leading magnifier, trailing ⌘K hint).
 *
 * The border and focus ring live on the *group*, not the inner `<input>`, so the
 * addons sit inside the same focus outline. That's why this doesn't just wrap
 * `<Input>`: it would double the border.
 */
function InputGroup({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'flex h-9 items-center gap-2 rounded-md border border-subtle bg-element px-3 py-1 shadow-xs transition-[color,box-shadow]',
        'focus-within:border-brand focus-within:ring-[1px] focus-within:ring-brand',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex shrink-0 items-center justify-center text-secondary [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({className, ...props}: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input-group-input"
      className={cn(
        'min-w-0 flex-1 bg-transparent text-sm text-primary outline-none selection:bg-fill selection:text-fill-text placeholder:text-tertiary',
        className,
      )}
      {...props}
    />
  );
}

export {InputGroup, InputGroupAddon, InputGroupInput};
