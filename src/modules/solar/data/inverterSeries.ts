import {bucketFor} from '@/modules/genset/data/history';
import {spread} from '@/modules/genset/data/spread';
import {intradayKw, solarDays} from '@/modules/site/data/hybrid';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {ReadingSeries, Sample, SeriesThreshold} from '@/modules/genset/types/series.type';
import type {SystemAlert} from '../types/health.type';
import type {Inverter, SolarSystem} from '../types/system.type';
import {busVoltage, insulationOf} from './inverterDetail';
import type {InverterDetail} from './inverterDetail';

/**
 * One **inverter's** readings, sampled over a window — what its trace draws.
 *
 * ## The trace is per box, and that is the point
 *
 * It used to be per system, back when the register's row was an "array". That was
 * only ever coherent because every system on the demo estate had exactly one
 * inverter. Ask a 1.3 MW plant with ten boxes for "the DC current" and there is
 * no answer — there are ten, and the entire diagnostic value is in which one is
 * different.
 *
 * ## Everything here comes out of one quantity
 *
 * The box's AC power trace is `intradayKw(that day's energy, that hour)` scaled
 * by **this box's share of the system's healthy strings** — the same share
 * `systems.ts` used to divide today's output, so the trace lands on the dial. Then
 * the DC current is that power over this box's own bus voltage, and the heatsink
 * temperature is ambient plus what it is dissipating.
 *
 * Four traces, one model, so a reader who multiplies the two DC dials together
 * gets the AC one at any point in any window, and the trace of a day agrees with
 * the bar that day contributes to on the system's yield chart.
 *
 * ## Null is not zero
 *
 * `Sample.value: null` carries the meaning it carries on a genset: the quantity
 * **did not exist** at that moment. For an inverter that is every night, and the
 * chart breaks the line rather than drawing it to zero and back — which would
 * report a nightly shutdown, on every box, forever.
 */

const MINUTE = 60 * 1000;

/** First light and last, the hours `hybrid.ts` builds every solar day between. */
const FIRST_LIGHT = 7;
const LAST_LIGHT = 19;

/**
 * A smooth 0–1 wandering, keyed off absolute time.
 *
 * `history.ts` keeps its own and explains why it is interpolated between hashed
 * control points rather than hashed per sample: a reading is a physical quantity
 * with inertia, and white noise per bucket draws a solid band of fuzz. Keying off
 * absolute time rather than the sample's index is what makes switching from 24 h
 * to 7 d *resample the same signal* — a dip somebody spotted at one zoom is still
 * there at the next.
 */
const wobble = (inverterId: string, key: string, t: number, periodMinutes: number): number => {
  const position = t / (periodMinutes * MINUTE);
  const index = Math.floor(position);
  const fraction = position - index;
  const left = spread(inverterId, `${key}/${index}`);
  const right = spread(inverterId, `${key}/${index + 1}`);
  const eased = fraction * fraction * (3 - 2 * fraction);
  return left + (right - left) * eased;
};

/** How far a reading is allowed to wander around its centre, as a fraction. */
const SWING: Record<string, number> = {
  'ac-power': 0.14,
  'dc-voltage': 0.03,
  'dc-current': 0.14,
  'inverter-temp': 0.06,
  'insulation-resistance': 0.12,
};

const dayKey = (t: number): string => new Date(t).toISOString().slice(0, 10);

