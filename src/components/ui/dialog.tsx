import {Dialog as DialogPrimitive} from 'radix-ui';
import {createContext, useContext, useState} from 'react';
import type * as React from 'react';

import {cn} from '@/lib/utils';

/**
 * A modal dialog, in the same shape as `popover.tsx` beside it.
 *
 * The one addition is the overlay, which is what makes it modal rather than a
 * popover with a border: a form that is halfway through being filled in should
 * not lose its contents to a stray click on the page behind it.
 */
/**
 * The open dialog's own element, so a popover opened inside it portals *into* it.
 *
 * A modal dialog blocks scrolling everywhere outside itself, and a popover portalled
 * to `<body>` is outside it: its list would not scroll with the wheel (2026-09-30,
 * the new-deployment genset picker). `null` outside any dialog, where `<body>` is right.
 */
const DialogContainerContext = createContext<HTMLElement | null>(null);

export const useDialogContainer = () => useContext(DialogContainerContext);

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({className, children, ...props}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-scrim"
      />
      {/* Centred by `inset-0` and auto margins, not a translate (2026-10-05): a
          transform makes the dialog the containing block of the `fixed` popovers
          portalled into it, so its scroll box clipped them — the Log service
          calendar opened cut off. Without one they lay out against the viewport. */}
      <DialogPrimitive.Content
        ref={setContainer}
        data-slot="dialog-content"
        className={cn(
          'fixed inset-0 z-50 m-auto flex h-fit max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-y-auto rounded-lg border border-default bg-overlay p-5 text-primary shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        <DialogContainerContext.Provider value={container}>{children}</DialogContainerContext.Provider>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({className, ...props}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base font-medium text-primary', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-secondary', className)}
      {...props}
    />
  );
}

export {Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription};
