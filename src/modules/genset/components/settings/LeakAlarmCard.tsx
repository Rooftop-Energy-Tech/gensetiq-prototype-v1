import {useEffect, useId, useState} from 'react';
import {GaugeIcon, RulerIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {amount} from '@/lib/format';
import {canReconcile, thresholdLitres} from '../../types/fuelIntegrity.type';
import type {FuelIntegrityState, GensetFuelInstruments} from '../../types/fuelIntegrity.type';
import {
  instrumentsOf,
  setLeakAlarmEnabled,
  setThresholdPercent,
  useLeakSettings,
} from '../../data/fuelInstruments';
import {FuelIntegrityPanel} from './FuelIntegrityPanel';

/**
 * The fuel leakage alarm — what it needs, whether it is on, and where the line is.
 *
 * ## Why the switch is here and not simply absent
 *
 * Most of this fleet cannot run this check, and the first version of this feature
 * expressed that by having no control at all on those units. That is the wrong kind
 * of nothing: an operator who has heard the product can spot fuel theft goes
 * looking for the setting, finds an empty tab, and concludes the feature does not
 * exist rather than that this machine is missing a two-thousand-ringgit meter.
 *
 * So the switch is always drawn, and on a set that cannot reconcile it is
 * inoperable and says which instrument it wants. The explanation lands in the place
 * somebody went looking for it.
 *
 * ## Why it defaults on
 *
 * Because the alternative fails silently. A customer who has paid for flow meters
 * and never found this switch gets nothing back for them, and no screen anywhere
 * says so. Defaulting on inverts that: switching *off* is the deliberate act, taken
 * against a unit with a probe somebody already knows is lying, and the store holds
 * only those decisions — so "which sets has this been turned off on" stays a
 * question the app can answer.
 *
 * ## Why the threshold is a percentage
 *
 * It is the only form that carries across the fleet. `2%` is the same instruction
 * on a 600 L tank and a 3,000 L one, where `45 L` is a tight threshold on the first
 * and a meaningless one on the second. The litres it implies are shown beside it,
 * because percent is the right thing to store and the wrong thing to think in when
 * you are deciding whether a loss justifies sending somebody out.
 */

const percent = (fraction: number): string => `±${(fraction * 100).toFixed(1)}%`;

/**
 * What the machine is fitted with.
 *
 * A device with no accuracy is not representable, so each row can state one — and
 * it is worth stating, because the tolerance those two figures buy is subtracted
 * from every discrepancy before anything is called a leak. A reader who wants to
 * know why 20 unaccounted litres did not raise anything is looking at these numbers.
 */
const Instruments = ({
  instruments,
  state,
}: {
  instruments: GensetFuelInstruments;
  state: FuelIntegrityState;
}) => {
  const feeds =
    state.kind === 'unavailable'
      ? {level: state.levelSensor, flow: state.flowMeter}
      : {level: 'reporting' as const, flow: 'reporting' as const};

  const rows = [
    {
      icon: RulerIcon,
      label: 'Tank level sensor',
      device: instruments.levelSensor,
      spec:
        instruments.levelSensor === null
          ? null
          : `${percent(instruments.levelSensor.accuracyOfFullScale)} of full scale`,
      feed: feeds.level,
    },
    {
      icon: GaugeIcon,
      label: 'Fuel flow meter',
      device: instruments.flowMeter,
      spec:
        instruments.flowMeter === null
          ? null
          : `${percent(instruments.flowMeter.accuracyOfReading)} of reading`,
      feed: feeds.flow,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const RowIcon = row.icon;
        return (
          <div
            key={row.label}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-element px-4 py-2.5"
          >
            <RowIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
            <span className="text-sm text-secondary">{row.label}</span>
            <span className="text-base font-medium text-primary">
              {row.device?.model ?? 'Not fitted'}
            </span>
            {row.spec === null ? null : (
              <span className="text-xs text-tertiary">{row.spec}</span>
            )}
            {/* No badge on a device that is not there. The model slot already
                reads "Not fitted", and a chip repeating it would spend the row's
                one piece of emphasis saying the same thing twice. */}
            {row.feed === 'not-fitted' ? null : (
              <Badge variant="element" className="ml-auto border-subtle">
                {row.feed === 'reporting' ? 'Reporting' : 'No reading'}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const LeakAlarmCard = ({
  gensetId,
  capacityLitres,
  state,
}: {
  gensetId: string;
  capacityLitres: number;
  state: FuelIntegrityState;
}) => {
  const instruments = instrumentsOf(gensetId);
  const capable = canReconcile(instruments);
  const {enabled, thresholdPercent, floorPercent} = useLeakSettings(gensetId);

  const floorId = useId();
  const [draft, setDraft] = useState(String(thresholdPercent));
  const [refused, setRefused] = useState(false);

  // Re-sync when the store moves underneath — including the case that matters,
  // a threshold read back up to the probe's floor. Without this the field would go
  // on showing a value the detector is not using.
  useEffect(() => {
    setDraft(String(thresholdPercent));
    setRefused(false);
  }, [thresholdPercent]);

  const parsed = Number(draft);
  const parseable = draft.trim() !== '' && !Number.isNaN(parsed);
  const changed = parseable && parsed !== thresholdPercent;

  const missing =
    instruments.flowMeter === null && instruments.levelSensor === null
      ? 'a tank level sensor and a fuel flow meter'
      : instruments.flowMeter === null
        ? 'a fuel flow meter'
        : 'a tank level sensor';

  return (
    <section aria-label="Fuel leakage alarm" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-primary">Fuel leakage alarm</h2>
        <p className="max-w-prose text-sm text-secondary">
          Compares what the tank level sensor says is left against what the fuel flow
          meter says was burned. Fuel that left the tank without passing the injectors
          is unaccounted for — a leak, or a siphon. It is the only alarm here that
          needs two instruments, because no single one can see it.
        </p>
      </div>

      <Instruments instruments={instruments} state={state} />

      <div className="flex flex-col gap-3 rounded-lg border border-default bg-element px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-secondary">Alarm</span>

          <Button
            type="button"
            size="sm"
            variant={enabled ? 'default' : 'outline'}
            aria-pressed={enabled}
            disabled={!capable}
            onClick={() => setLeakAlarmEnabled(gensetId, !enabled)}
          >
            {enabled ? 'On' : 'Off'}
          </Button>

          {!capable ? (
            <span className="text-sm text-tertiary">
              Needs {missing}. This check cannot run on this genset.
            </span>
          ) : null}
        </div>

        {/* The threshold is only a question once the alarm is watching. Left
            editable while switched off it would invite somebody to tune a line
            nothing is measuring against. */}
        {capable && enabled ? (
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!parseable || !changed) return;
              setRefused(!setThresholdPercent(gensetId, parsed));
            }}
          >
            <label className="flex w-[190px] flex-col gap-1.5">
              <span className="text-xs text-secondary">Raise an alarm above</span>
              <div className="flex items-center gap-2">
                {/* No `min`. It is the right constraint and the wrong mechanism:
                    with one set, a sub-floor value fails the browser's own
                    validation, which blocks the submit event *silently* and leaves
                    the field showing a number the detector is not using. The floor
                    is stated below the field and explained if somebody crosses it,
                    which is the same rule enforced somewhere it can say why. */}
                <Input
                  type="number"
                  step={0.1}
                  inputMode="decimal"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Acceptable discrepancy, as a percentage of tank capacity"
                  aria-describedby={floorId}
                />
                <span className="text-sm whitespace-nowrap text-secondary">% of tank</span>
              </div>
              {/* Both facts under the field rather than one trailing it. The
                  litre figure is what an operator actually reasons in, so it must
                  not be the thing a 375px screen wraps onto a line of its own. */}
              <span id={floorId} className="text-xs text-tertiary">
                {amount(thresholdLitres(thresholdPercent, capacityLitres), 'L')} on this{' '}
                {capacityLitres.toLocaleString('en-MY')} L tank · minimum{' '}
                {floorPercent.toFixed(1)}%
              </span>
            </label>

            <Button type="submit" size="sm" variant="outline" disabled={!parseable || !changed}>
              Save
            </Button>
          </form>
        ) : null}

        {refused ? (
          <p className="max-w-prose text-sm text-severity-warning">
            The lowest this genset can go is {floorPercent.toFixed(1)}% — the level
            sensor's own accuracy. A line drawn finer than the instrument can resolve
            is not a threshold; it is an alarm that is always on.
          </p>
        ) : null}
      </div>

      <FuelIntegrityPanel state={state} />
    </section>
  );
};