export const inverterReadingSeries = (
  system: SolarSystem,
  inverter: Inverter,
  detail: InverterDetail,
  alerts: Array<SystemAlert>,
  key: string,
  from: number,
  to: number,
  now: number,
): ReadingSeries | undefined => {
  const seed = siteSeed(system.siteId);
  const reading = detail.readings.find((one) => one.key === key);
  if (seed === undefined || reading === undefined || reading.kind !== 'instantaneous') {
    return undefined;
  }

  const bucket = bucketFor(to - from);
  const times: Array<number> = [];
  for (let t = from; t <= to; t += bucket) times.push(t);
  if (times.length === 0) times.push(from);

  // The window's daily energy, fetched once. A per-bucket lookup into `solarDays`
  // would be the same arithmetic run three hundred times.
  const days = new Map(
    solarDays(seed, system.role, from, to, now).map((day) => [
      dayKey(Date.parse(day.at)),
      day.actualKwh,
    ]),
  );

  // This box's cut of the system, by healthy strings — the same division
  // `systems.ts` made when it apportioned today's output, so the right-hand end
  // of this trace is the figure on the dial rather than near it.
  const healthyTotal = system.inverters.reduce(
    (sum, one) => sum + (one.strings - one.downStrings),
    0,
  );
  const share =
    healthyTotal > 0 ? (inverter.strings - inverter.downStrings) / healthyTotal : 0;

  const volts = busVoltage(inverter.id);
  const ambient = Math.max(
    0,
    (detail.readings.find((one) => one.key === 'inverter-temp')?.value ?? 30) -
      (inverter.ratedKw > 0 ? (inverter.outputKw / inverter.ratedKw) * 28 : 0),
  );

  // A box that has stopped reporting produces nothing after its last message. The
  // series ends there rather than running flat to the right edge, which would
  // claim the silence was a steady reading.
  const silentFrom =
    inverter.state === 'OFFLINE' ? new Date(inverter.lastUpdated).getTime() : undefined;

  const samples: Array<Sample> = times.map((t) => {
    if (silentFrom !== undefined && t > silentFrom) return {t, value: null};

    const at = new Date(t);
    const hour = at.getHours() + at.getMinutes() / 60;
    const daylight = hour >= FIRST_LIGHT && hour <= LAST_LIGHT;
    if (reading.daylightOnly && !daylight) return {t, value: null};

    const kw = intradayKw(days.get(dayKey(t)) ?? 0, hour) * share;
    const loading = inverter.ratedKw > 0 ? kw / inverter.ratedKw : 0;
    // A string's voltage falls as its cells warm. It is the reading that moves
    // least across a day, which is the point of having it beside the current: one
    // dial says how hard the box is working and the other says almost nothing, and
    // the pair is how a fault that moves both is told from one that moves one.
    const busAt = volts * (1 - loading * 0.06);

    const centre =
      key === 'ac-power'
        ? kw
        : key === 'dc-voltage'
          ? busAt
          : key === 'dc-current'
            ? (kw * 1000) / Math.max(1, busAt)
            : key === 'inverter-temp'
              ? ambient + loading * 28
              : insulationOf(inverter.id);

    const swing = SWING[key] ?? 0.05;
    // Two periods summed: a slow shape and a bit of texture.
    const noise =
      (wobble(inverter.id, key, t, 180) - 0.5) * 2 * swing +
      (wobble(inverter.id, `${key}-fine`, t, 25) - 0.5) * swing;

    return {t, value: Math.max(0, centre * (1 + noise))};
  });

  const precision = reading.precision ?? 0;
  // Stored two digits finer than the reading is written, the trick `history.ts`
  // learned: rounding samples to the display precision quantises the trace onto
  // the handful of integers its axis spans, and a staircase reads as a control
  // system hunting rather than as a rounding artefact.
  const stored = precision + 2;
  const rounded: Array<Sample> = samples.map((sample) => ({
    t: sample.t,
    value: sample.value === null ? null : Math.round(sample.value * 10 ** stored) / 10 ** stored,
  }));

  const alert = alerts.find((one) => one.readingKey === key && one.limit !== null);
  const threshold: SeriesThreshold | undefined =
    alert === undefined || alert.limit === null
      ? undefined
      : {
          limit: alert.limit,
          comparator: alert.comparator,
          severity: alert.severity,
          name: alert.name,
          raisedAt: Date.parse(alert.raisedAt),
        };

  const values = rounded
    .map((sample) => sample.value)
    .filter((value): value is number => value !== null);

  // Padded off the extremes and widened to take in the threshold, the rule
  // `ReadingSeries.domain` states: a trace along the top of its own frame reads as
  // pegged, and a threshold line just outside the frame is the one thing you
  // needed to see.
  const low = values.length === 0 ? 0 : Math.min(...values);
  const high = values.length === 0 ? 1 : Math.max(...values);
  const span = high - low;
  const pad = span > 0 ? span * 0.12 : Math.max(1, Math.abs(high) * 0.1);

  return {
    key,
    label: reading.label,
    unit: reading.unit,
    precision,
    samples: rounded,
    domain: {
      min: Math.max(0, Math.min(low - pad, threshold === undefined ? low : threshold.limit - pad)),
      max: Math.max(high + pad, threshold === undefined ? high : threshold.limit + pad),
    },
    threshold,
  };
};
