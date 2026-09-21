import type {Deployment, DeploymentMembership} from '../types/deployment.type';

/**
 * `BRF9540`'s postings — **the only measured records in this prototype**.
 *
 * Everything else on the deployment register is dealt from a hash (see `seed.ts`).
 * These eight are Express Mission's own record for one Cummins 1000 kVA set between
 * May and September 2026, taken from the `em-gw-001` gateway export of 2026-09-21.
 * The windows and the tank readings are as the job sheet states them; the runs
 * underneath are the engine actually turning, which is why `history.ts` carves this
 * machine out of the generated run log.
 *
 * ## What is measured and what is placed
 *
 * The **windows, the tank readings and the loads** are real. The **yards** are real
 * names with placename coordinates rather than surveyed ones, and two postings have
 * no location on the record at all — those carry `siteId: null`, which is the record
 * saying so rather than the app inventing a yard. The **lorry plates are absent**
 * for the same reason: the export knows what the machine did, not what carried it.
 *
 * ## The two long jobs do not reconcile, and that is the data
 *
 * Jobs 2 and 7 burn 0.12 L/kWh against a diesel set's ordinary 0.25–0.30. Job 2
 * produced 11,603 kWh and the tank fell 1,348 L; at a credible SFC it should have
 * taken nearer 3,000. The likeliest reading is a **refuel inside the window that the
 * start→last pair hides** — a tank filled mid-job shows only its endpoints. Left as
 * recorded rather than corrected, because inventing the missing fill would be the
 * prototype asserting a delivery nobody logged. ⚠️ Do not quote these two jobs' fuel
 * efficiency as a benchmark.
 */
export const REAL_GENSET_ID = 'brf9540';

type RealJob = {
  /** `1`–`8`, as the job sheet numbers them. */
  index: number;
  /** A yard in the estate, or `null` where the record names no location. */
  siteId: string | null;
  locationLabel: string;
  /** ISO 8601, UTC — the posting's own window, not the engine's. */
  startsAt: string;
  endsAt: string;
  /** Tank level at the posting's edges, litres, as recorded. */
  startFuelLitres: number;
  endFuelLitres: number;
  /**
   * When the posting was filed, ISO 8601. Kept because the first four were all
   * entered on 19 June — a fortnight of jobs written up in one sitting — which is
   * worth knowing before treating an entry date as an event date.
   */
  enteredAt: string;
  /** The engine's own span inside the window, from the controller. */
  engineStartedAt: string;
  engineEndedAt: string;
  /** Integrated from the controller's active-power samples across the window. */
  energyKwh: number;
  /** Mean and peak load the set carried, kW. */
  meanLoadKw: number;
  peakLoadKw: number;
};

