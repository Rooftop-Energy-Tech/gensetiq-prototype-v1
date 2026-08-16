import {CircleAlertIcon, CircleCheckIcon, CircleXIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {ServiceCounterKind, ServiceSeverity} from '../../types/service.type';

/**
 * How each service severity is written and coloured.
 *
 * It reuses the `severity-*` tokens the alarm chips use, and that reuse is the
 * point rather than a shortcut: red means "deal with this" everywhere in the app,
 * and a service that is three months late earns the same red as a shutdown alarm
 * even though nothing on the panel is flashing.
 *
 * There is no entry for "never serviced". It is not a severity — see the
 * `ServiceStatus` union — and giving it a colour here would invite a caller to
 * treat it as one.
 */
export const SERVICE_SEVERITY_META: Record<
  ServiceSeverity,
  {label: string; icon: LucideIcon; textClassName: string; borderClassName: string}
> = {
  OVERDUE: {
    label: 'Overdue',
    icon: CircleXIcon,
    textClassName: 'text-severity-critical',
    borderClassName: 'border-severity-critical/40',
  },
  DUE_SOON: {
    label: 'Due soon',
    icon: CircleAlertIcon,
    textClassName: 'text-severity-warning',
    borderClassName: 'border-severity-warning/40',
  },
  OK: {
    label: 'In service',
    icon: CircleCheckIcon,
    textClassName: 'text-severity-ok',
    borderClassName: 'border-default',
  },
};

/**
 * What each counter is called on screen.
 *
 * `Run hours` rather than `Hours`, and `Time since service` rather than
 * `Months`, because the units are the smaller half of what distinguishes them.
 * The distinction that matters is *what is being counted* — work done versus
 * time passed — and a set that has sat in a yard for seven months has plenty of
 * hours left and is still due.
 */
export const COUNTER_META: Record<
  ServiceCounterKind,
  {label: string; unit: string; reason: string}
> = {
  hours: {
    label: 'Run hours since service',
    unit: 'h',
    reason: 'run hours',
  },
  calendar: {
    label: 'Time since service',
    unit: 'months',
    reason: 'elapsed time',
  },
};
