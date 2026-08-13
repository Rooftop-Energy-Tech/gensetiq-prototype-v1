import type * as React from 'react';

import {cn} from '@/lib/utils';

function Input({className, type, ...props}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-default bg-element px-3 py-1 text-sm text-primary shadow-xs transition-[color,box-shadow] outline-none',
        'selection:bg-fill selection:text-fill-text placeholder:text-secondary',
        'focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export {Input};
