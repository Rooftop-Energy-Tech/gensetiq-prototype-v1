import {CircleIcon, PauseIcon, PowerOffIcon, TriangleAlertIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {lightToken} from '@/styles/colors';
import type {RunState} from '@/modules/genset/types/genset.type';

type RunStateMeta = {
  label: string;
  icon: LucideIcon;
  /** Tailwind text-colour utility — colours the badge glyph, not its surface. */
  iconClassName: string;
  /**
   * The same colour as a literal, for MapLibre paint properties (which are
   * evaluated in a shader and can't read a CSS variable).
   */
  mapColor: string;
};

/**
 * Only `RUNNING` is pinned by the design — Figma puts `blue/500` on its circle
 * glyph and leaves the badge surface neutral. The rest follow that pattern: the
 * surface stays `bg-inset` and the glyph alone carries state, so a row of mixed
 * badges reads as one family rather than a traffic light.
 */
export const RUN_STATE_META: Record<RunState, RunStateMeta> = {
  RUNNING: {
    label: 'Running',
    icon: CircleIcon,
    iconClassName: 'text-status-running',
    mapColor: lightToken['status-running'],
  },
  IDLE: {
    label: 'Idle',
    icon: PauseIcon,
    iconClassName: 'text-status-idle',
    mapColor: lightToken['status-idle'],
  },
  FAULT: {
    label: 'Fault',
    icon: TriangleAlertIcon,
    iconClassName: 'text-status-fault',
    mapColor: lightToken['status-fault'],
  },
  OFFLINE: {
    label: 'Offline',
    icon: PowerOffIcon,
    iconClassName: 'text-status-offline',
    mapColor: lightToken['status-offline'],
  },
};
