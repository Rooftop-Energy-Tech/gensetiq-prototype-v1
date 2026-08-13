import {BoomBoxIcon, FactoryIcon, RefreshCwIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';

/**
 * One box in the single-line diagram.
 *
 * `live` puts a teal dot in the corner. Only the genset gets one — it is the only
 * node whose state the controller reports. The load and the changeover are drawn
 * because an operator needs to see *what the genset is wired to* before they
 * press anything, not because the page knows anything about them.
 */
const Node = ({
  icon: Icon,
  label,
  live = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  live?: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      'absolute flex h-[74px] w-[88px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-default bg-element pt-2.5 pb-2',
      className,
    )}
  >
    <div className="flex size-8 items-center justify-center rounded-md bg-highlight">
      <Icon className="size-[18px] text-primary" aria-hidden="true" />
    </div>
    <p className="text-xs font-semibold whitespace-nowrap text-primary">{label}</p>
    {live && <span className="absolute top-[7px] left-[7px] size-[7px] rounded-full bg-teal" />}
  </div>
);

/**
 * GENSET and LOAD on the left, the changeover on the right, a bus between them.
 *
 * Fixed 232 × 170 px with absolutely positioned parts, straight off the design's
 * coordinates. A diagram is one of the few things in a layout that genuinely
 * wants fixed geometry: the lines have to *land* on the boxes, and a flex or grid
 * arrangement that reflows would leave a conductor ending in mid-air at some
 * width. The block is `shrink-0` in its parent and the row wraps around it.
 *
 * It sits beside the control pad on purpose. The controls decide whether the
 * genset feeds the load; the diagram is the picture of what that means.
 */
export const PowerFlowDiagram = ({live}: {live: boolean}) => (
  <div className="relative h-[170px] w-[232px] shrink-0" aria-hidden="true">
    {/* Genset → bus, at the genset's vertical centre. */}
    <span className="absolute top-[36px] left-[88px] h-px w-7 bg-default" />
    {/* Load → bus. */}
    <span className="absolute top-[132px] left-[88px] h-px w-7 bg-default" />
    {/* The bus itself, joining the two. */}
    <span className="absolute top-[36px] left-[115px] h-[97px] w-px bg-default" />
    {/* Bus → changeover, taken off the midpoint. */}
    <span className="absolute top-[84px] left-[116px] h-px w-7 bg-default" />
    <span
      className={cn(
        'absolute top-[81px] left-[112px] size-[7px] rounded-full',
        live ? 'bg-teal' : 'bg-tertiary',
      )}
    />

    <Node icon={BoomBoxIcon} label="GENSET" live={live} className="top-0 left-0" />
    <Node icon={FactoryIcon} label="LOAD" className="top-24 left-0" />
    <Node icon={RefreshCwIcon} label="C / O" className="top-12 left-36" />
  </div>
);
