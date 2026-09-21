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
 * ## The tank figures are two different kinds of fact
 *
 * `RIQFL001` produced nothing before **18 August**, so only jobs 7 and 8 can have
 * their litres read off the instrument at the window's own edges. The first six
 * carry what Express Mission wrote on the job sheet, and `fuelFrom` says which is
 * which on every row.
 *
 * Where both exist they disagree, and the reason turns out to be instructive. Job 8's
 * sheet closes at 1,428 L where the sensor says 2,136 — but 1,428 is roughly the tank
 * at its **low point before the delivery on the 16th**, not at the end. Somebody read
 * the gauge before the tanker came and wrote that down as the closing figure.
 *
 * Which is the whole argument for `consumedLitres` being stored rather than derived.
 * Job 8 looks like it burned 180 L across its window; it burned **1,237**, because
 * 1,057 went in halfway through. Endpoints cannot see a delivery, and six of these
 * eight jobs have no sensor to find one with.
 *
 * ⚠️ The first six jobs' litres are therefore endpoint arithmetic on hand-written
 * figures, and any refuel inside those windows is invisible. Job 2's 1,348 L against
 * 11,603 kWh is 0.12 L/kWh where a diesel set runs 0.25–0.30, which is very likely a
 * missed fill of about 1,700 L. Do not quote May–June fuel efficiency as a benchmark.
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
  /** Tank level at the posting's edges, litres. */
  startFuelLitres: number;
  endFuelLitres: number;
  /**
   * The lowest the tank reached inside the window, litres — `null` where no sensor
   * was fitted. On a job with a delivery in it this is the number that says how
   * close the machine came to stopping, which neither endpoint can: job 7 opens at
   * 2,026 L and closes at 1,584, and touched **878 L** in between.
   */
  lowFuelLitres: number | null;
  /** Litres delivered inside the window, `null` where there is no sensor to see it. */
  refuelledLitres: number | null;
  /**
   * Litres actually burned — **not** `start − end`.
   *
   * With a delivery in the window those differ by the whole of the delivery: job 8
   * runs 2,316 → 2,136, which looks like 180 L until you count the 1,057 L that went
   * in on the 16th, and the real figure is 1,237. Every job with a refuel in it reads
   * low by exactly the amount delivered if this is derived from the endpoints, which
   * is why it is stored.
   */
  consumedLitres: number;
  /**
   * Where those two litre figures come from, and it is not the same for every job.
   *
   * `telemetry` is the level sensor read at the window's own edges — the truth, and
   * available only for jobs 7 and 8, because `RIQFL001` produced nothing before
   * **18 August**. The first six jobs are `job sheet`: the figures Express Mission
   * wrote down, with no gauge behind them to check against.
   *
   * Kept on the record rather than resolved away, because a reader comparing job 5's
   * "2,100 → 20" against job 8's "2,316 → 2,136" is comparing a written note with an
   * instrument, and nothing else on the page would say so.
   */
  fuelFrom: 'telemetry' | 'job sheet';
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
  /**
   * The controller's own instruments, median across the window.
   *
   * ⚠️ `oilPressureBar` and `batteryVolts` are **divided by ten for every job but
   * the first**. The raw export reads 44 and 294 there; May's rows read 4.0 and 29
   * for the same physical quantities, so a ×10 scale arrived with a firmware change
   * between 20 May and 3 June. Coolant did not move, which is why it is not scaled
   * here. Confirmed with Afifah 2026-09-21 — the battery reads 26–30 V, not 260–300.
   */
  oilPressureBar: number;
  coolantCelsius: number;
  batteryVolts: number;
  /** L1–L2, volts, and the three phase currents in amps. */
  lineVoltage: number;
  phaseCurrentAmps: [number, number, number];
};

