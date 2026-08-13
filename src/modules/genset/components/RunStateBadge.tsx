import {Badge} from '@/components/ui/badge';
import {RUN_STATE_META} from './runStateMeta';
import type {RunState} from '../types/genset.type';

/**
 * The pill in the "Run state" column and at the top of the detail panel.
 *
 * The surface stays neutral in every state and the glyph alone carries the
 * colour — that's what the design does with `RUNNING`, and holding to it keeps a
 * scrolled table from turning into a traffic light.
 */
export const RunStateBadge = ({runState}: {runState: RunState}) => {
  const {label, icon: Icon, iconClassName} = RUN_STATE_META[runState];

  return (
    <Badge variant="secondary">
      <Icon className={iconClassName} aria-hidden="true" />
      {label}
    </Badge>
  );
};
