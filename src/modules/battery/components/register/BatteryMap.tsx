import {useMemo} from 'react';

import {PlantMap} from '@/components/global/PlantMap';
import type {PlantPoint, PlantTone} from '@/components/global/PlantMap';
import {BANK_RUNTIME_META, BANK_RUNTIMES, bankRuntime} from '../runtimeMeta';
import type {BatteryBank} from '../../types/bank.type';

/**
 * The storage estate on a map — `PlantMap` given this module's vocabulary.
 *
 * Pins carry **runtime**, the same quantity the table sorts by, so the map answers the
 * question the register is opened for: which banks will not see the morning, and where
 * they are. See `runtimeMeta.ts` for why that is hours left rather than state of
 * charge, and why state of health drives neither.
 *
 * The ring inside a cluster's count follows `BANK_RUNTIMES`, worst first from twelve
 * o'clock — so a bubble over four sites says whether any of them is the flat one, and
 * the same estate always draws the same ring.
 */
const TONES: ReadonlyArray<PlantTone> = BANK_RUNTIMES.map((runtime) => ({
  key: runtime,
  color: BANK_RUNTIME_META[runtime].mapColor,
}));

type BatteryMapProps = {
  banks: Array<BatteryBank>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  panelInset: number;
  focusIds?: Array<string>;
};

export const BatteryMap = ({
  banks,
  selectedId,
  onSelect,
  onDeselect,
  panelInset,
  focusIds,
}: BatteryMapProps) => {
  // Memoised because `PlantMap` keys its data and framing effects on this array's
  // identity: a fresh one every render would push the source and re-fit the viewport
  // on every unrelated re-render of the page.
  const points = useMemo<Array<PlantPoint>>(
    () =>
      banks.map((bank) => ({
        id: bank.id,
        latitude: bank.latitude,
        longitude: bank.longitude,
        tone: bankRuntime(bank),
      })),
    [banks],
  );

  return (
    <PlantMap
      points={points}
      tones={TONES}
      selectedId={selectedId}
      onSelect={onSelect}
      onDeselect={onDeselect}
      panelInset={panelInset}
      focusIds={focusIds}
      label="Battery bank locations map"
    />
  );
};
