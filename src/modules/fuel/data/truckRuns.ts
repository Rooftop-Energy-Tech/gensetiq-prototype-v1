import {historyStart} from '@/modules/genset/data/history';
import {spreadBetween} from '@/modules/genset/data/spread';
import {DEPOTS} from './depots';
import {truckFills} from './fills';
import {TRUCKS} from './trucks';
import type {RefuelTruck} from './trucks';

/**
 * What each truck did: where it loaded, where it pumped, and what its three
 * instruments wrote down each time.
 *
 * ## The round
 *
 * A truck starts the record full, parked at its home yard. It works the fills
 * `fills.ts` handed it in order, and it goes home to load **every two to four
 * days** rather than after every stop — a truck covering Kuantan from Ipoh is five
 * hours each way and does not do it daily. Between those, when the tank would drop
 * below a tenth before the next stop, it goes home early to load.
 *
 * **A truck only ever loads at its home depot, never at a petrol station** (Jeff,
 * 2026-09-29). Every litre it carries has come out of a depot tank the page can
 * see, so each load has a pump reading on one side and the truck's sensor on the
 * other.
 *
 * ## Three readings a stop, and why each one exists
 *
 *  - **The nozzle meter** — what the truck says it pumped into this machine.
 *  - **The truck's level fall** — what actually left the truck's tank.
 *  - **The genset's level rise** — what arrived. This is the fleet's own record,
 *    the same figure the depot tab's delivery list shows.
 *
 * A load has one more: **what the depot's pump meter says it gave**.
 *
 * ## Three ways fuel goes missing
 *
 * The Trucks tab opens on one question, *is any fuel missing* (Jeff, 2026-09-29),
 * and each way is one pair of readings disagreeing:
 *
 *  - **Truck out vs genset in** — the meter says more went into a genset than
 *    the genset rose, by more than 10% of the metered litres.
 *  - **Truck out vs nothing in** — the truck's level fell with the meter idle. A
 *    leak, or a siphon between stops.
 *  - **Depot out vs truck in** — the depot pump says more than the truck's tank
 *    rose, by more than 10% of what was pumped.
 *
 * ## The three things the seed plants
 *
 * Without them every truck would reconcile to within a few litres and nothing
 * could ever be seen missing. Klang's truck pumps **16% more than arrives** at one
 * stop about six days back. Pasir Gudang's truck loses **380 L between two stops**
 * eleven days back, with the meter still. Ipoh's truck loads at the depot about
 * two days back and its tank rises **12% less than the pump says**. Everything else
 * carries only instrument noise, well under the 10% line.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Past this share of the metered or sold litres, the gap is fuel missing. Jeff's figure. */
const MISSING_FRACTION = 0.1;

/** Below this share of capacity before a stop, the truck goes home early to load. */
const TOP_UP_FRACTION = 0.1;

/** The stop that goes wrong: Klang's truck, six days back. */
const BAD_STOP = {truckId: 'bpx-4521', daysAgo: 6, overPumpFraction: 0.16};
/** The fuel that walks off: Pasir Gudang's truck, eleven days back. */
const SIPHON = {truckId: 'juv-6649', daysAgo: 11, litres: 380};
/**
 * The load that is not in the tank: Ipoh's truck, at the home load nearest two days
 * back. The tank's rise is its real room, so the gap sits on the pump's side.
 */
const SHORT_LOAD = {truckId: 'akn-3307', daysAgo: 2, shortFraction: 0.12};

export type TruckEventKind = 'depot-load' | 'fill' | 'siphon';

export type TruckStop = {
  fillId: string;
  gensetId: string;
  /** What the nozzle meter says went in. */
  meteredLitres: number;
  /** What the genset's level sensor saw arrive. */
  arrivedLitres: number;
};

export type TruckEvent = {
  id: string;
  truckId: string;
  at: number;
  kind: TruckEventKind;
  /**
   * The truck's tank, as its level sensor saw it move: positive for a load,
   * negative for a stop or a loss.
   */
  levelChange: number;
  place: string;
  latitude: number;
  longitude: number;
  /** Who was driving: the rota name for the run this event falls in. */
  driver: string;
  /** Present on a `fill` only. */
  stop?: TruckStop;
  /** On a load only: what the depot's pump meter says went in. */
  soldLitres?: number;
};

