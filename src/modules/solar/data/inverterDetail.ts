import {spreadBetween} from '@/modules/genset/data/spread';
import type {
  InverterGaugeReading,
  InverterReading,
  StringReading,
} from '../types/reading.type';
import type {Inverter} from '../types/system.type';

/**
 * What one **inverter** reports — the half of a PV system that can talk.
 *
 * Everything in this file is instantaneous and everything in it is the box's own:
 * a DC bus voltage, a current across its terminals, a heatsink temperature, an
 * insulation resistance measured at its own earth. None of it survives a comms
 * failure, which is exactly why it is separated from `systemDetail.ts` — the
 * system's figures are this app's arithmetic over closed months and go on being
 * true while a box is quiet.
 *
 * ## Each reading is derived from the one before it
 *
 * The DC current is the box's own AC output over its own bus voltage; the
 * heatsink temperature is ambient plus what it is dissipating at that output. So
 * a reader who multiplies two dials together gets the third, at any moment, on
 * any box.
 *
 * That is not tidiness. The last time this app had two models for one quantity —
 * a diagram node computed from nameplate beside an energy figure computed from a
 * day — they disagreed by a factor of two and a half, and it took a specific
 * afternoon to find. The rule since is that a second derivation of a quantity is
 * a bug waiting to be written.
 */

export type InverterDetail = {
  readings: Array<InverterReading>;
  gauges: Array<InverterGaugeReading>;
  strings: Array<StringReading>;
};

/**
 * The box's DC bus voltage at nameplate — a property of how its strings are wired.
 *
 * 600–850 V. It is the string length, so it does not move with irradiance the way
 * the current does; a string at a tenth of its current is still at most of its
 * voltage, which is why the two dials say different things and both are worth
 * having.
 */
export const busVoltage = (inverterId: string): number =>
  Math.round(spreadBetween(inverterId, 'inverter/bus-volts', 600, 850));

/**
 * Insulation resistance to earth, MΩ.
 *
 * Exported because the health rules read it without building a whole detail: at
 * ten inverters that would be ten string tables nobody is going to draw.
 */
export const insulationOf = (inverterId: string): number =>
  Math.round(spreadBetween(inverterId, 'inverter/riso', 0.4, 40) * 10) / 10;

/** Ambient at the box, °C — the floor its heatsink temperature sits on. */
const ambientOf = (inverterId: string): number =>
  spreadBetween(inverterId, 'inverter/ambient', 26, 31);

/**
 * Takes the inverter alone, and that is the point of the split.
 *
 * Everything drawn here is already on the box — its output, its strings, its
 * rating — because `systems.ts` apportioned the system's generation across the
 * boxes when it built them. A detail that needed the system back would mean the
 * apportionment happening twice, in two places, which is the shape every
 * disagreement in this app has had.
 */
export const inverterDetail = (inverter: Inverter): InverterDetail => {
  const live = inverter.state === 'GENERATING';
  const reporting = inverter.state !== 'OFFLINE';

  const volts = live ? busVoltage(inverter.id) : 0;
  const amps = live && volts > 0 ? (inverter.outputKw * 1000) / volts : 0;

  // Ambient plus whatever the box is dissipating. A heatsink at 30 °C on a still
  // night and near 60 at one o'clock is the shape of the thing; the point is that
  // it tracks the output dial beside it rather than being dealt independently, so
  // a silent inverter cannot read hot.
  const loading = inverter.ratedKw > 0 ? inverter.outputKw / inverter.ratedKw : 0;
  const inverterTemp = reporting
    ? Math.round((ambientOf(inverter.id) + loading * 28) * 10) / 10
    : 0;

  const healthy = inverter.strings - inverter.downStrings;
  const perString = healthy > 0 ? Math.round((amps / healthy) * 10) / 10 : 0;

  // The dark ones are the last strings on the combiner, not a random scatter: a
  // string is a physical run and the one that fails is a specific one, so it gets
  // a stable name a technician could be sent to.
  const strings: Array<StringReading> = Array.from({length: inverter.strings}, (_, index) => {
    const down = index >= inverter.strings - inverter.downStrings;
    return {
      label: `String ${index + 1}`,
      // Not exactly equal: modules mismatch, and identical bars would read as a
      // drawing rather than a measurement.
      amps: down
        ? 0
        : Math.round(
            perString * spreadBetween(inverter.id, `inverter/string-${index}`, 0.94, 1.04) * 10,
          ) / 10,
      down,
    };
  });

  const readings: Array<InverterReading> = [
    {
      key: 'ac-power',
      label: 'AC output',
      value: Math.round(inverter.outputKw * 10) / 10,
      unit: 'kW',
      precision: 1,
      kind: 'instantaneous',
      daylightOnly: true,
    },
    {
      key: 'dc-voltage',
      label: 'DC bus voltage',
      value: volts,
      unit: 'V',
      kind: 'instantaneous',
      daylightOnly: true,
    },
    {
      key: 'dc-current',
      label: 'DC current',
      value: Math.round(amps * 10) / 10,
      unit: 'A',
      precision: 1,
      kind: 'instantaneous',
      daylightOnly: true,
    },
    {
      // Not `daylightOnly`. A heatsink that stopped working at noon is still warm
      // at eight, exactly the way a coolant probe is on a set that has just
      // stopped — and `telemetry.type.ts` keeps temperatures out of its own
      // engine-only set for the same reason.
      key: 'inverter-temp',
      label: 'Inverter temperature',
      value: inverterTemp,
      unit: '°C',
      precision: 1,
      kind: 'instantaneous',
      daylightOnly: false,
    },
    {
      key: 'insulation-resistance',
      label: 'Insulation resistance',
      value: insulationOf(inverter.id),
      unit: 'MΩ',
      precision: 1,
      kind: 'instantaneous',
      daylightOnly: true,
    },
  ];

  // Four dials, the number the genset page draws, and the same principle behind
  // the choice: the dials are the quantities that only exist *now*, and anything
  // slower is a row further down. `AC output` is scaled to the **inverter's own
  // rating** rather than to the DC behind it, because the rating is the ceiling
  // the output actually meets — a dial that topped out at nameplate kWp would
  // never fill, by design.
  const gauges: Array<InverterGaugeReading> = [
    {...readings[0], min: 0, max: inverter.ratedKw},
    {...readings[1], min: 0, max: 1000},
    {...readings[2], min: 0, max: Math.max(10, Math.ceil(inverter.kwp / 8) * 10)},
    {...readings[3], min: 0, max: 80},
  ];

  return {readings, gauges, strings};
};
