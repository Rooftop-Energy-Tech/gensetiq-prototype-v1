import {DATASET} from '@/brands';
import type {DatasetId} from '@/brands';

/**
 * The refuel trucks — a bowser on a lorry, based at a depot, that takes diesel out
 * to machines that are too far to drive in.
 *
 * ## Which gensets get one
 *
 * The rule is Jeff's, 2026-09-29: **a genset standing in a depot's own state drives
 * in to that depot and fills at the yard; anywhere else, a truck comes to it.** So
 * trucks only ever work states that have no depot — Kuala Lumpur, Putrajaya,
 * Negeri Sembilan, Pahang, Kedah and Perlis on this estate — and each truck is
 * given those states by name in `areaStates`.
 *
 * Nearest-depot would have handed every one of them to Klang, since KL, Seremban
 * and even Kuantan are all closer to Klang than to any other yard, and three of the
 * four trucks would never have left home. The areas are assigned instead: Klang
 * takes Kuala Lumpur, Pasir Gudang the south and Putrajaya, Ipoh the east coast,
 * Butterworth the north.
 *
 * The four share the work roughly evenly, 20 to 30 log entries a month each (Jeff,
 * 2026-09-29). That took moving three Kuala Lumpur yards out to Temerloh, Alor
 * Setar and Kangar (`utility.ts`), and handing Putrajaya from Klang's truck to
 * Pasir Gudang's, which passes it on the way up from Seremban.
 *
 * ## Where a truck's diesel comes from
 *
 * Only its home depot (Jeff, 2026-09-29) — never a petrol station. It fills at the
 * yard before it leaves, and when a run would outlast its tank it goes home early
 * to load. See `truckRuns.ts`.
 *
 * ## What a truck is fitted with
 *
 * Three instruments, each of which the page leans on: a **level sensor** on its
 * tank (what left the truck), a **flow meter** on the nozzle (what it says it
 * pumped into each machine), and a **GPS tracker** (where it was when it did). The
 * genset's own level sensor is the fourth reading, and the one the other three are
 * checked against.
 *
 * ## Only the estates that have them
 *
 * Express Mission runs trucks; the carrier estate does not. A dataset with no entry
 * here has no trucks, and the Fuel page then offers no Trucks tab at all — the
 * option is absent, not an empty list (the rule in `CLAUDE.md`).
 */
export type RefuelTruck = {
  id: string;
  /** Road registration, the name everyone in the yard uses for it. */
  plate: string;
  /**
   * Everyone who drives it, in rota order. A truck is on the road more hours than
   * one person can be (Jeff, 2026-09-29), so it changes hands at the yard: each run
   * from a home load to the next goes to the next name here. Who drove is recorded
   * on each event (`TruckEvent.driver`), since that is who answers for it.
   */
  drivers: ReadonlyArray<string>;
  /** The depot it is based at and loads from — an id in `DEPOTS`. */
  homeDepotId: string;
  capacityLitres: number;
  /** The states this truck covers, as the tail of a site's `locationLabel` names them. */
  areaStates: ReadonlyArray<string>;
  /** One line for the card — which part of the map this truck works. */
  areaLabel: string;
};

const TRUCKS_BY_DATASET: Partial<Record<DatasetId, ReadonlyArray<RefuelTruck>>> = {
  utility: [
    {
      id: 'bpx-4521',
      plate: 'BPX 4521',
      drivers: ['Hafiz', 'Azman'],
      homeDepotId: 'klang',
      capacityLitres: 10_000,
      areaStates: ['Kuala Lumpur'],
      areaLabel: 'Kuala Lumpur',
    },
    {
      id: 'akn-3307',
      plate: 'AKN 3307',
      drivers: ['Sivakumar', 'Ravi'],
      homeDepotId: 'ipoh',
      capacityLitres: 10_000,
      areaStates: ['Pahang', 'Kelantan', 'Terengganu'],
      areaLabel: 'East coast',
    },
    {
      id: 'pkr-7182',
      plate: 'PKR 7182',
      drivers: ['Wei Liang', 'Zulkifli'],
      homeDepotId: 'butterworth',
      capacityLitres: 10_000,
      areaStates: ['Kedah', 'Perlis'],
      areaLabel: 'Kedah and Perlis',
    },
    {
      id: 'juv-6649',
      plate: 'JUV 6649',
      drivers: ['Faizal', 'Kumar'],
      homeDepotId: 'pasir-gudang',
      capacityLitres: 10_000,
      areaStates: ['Negeri Sembilan', 'Melaka', 'Putrajaya'],
      areaLabel: 'Negeri Sembilan, Melaka and Putrajaya',
    },
  ],
};

/** The active estate's trucks. Empty where the customer runs none. */
export const TRUCKS: ReadonlyArray<RefuelTruck> = TRUCKS_BY_DATASET[DATASET.id] ?? [];

export const truckById = (truckId: string): RefuelTruck | undefined => TRUCKS.find((truck) => truck.id === truckId);

/** `BPX 4521 · Hafiz` — a truck and whoever was driving it at the time. */
export const truckLabel = (truck: RefuelTruck, driver: string | undefined): string =>
  driver === undefined ? truck.plate : `${truck.plate} · ${driver}`;
