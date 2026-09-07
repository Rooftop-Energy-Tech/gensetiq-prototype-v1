import {useMemo} from 'react';

import {PlantMap} from '@/components/global/PlantMap';
import type {PlantPoint, PlantTone} from '@/components/global/PlantMap';
import {SYSTEM_STATE_META} from '../systemStateMeta';
import {SYSTEM_STATES} from '../../types/system.type';
import type {SolarRow} from '../../data/register';

/**
 * The solar estate on a map — `PlantMap` given this module's vocabulary.
 *
 * ## Pins carry state, not condition
 *
 * The table beside it ranks by condition, and the pins deliberately do not. Condition
 * is a verdict about *how well* a system is generating, and it is three shades of the
 * same judgement — a map of it is a traffic light with no scale, and the row's own
 * Health cell already says it in words.
 *
 * State answers the question a map is opened for: **which of these are alive right
 * now**, and where the dead one is. It is also the column directly beside the name,
 * so a pin and the badge two cells along are two readings of one fact — which is what
 * `SYSTEM_STATE_META` carrying both the class and the colour is for.
 *
 * The ring inside a cluster's count follows `SYSTEM_STATES`, generating first from
 * twelve o'clock — the order the fleet map draws its own run states in, so the same
 * estate always draws the same ring and the eye learns where to look.
 */
const TONES: ReadonlyArray<PlantTone> = SYSTEM_STATES.map((state) => ({
  key: state,
  color: SYSTEM_STATE_META[state].mapColor,
}));

type SolarMapProps = {
  rows: Array<SolarRow>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  panelInset: number;
  focusIds?: Array<string>;
};

export const SolarMap = ({
  rows,
  selectedId,
  onSelect,
  onDeselect,
  panelInset,
  focusIds,
}: SolarMapProps) => {
  // Memoised because `PlantMap` keys its data and framing effects on this array's
  // identity: a fresh one every render would push the source and re-fit the viewport
  // on every unrelated re-render of the page.
  const points = useMemo<Array<PlantPoint>>(
    () =>
      rows.map(({system}) => ({
        id: system.id,
        latitude: system.latitude,
        longitude: system.longitude,
        tone: system.state,
      })),
    [rows],
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
      label="Solar system locations map"
    />
  );
};