const JOBS: ReadonlyArray<RealJob> = [
  {index: 1, siteId: 'pe-026', locationLabel: 'PE Kapar L. Ind Park',
   startsAt: '2026-05-23T02:00:00.000Z', endsAt: '2026-05-23T10:00:00.000Z', enteredAt: '2026-06-19T00:00:00.000Z',
   startFuelLitres: 1970, endFuelLitres: 1848, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 122, fuelFrom: 'job sheet',
   engineStartedAt: '2026-05-23T02:49:09.000Z', engineEndedAt: '2026-05-23T09:25:41.000Z',
   energyKwh: 298, meanLoadKw: 44, peakLoadKw: 58,
   oilPressureBar: 4.4, coolantCelsius: 68, batteryVolts: 28.9,
   lineVoltage: 416, phaseCurrentAmps: [57, 68, 62]},

  {index: 2, siteId: 'pe-027', locationLabel: 'PE Sek Men Vokasional Sg. Buloh',
   startsAt: '2026-06-03T10:00:00.000Z', endsAt: '2026-06-06T04:00:00.000Z', enteredAt: '2026-06-19T00:00:00.000Z',
   startFuelLitres: 1850, endFuelLitres: 502, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 1348, fuelFrom: 'job sheet',
   engineStartedAt: '2026-06-03T10:48:25.000Z', engineEndedAt: '2026-06-06T03:19:42.000Z',
   energyKwh: 11603, meanLoadKw: 179, peakLoadKw: 232,
   oilPressureBar: 4.4, coolantCelsius: 69, batteryVolts: 29.0,
   lineVoltage: 416, phaseCurrentAmps: [268, 294, 197]},

  {index: 3, siteId: 'pe-028', locationLabel: 'PE Taman Pantai Makmur 2',
   startsAt: '2026-06-11T04:00:00.000Z', endsAt: '2026-06-11T15:50:00.000Z', enteredAt: '2026-06-19T00:00:00.000Z',
   startFuelLitres: 2300, endFuelLitres: 1804, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 496, fuelFrom: 'job sheet',
   engineStartedAt: '2026-06-11T04:33:27.000Z', engineEndedAt: '2026-06-11T15:38:36.000Z',
   energyKwh: 1155, meanLoadKw: 104, peakLoadKw: 127,
   oilPressureBar: 4.5, coolantCelsius: 68, batteryVolts: 29.4,
   lineVoltage: 416, phaseCurrentAmps: [156, 137, 174]},

  {index: 4, siteId: null, locationLabel: 'Location not recorded',
   startsAt: '2026-06-18T07:30:00.000Z', endsAt: '2026-06-18T12:00:00.000Z', enteredAt: '2026-06-19T00:00:00.000Z',
   startFuelLitres: 1800, endFuelLitres: 1412, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 388, fuelFrom: 'job sheet',
   engineStartedAt: '2026-06-18T07:44:33.000Z', engineEndedAt: '2026-06-18T11:31:13.000Z',
   energyKwh: 1203, meanLoadKw: 317, peakLoadKw: 433,
   oilPressureBar: 4.2, coolantCelsius: 71, batteryVolts: 29.2,
   lineVoltage: 415, phaseCurrentAmps: [506, 400, 416]},

  {index: 5, siteId: 'pe-029', locationLabel: 'PE Tmn Sementa Jaya',
   startsAt: '2026-06-24T08:10:00.000Z', endsAt: '2026-06-25T14:30:00.000Z', enteredAt: '2026-06-25T00:00:00.000Z',
   startFuelLitres: 2100, endFuelLitres: 20, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 2080, fuelFrom: 'job sheet',
   engineStartedAt: '2026-06-24T08:17:58.000Z', engineEndedAt: '2026-06-25T13:15:46.000Z',
   energyKwh: 4352, meanLoadKw: 347, peakLoadKw: 486,
   oilPressureBar: 4.3, coolantCelsius: 70, batteryVolts: 29.5,
   lineVoltage: 417, phaseCurrentAmps: [472, 506, 493]},

  {index: 6, siteId: 'pe-030', locationLabel: 'PE Pusat Ternakan Itik',
   startsAt: '2026-06-27T20:35:00.000Z', endsAt: '2026-06-29T14:30:00.000Z', enteredAt: '2026-07-01T00:00:00.000Z',
   startFuelLitres: 2200, endFuelLitres: 1623, lowFuelLitres: null,
   refuelledLitres: null, consumedLitres: 577, fuelFrom: 'job sheet',
   engineStartedAt: '2026-06-28T15:39:03.000Z', engineEndedAt: '2026-06-29T14:03:25.000Z',
   energyKwh: 483, meanLoadKw: 41, peakLoadKw: 75,
   oilPressureBar: 4.4, coolantCelsius: 67, batteryVolts: 29.4,
   lineVoltage: 416, phaseCurrentAmps: [75, 76, 69]},

  {index: 7, siteId: 'pe-031', locationLabel: 'PE Alam Perdana No 3',
   startsAt: '2026-09-10T06:40:00.000Z', endsAt: '2026-09-11T15:00:00.000Z', enteredAt: '2026-09-14T00:00:00.000Z',
   startFuelLitres: 2026, endFuelLitres: 1584, lowFuelLitres: 878,
   refuelledLitres: 1362, consumedLitres: 1804, fuelFrom: 'telemetry',
   engineStartedAt: '2026-09-10T06:40:49.000Z', engineEndedAt: '2026-09-11T14:45:54.000Z',
   energyKwh: 5540, meanLoadKw: 172, peakLoadKw: 274,
   oilPressureBar: 4.2, coolantCelsius: 68, batteryVolts: 29.4,
   lineVoltage: 416, phaseCurrentAmps: [256, 218, 238]},

  {index: 8, siteId: null, locationLabel: 'Location not recorded',
   startsAt: '2026-09-15T07:10:00.000Z', endsAt: '2026-09-16T12:00:00.000Z', enteredAt: '2026-09-21T00:00:00.000Z',
   startFuelLitres: 2316, endFuelLitres: 2136, lowFuelLitres: 1282,
   refuelledLitres: 1057, consumedLitres: 1237, fuelFrom: 'telemetry',
   engineStartedAt: '2026-09-15T07:15:58.000Z', engineEndedAt: '2026-09-16T09:11:29.000Z',
   energyKwh: 2546, meanLoadKw: 98, peakLoadKw: 169,
   oilPressureBar: 4.4, coolantCelsius: 68, batteryVolts: 29.4,
   lineVoltage: 417, phaseCurrentAmps: [102, 159, 135]},
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

/**
 * Deliveries into this machine's tank, from the refuel event log.
 *
 * Each is stamped at the moment the fill **completed**, which is what decides the job
 * it belongs to: delivery 4 begins at 22:47 on the 11th — inside job 7's window by
 * thirteen minutes — and finishes the next morning, so it counts against neither job
 * 7 nor job 8, and job 7 carries two deliveries rather than three.
 *
 * ⚠️ Deliveries 1 and 4 bracket a gap in the record — an idle week and a night with
 * the genset off — so their times are approximate and the litres are the sensor's
 * delta across the gap rather than a measured fill. The other three are timed to the
 * minute. Times are UTC; the source log is MYT.
 */
export const REAL_REFUELS: ReadonlyArray<{
  at: string;
  beforeLitres: number;
  afterLitres: number;
  litres: number;
  /** True where the fill spans a gap in the record and its timing is inferred. */
  approximate: boolean;
  note: string;
}> = [
  {at: '2026-09-01T16:00:00.000Z', beforeLitres: 67, afterLitres: 2038, litres: 1971,
   approximate: true, note: 'Fill from near-empty, across an idle week'},
  {at: '2026-09-11T02:32:00.000Z', beforeLitres: 878, afterLitres: 2035, litres: 1158,
   approximate: false, note: 'The 1,300 L nominal fill'},
  {at: '2026-09-11T09:17:00.000Z', beforeLitres: 1728, afterLitres: 1933, litres: 205,
   approximate: false, note: 'Top-up'},
  {at: '2026-09-12T07:02:00.000Z', beforeLitres: 1584, afterLitres: 2354, litres: 770,
   approximate: true, note: 'Morning fill, across a night with the genset off'},
  {at: '2026-09-16T05:02:00.000Z', beforeLitres: 1282, afterLitres: 2339, litres: 1057,
   approximate: false, note: 'The 1,000 L nominal fill'},
];

/** The engine's real spans, for the run log. Oldest first. */
export const REAL_RUNS = JOBS.map((job) => ({
  id: `${REAL_GENSET_ID}-run-${job.index}`,
  gensetId: REAL_GENSET_ID,
  startedAt: job.engineStartedAt,
  endedAt: job.engineEndedAt,
  energyProducedKwh: job.energyKwh,
  fuelConsumedLitres: job.consumedLitres,
  meanLoadKw: job.meanLoadKw,
  peakLoadKw: job.peakLoadKw,
}));

/** When each posting was filed — not on `Deployment`, so keyed beside it. */
export const REAL_ENTERED_AT: ReadonlyMap<string, string> = new Map(
  JOBS.map((job) => [id(job), job.enteredAt]),
);
