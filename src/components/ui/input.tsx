import type * as React from 'react';

import {cn} from '@/lib/utils';

function Input({className, type, ...props}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-default bg-element px-3 py-1 text-sm text-primary shadow-xs transition-[color,box-shadow] outline-none',
        'selection:bg-fill selection:text-fill-text placeholder:text-tertiary',
        // No spinner on `type="number"`. The stepper arrows are a browser default
        // that fights every field it appears on here: they eat the right-hand
        // padding, they only ever move by `step`, and the numbers typed into
        // these inputs — an hour-meter reading, a service interval — are read off
        // a sheet and typed whole, never nudged one at a time. Both vendor
        // pseudo-elements are needed; `appearance-none` on the input alone does
        // not remove them in WebKit.
        '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none',
        '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
        '[-moz-appearance:textfield]',
        'focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export {Input};