const buildEvents = (truck: RefuelTruck): Array<TruckEvent> => {
  const depot = DEPOTS.find((d) => d.id === truck.homeDepotId) ?? DEPOTS[0];
  const fills = truckFills(truck.id);
  const now = Date.now();
  const capacity = truck.capacityLitres;
  const events: Array<TruckEvent> = [];

  // The planted stop is the one nearest its target, so it lands inside the default
  // month whatever day the prototype is opened.
  const badTarget = now - BAD_STOP.daysAgo * DAY;
  const badStopId =
    truck.id === BAD_STOP.truckId
      ? fills.reduce<{id: string; distance: number} | undefined>((best, fill) => {
          const distance = Math.abs(fill.at - badTarget);
          return best === undefined || distance < best.distance ? {id: fill.id, distance} : best;
        }, undefined)?.id
      : undefined;
  let siphonAt = truck.id === SIPHON.truckId ? now - SIPHON.daysAgo * DAY : undefined;

  let level = capacity;
  let lastAt = historyStart();
  let lastPlace = {place: `${depot.name} depot`, latitude: depot.latitude, longitude: depot.longitude};
  let nextHome = historyStart() + spreadBetween(truck.id, 'home-0', 2, 4) * DAY;
  // The truck changes hands at the yard: each run from one home load to the next is
  // the next driver's on the rota.
  let run = 0;
  const driverNow = () => truck.drivers[run % truck.drivers.length] ?? '';

  // Events are kept in the order they happen; a load placed "three hours before a
  // stop" must never land before the stop ahead of it, or the tank would be read
  // filling and emptying out of order.
  const stamp = (target: number) => {
    const at = Math.max(target, lastAt + 60_000);
    lastAt = at;
    return at;
  };

  fills.forEach((fill, index) => {
    // A siphon falls between two stops, wherever the truck last stood.
    if (siphonAt !== undefined && siphonAt < fill.at) {
      const litres = Math.min(SIPHON.litres, level);
      level -= litres;
      events.push({
        id: `${truck.id}-siphon`,
        truckId: truck.id,
        driver: driverNow(),
        at: stamp(siphonAt),
        kind: 'siphon',
        levelChange: -litres,
        ...lastPlace,
      });
      siphonAt = undefined;
    }

    // Home to load. The truck changes hands here, and the round restarts.
    const loadAtHome = () => {
      run += 1;
      const load = capacity - level;
      if (load > 1) {
        events.push({
          id: `${truck.id}-depot-${index}`,
          truckId: truck.id,
          driver: driverNow(),
          at: stamp(fill.at - 3 * HOUR),
          kind: 'depot-load',
          levelChange: load,
          soldLitres: load * (1 + spreadBetween(`${truck.id}-depot-${index}`, 'pump', -0.004, 0.004)),
          place: `${depot.name} depot`,
          latitude: depot.latitude,
          longitude: depot.longitude,
        });
        level = capacity;
        lastPlace = {place: `${depot.name} depot`, latitude: depot.latitude, longitude: depot.longitude};
      }
      nextHome = fill.at + spreadBetween(truck.id, `home-${index + 1}`, 2, 4) * DAY;
    };

    if (fill.at >= nextHome) loadAtHome();

    // Instrument noise, symmetric and small: a meter and a float that agree to a
    // few tenths of a percent. Over a month it nets to tens of litres, under the
    // 100 L floor the depot card already treats as resolution.
    let metered = fill.litres * (1 + spreadBetween(fill.id, 'meter', -0.006, 0.006));
    if (fill.id === badStopId) metered = fill.litres * (1 + BAD_STOP.overPumpFraction);
    const drop = metered * (1 + spreadBetween(fill.id, 'truck-level', -0.003, 0.003));

    // About to run short before the round is due: home early, never a station.
    if (level - drop < capacity * TOP_UP_FRACTION) loadAtHome();

    level -= drop;
    lastPlace = {place: fill.place, latitude: fill.latitude, longitude: fill.longitude};
    events.push({
      id: `${truck.id}-${fill.id}`,
      truckId: truck.id,
      driver: driverNow(),
      at: stamp(fill.at),
      kind: 'fill',
      levelChange: -drop,
      ...lastPlace,
      stop: {
        fillId: fill.id,
        gensetId: fill.gensetId,
        meteredLitres: metered,
        arrivedLitres: fill.litres,
      },
    });
  });

  // The planted short load: the pump's figure raised so the tank's real rise falls
  // short of it. The nearest home load to the target, so it lands in the default
  // month whatever day the prototype is opened.
  if (truck.id === SHORT_LOAD.truckId) {
    const target = now - SHORT_LOAD.daysAgo * DAY;
    const short = events
      .filter((event) => event.kind === 'depot-load')
      .reduce<TruckEvent | undefined>(
        (best, event) =>
          best === undefined || Math.abs(event.at - target) < Math.abs(best.at - target) ? event : best,
        undefined,
      );
    if (short !== undefined) short.soldLitres = short.levelChange / (1 - SHORT_LOAD.shortFraction);
  }

  // Two stops in one ladder step are stamped a minute apart, and at the very end of
  // the record that can push the last one past the clock. The tracker has not
  // reported it yet, so neither does this.
  return events.filter((event) => event.at <= now);
};