const JOBS: ReadonlyArray<RealJob> = [
  {index: 1, siteId: 'pe-026', locationLabel: 'PE Kapar L. Ind Park',
   startsAt: '2026-05-23T02:00:00.000Z', endsAt: '2026-05-23T10:00:00.000Z',
   startFuelLitres: 1970, endFuelLitres: 1848, enteredAt: '2026-06-19T00:00:00.000Z',
   engineStartedAt: '2026-05-23T02:49:00.000Z', engineEndedAt: '2026-05-23T09:25:00.000Z',
   energyKwh: 298, meanLoadKw: 44, peakLoadKw: 58},

  {index: 2, siteId: 'pe-027', locationLabel: 'PE Sek Men Vokasional Sg. Buloh',
   startsAt: '2026-06-03T10:00:00.000Z', endsAt: '2026-06-06T04:00:00.000Z',
   startFuelLitres: 1850, endFuelLitres: 502, enteredAt: '2026-06-19T00:00:00.000Z',
   engineStartedAt: '2026-06-03T10:48:00.000Z', engineEndedAt: '2026-06-06T03:19:00.000Z',
   energyKwh: 11_603, meanLoadKw: 180, peakLoadKw: 232},

  {index: 3, siteId: 'pe-028', locationLabel: 'PE Taman Pantai Makmur 2',
   startsAt: '2026-06-11T04:00:00.000Z', endsAt: '2026-06-11T15:50:00.000Z',
   startFuelLitres: 2300, endFuelLitres: 1804, enteredAt: '2026-06-19T00:00:00.000Z',
   engineStartedAt: '2026-06-11T04:33:00.000Z', engineEndedAt: '2026-06-11T15:38:00.000Z',
   energyKwh: 1155, meanLoadKw: 104, peakLoadKw: 127},

  {index: 4, siteId: null, locationLabel: 'Location not recorded',
   startsAt: '2026-06-18T07:30:00.000Z', endsAt: '2026-06-18T12:00:00.000Z',
   startFuelLitres: 1800, endFuelLitres: 1412, enteredAt: '2026-06-19T00:00:00.000Z',
   engineStartedAt: '2026-06-18T07:44:00.000Z', engineEndedAt: '2026-06-18T11:31:00.000Z',
   energyKwh: 1203, meanLoadKw: 317, peakLoadKw: 433},

  {index: 5, siteId: 'pe-029', locationLabel: 'PE Tmn Sementa Jaya',
   startsAt: '2026-06-24T08:10:00.000Z', endsAt: '2026-06-25T14:30:00.000Z',
   startFuelLitres: 2100, endFuelLitres: 20, enteredAt: '2026-06-25T00:00:00.000Z',
   engineStartedAt: '2026-06-24T08:17:00.000Z', engineEndedAt: '2026-06-25T13:15:00.000Z',
   energyKwh: 4352, meanLoadKw: 347, peakLoadKw: 486},

  {index: 6, siteId: 'pe-030', locationLabel: 'PE Pusat Ternakan Itik',
   startsAt: '2026-06-27T20:35:00.000Z', endsAt: '2026-06-29T14:30:00.000Z',
   startFuelLitres: 2200, endFuelLitres: 1623, enteredAt: '2026-07-01T00:00:00.000Z',
   engineStartedAt: '2026-06-28T15:39:00.000Z', engineEndedAt: '2026-06-29T14:03:00.000Z',
   energyKwh: 483, meanLoadKw: 22, peakLoadKw: 75},

  {index: 7, siteId: 'pe-031', locationLabel: 'PE Alam Perdana No 3',
   startsAt: '2026-09-10T06:40:00.000Z', endsAt: '2026-09-11T15:00:00.000Z',
   startFuelLitres: 2200, endFuelLitres: 1520, enteredAt: '2026-09-14T00:00:00.000Z',
   engineStartedAt: '2026-09-10T06:40:00.000Z', engineEndedAt: '2026-09-11T14:45:00.000Z',
   energyKwh: 5540, meanLoadKw: 172, peakLoadKw: 274},

  {index: 8, siteId: null, locationLabel: 'Location not recorded',
   startsAt: '2026-09-15T07:10:00.000Z', endsAt: '2026-09-16T12:00:00.000Z',
   startFuelLitres: 2300, endFuelLitres: 1428, enteredAt: '2026-09-21T00:00:00.000Z',
   engineStartedAt: '2026-09-15T07:15:00.000Z', engineEndedAt: '2026-09-16T09:11:00.000Z',
   energyKwh: 2546, meanLoadKw: 98, peakLoadKw: 169},
];

const id = (job: RealJob): string => `real-job-${job.index}`;

/**
 * The postings, oldest first.
 *
 * `siteId` is `''` where the record names no yard. The type wants a string and the
 * honest value is "no yard on file" — `locationLabel` carries that in words, and an
 * empty id matches no site, which is what stops the site pages claiming this job.
 */
export const REAL_DEPLOYMENTS: ReadonlyArray<Deployment> = JOBS.map((job) => ({
  id: id(job),
  // Filled by the dealer, with every other job, so the register numbers read in one
  // sequence rather than this machine's eight carrying a scheme of their own.
  reference: '',
  siteId: job.siteId ?? '',
  locationLabel: job.locationLabel,
  startsAt: job.startsAt,
  endsAt: job.endsAt,
}));

/**
 * One membership per posting — this machine, alone, on every one of them.
 *
 * `lorryPlate` is empty rather than dealt: the eight other fields here are measured
 * and a hashed plate beside them would be the one invented fact on the record.
 */
export const REAL_MEMBERSHIPS: ReadonlyArray<DeploymentMembership> = JOBS.map((job) => ({
  id: `${id(job)}:${REAL_GENSET_ID}`,
  deploymentId: id(job),
  gensetId: REAL_GENSET_ID,
  lorryPlate: '',
  startFuelLitres: job.startFuelLitres,
  endFuelLitres: job.endFuelLitres,
  collectedAt: null,
}));

/** The engine's real spans, for the run log. Oldest first. */
export const REAL_RUNS = JOBS.map((job) => ({
  id: `${REAL_GENSET_ID}-run-${job.index}`,
  gensetId: REAL_GENSET_ID,
  startedAt: job.engineStartedAt,
  endedAt: job.engineEndedAt,
  energyProducedKwh: job.energyKwh,
  fuelConsumedLitres: job.startFuelLitres - job.endFuelLitres,
  meanLoadKw: job.meanLoadKw,
  peakLoadKw: job.peakLoadKw,
}));

/** When each posting was filed — not on `Deployment`, so keyed beside it. */
export const REAL_ENTERED_AT: ReadonlyMap<string, string> = new Map(
  JOBS.map((job) => [id(job), job.enteredAt]),
);
