import {Badge} from '@/components/ui/badge';
import {RunStateIcon} from './RunningPulse';
import {RUN_STATE_META} from './runStateMeta';
import type {RunState} from '../types/genset.type';

/**
 * The pill in the `Status` column and at the top of the detail panel.
 *
 * The column was headed `Run state` until 2026-09-22. The component, the field and
 * the vocabulary keep the longer name — `RunState` is one of four the app reasons
 * with, and `fleetStatus.ts` turns on the difference between it and the other
 * three. Only the header shortened, because a 13% column has room for one word.
 *
 * The surface stays neutral in every state and the glyph alone carries the
 * colour — that's what the design does with `RUNNING`, and holding to it keeps a
 * scrolled table from turning into a traffic light. A running set's dot pings —
 * see `RunningPulse`.
 */
export const RunStateBadge = ({runState}: {runState: RunState}) => {
  const {label} = RUN_STATE_META[runState];

  return (
    <Badge variant="secondary">
      <RunStateIcon runState={runState} className="size-3" />
      {label}
    </Badge>
  );
};