const eventsByTruck = new Map<string, Array<TruckEvent>>();

/** One truck's record, oldest first. Dealt on first access. */
export const truckEvents = (truckId: string): ReadonlyArray<TruckEvent> => {
  const held = eventsByTruck.get(truckId);
  if (held !== undefined) return held;

  const truck = TRUCKS.find((t) => t.id === truckId);
  const built = truck === undefined ? [] : buildEvents(truck);
  eventsByTruck.set(truckId, built);
  return built;
};

/** Every truck's record, oldest first. */
export const allTruckEvents = (): ReadonlyArray<TruckEvent> =>
  TRUCKS.flatMap((truck) => truckEvents(truck.id)).sort((a, b) => a.at - b.at);

/**
 * Loads trucks took from one depot's bulk tank — the other half of what that tank
 * issues, beside the machines filled in its yard.
 */
export const depotTruckLoads = (depotId: string): ReadonlyArray<TruckEvent> =>
  TRUCKS.filter((truck) => truck.homeDepotId === depotId).flatMap((truck) =>
    truckEvents(truck.id).filter((event) => event.kind === 'depot-load'),
  );

export type MissingKind = 'not-arrived' | 'not-pumped' | 'not-in-tank';

/** Fuel one event lost, in litres, and which of the three ways. */
export type Missing = {kind: MissingKind; event: TruckEvent; litres: number};

/** What an event lost, or nothing: noise under the 10% line is not missing fuel. */
export const missingOf = (event: TruckEvent): Missing | undefined => {
  if (event.kind === 'siphon') return {kind: 'not-pumped', event, litres: -event.levelChange};

  if (event.stop !== undefined) {
    const litres = event.stop.meteredLitres - event.stop.arrivedLitres;
    return litres > event.stop.meteredLitres * MISSING_FRACTION ? {kind: 'not-arrived', event, litres} : undefined;
  }

  if (event.soldLitres !== undefined) {
    const litres = event.soldLitres - event.levelChange;
    return litres > event.soldLitres * MISSING_FRACTION ? {kind: 'not-in-tank', event, litres} : undefined;
  }

  return undefined;
};

/** Every loss in a window, one truck's or all of them, biggest first. */
export const missingIn = (from: number, to: number, truckId?: string): Array<Missing> =>
  (truckId === undefined ? allTruckEvents() : truckEvents(truckId))
    .filter((event) => event.at >= from && event.at <= to)
    .flatMap((event) => missingOf(event) ?? [])
    .sort((a, b) => b.litres - a.litres);

/** Who has the truck now: the driver on its latest event, or the first on the rota. */
export const currentDriver = (truck: RefuelTruck): string | undefined =>
  truckEvents(truck.id).at(-1)?.driver ?? truck.drivers[0];

/** The truck's tank now — where the walk of its level changes lands. */
export const truckLevel = (truck: RefuelTruck): number =>
  truck.capacityLitres + truckEvents(truck.id).reduce((sum, event) => sum + event.levelChange, 0);

/**
 * Where the tracker last put the truck: its last event's place, or home if it has
 * never been out.
 */
export const truckPosition = (
  truck: RefuelTruck,
): {place: string; latitude: number; longitude: number; at: number | undefined; parked: boolean} => {
  const last = truckEvents(truck.id).at(-1);
  if (last !== undefined) {
    return {
      place: last.place,
      latitude: last.latitude,
      longitude: last.longitude,
      at: last.at,
      parked: last.kind === 'depot-load',
    };
  }

  const depot = DEPOTS.find((d) => d.id === truck.homeDepotId) ?? DEPOTS[0];
  return {
    place: `${depot.name} depot`,
    latitude: depot.latitude,
    longitude: depot.longitude,
    at: undefined,
    parked: true,
  };
};

export type TruckReconciliation = {
  loadedDepotLitres: number;
  meteredLitres: number;
  arrivedLitres: number;
  stops: number;
};

export const reconcileTruck = (truckId: string, from: number, to: number): TruckReconciliation => {
  let loadedDepot = 0;
  let metered = 0;
  let arrived = 0;
  let stops = 0;

  for (const event of truckEvents(truckId)) {
    if (event.at < from || event.at > to) continue;

    if (event.kind === 'depot-load') loadedDepot += event.levelChange;

    if (event.stop !== undefined) {
      metered += event.stop.meteredLitres;
      arrived += event.stop.arrivedLitres;
      stops += 1;
    }
  }

  return {
    loadedDepotLitres: Math.round(loadedDepot),
    meteredLitres: Math.round(metered),
    arrivedLitres: Math.round(arrived),
    stops,
  };
};
