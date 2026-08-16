import type {Genset} from '../../types/genset.type';
import {useFuelIntegrity} from '../../data/fuelIntegrity';
import {LeakAlarmCard} from './LeakAlarmCard';

/**
 * The Settings tab — per-genset configuration.
 *
 * The design's tab strip names this tab and draws nothing behind it; its
 * placeholder promised "alert thresholds, tags, who gets notified". One of those
 * three is built, and the page says so at the bottom rather than implying by
 * silence that a tab with one section on it is finished.
 *
 * The fuel leakage alarm earns the tab because it is the only threshold the *app*
 * owns. Every other limit on this machine is a commissioning value set in the
 * controller — the panel decides at what voltage it drops the breaker, and a screen
 * that let you type a different number would be lying about what it could do. This
 * one has no panel behind it: the app does the arithmetic, so the app holds the
 * line, and it is the one setting here that a save actually changes.
 */
export const GensetSettings = ({genset}: {genset: Genset}) => {
  const state = useFuelIntegrity(genset.id);

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <h1 className="text-base font-medium text-primary">Settings</h1>

      <LeakAlarmCard
        gensetId={genset.id}
        capacityLitres={genset.fuelCapacityLitres}
        state={state}
      />

      <hr className="border-subtle" />

      <p className="max-w-prose text-sm text-tertiary">
        Tags and notification routing are named in the design's tab strip and not
        drawn. The controller's own alarm setpoints are not editable here and will
        not be: they live in the panel, and a screen that let you type a different
        breaker limit would be claiming a command this app cannot issue.
      </p>
    </div>
  );
};
