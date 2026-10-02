import type {ReactNode} from 'react';
import {InfoIcon} from 'lucide-react';

import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';

/**
 * An (i) beside a label that explains the field on hover or focus. Same glyph, size and
 * colour as the genset rail's asset-details info, so the two read as one control.
 */
export const InfoTip = ({label, children}: {label: string; children: ReactNode}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex cursor-help items-center justify-center rounded-full text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
      >
        <InfoIcon className="size-4" aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-64">{children}</TooltipContent>
  </Tooltip>
);

/**
 * Says why a control is greyed out. A disabled control fires no pointer events, so
 * the wrapper carries the tooltip; with no `reason` it renders the control alone.
 */
export const LockTip = ({reason, children}: {reason: string | undefined; children: ReactNode}) =>
  reason === undefined ? (
    children
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-outline [&>*]:flex-1"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  );
