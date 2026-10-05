import {DATASET} from '@/brands';
import type {DatasetId} from '@/brands';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import type {
  DeploymentBooking,
  DeploymentContact,
  DeploymentNote,
  DeploymentParticulars,
} from '../types/deployment.type';

/**
 * Who hires the gensets, and the seeded contacts and notes on each deployment
 * (2026-09-30).
 *
 * Called `client` in code because `customer` is taken: `site/data/customers.ts` is
 * the division a site belongs to (a network region, a distribution zone). On screen
 * this is **Customer**, the company the deployment is for.
 *
 * Mock companies on mock deployments, dealt by a hash of the deployment id so every
 * reload deals the same ones.
 */
export type DeploymentClient = {id: string; name: string; domain: string};

const CLIENTS: Record<DatasetId, ReadonlyArray<DeploymentClient>> = {
  // A hire fleet on a utility's estate: builders, plants, ports and events.
  // TNB first: its ERQ and PRQ requests are most of Express Mission's work, and the
  // name carries the initials people search by (2026-10-01).
  utility: [
    {id: 'tnb', name: 'Tenaga Nasional Berhad (TNB)', domain: 'tnb.com.my'},
    {id: 'gamuda', name: 'Gamuda Berhad', domain: 'gamuda.com.my'},
    {id: 'ijm', name: 'IJM Construction', domain: 'ijm.com'},
    {id: 'sunway-con', name: 'Sunway Construction', domain: 'sunwayconstruction.com.my'},
    {id: 'wct', name: 'WCT Holdings', domain: 'wct.com.my'},
    {id: 'westports', name: 'Westports Malaysia', domain: 'westportsholdings.com'},
    {id: 'top-glove', name: 'Top Glove Corporation', domain: 'topglove.com'},
    {id: 'sime-darby', name: 'Sime Darby Plantation', domain: 'simedarbyplantation.com'},
    {id: 'mahb', name: 'Malaysia Airports', domain: 'malaysiaairports.com.my'},
    {id: 'pavilion', name: 'Pavilion Events', domain: 'pavilion-events.com.my'},
  ],
  // Backup power on a carrier's network: the operators and the tower companies.
  carrier: [
    {id: 'celcomdigi', name: 'CelcomDigi', domain: 'celcomdigi.com'},
    {id: 'maxis', name: 'Maxis Broadband', domain: 'maxis.com.my'},
    {id: 'umobile', name: 'U Mobile', domain: 'u.com.my'},
    {id: 'edotco', name: 'edotco Malaysia', domain: 'edotcogroup.com'},
    {id: 'tm', name: 'TM Technology Services', domain: 'tm.com.my'},
    {id: 'ytl', name: 'YTL Communications', domain: 'ytlcomms.my'},
    {id: 'sacofa', name: 'Sacofa', domain: 'sacofa.com.my'},
  ],
};

/** The active brand's customers, in picker order. */
export const DEPLOYMENT_CLIENTS: ReadonlyArray<DeploymentClient> = CLIENTS[DATASET.id];

export const clientById = (id: string | null): DeploymentClient | undefined =>
  id === null ? undefined : DEPLOYMENT_CLIENTS.find((client) => client.id === id);

const FIRST = ['Ahmad', 'Nurul', 'Siti', 'Faizal', 'Hafiz', 'Mei Ling', 'Wei Jie', 'Kavitha', 'Rajesh', 'Azlan', 'Farah', 'Daniel'];
const LAST = ['Ismail', 'Rahman', 'Tan', 'Lim', 'Wong', 'Subramaniam', 'Krishnan', 'Hassan', 'Yusof', 'Chong', 'Abdullah', 'Ng'];
const ROLES = ['Site supervisor', 'Project manager', 'Facilities manager', 'Safety officer', 'Site engineer'];

const pick = <T,>(list: ReadonlyArray<T>, id: string, salt: string): T =>
  list[Math.floor(spread(id, salt) * list.length)] as T;

const phone = (id: string, salt: string): string => {
  const prefix = pick(['12', '13', '16', '17', '19'], id, `${salt}/pre`);
  const body = String(Math.floor(spreadBetween(id, `${salt}/num`, 1_000_000, 9_999_999)));
  return `+60 ${prefix}-${body.slice(0, 3)} ${body.slice(3)}`;
};

const contact = (deploymentId: string, index: number, client: DeploymentClient): DeploymentContact => {
  const salt = `contact-${index}`;
  const first = pick(FIRST, deploymentId, `${salt}/first`);
  const last = pick(LAST, deploymentId, `${salt}/last`);
  return {
    id: `${deploymentId}:${salt}`,
    name: `${first} ${last}`,
    role: ROLES[(Math.floor(spread(deploymentId, `${salt}/role`) * ROLES.length) + index) % ROLES.length] as string,
    phone: phone(deploymentId, salt),
    email: `${first}.${last}`.toLowerCase().replace(/\s+/g, '') + `@${client.domain}`,
    primary: index === 0,
  };
};

/** The operations room, who wrote the seeded notes. The reader is never one of them. */
const AUTHORS = [
  {name: 'Aina Rahman', email: 'aina.rahman@ops.example'},
  {name: 'Kumar Selvam', email: 'kumar.selvam@ops.example'},
  {name: 'Lim Wei Jie', email: 'weijie.lim@ops.example'},
];

const NOTE_BODIES = [
  'Gate code 4412. Report to the guardhouse before unloading.',
  'Customer asked for delivery before 8am; lorry booked for 6:30.',
  'Fuel top-up scheduled every Tuesday and Friday.',
  'Access road is soft after rain. Use the north entrance.',
  'Site supervisor confirmed load of about 60% during the day shift.',
  'Customer requested a noise barrier around the genset. Arranged with the depot.',
  'Earth cable replaced on arrival; the old one was damaged in transit.',
  'Extension of two weeks under discussion with the customer.',
];

const DAY = 86_400_000;

const notes = (deployment: DeploymentBooking): Array<DeploymentNote> => {
  // About a third of deployments carry a log.
  if (spread(deployment.id, 'notes/has') >= 0.34) return [];

  const count = 1 + Math.floor(spread(deployment.id, 'notes/count') * 3);
  const start = new Date(deployment.startsAt).getTime();
  const end = Math.min(
    deployment.endsAt === null ? Date.now() : new Date(deployment.endsAt).getTime(),
    Date.now(),
  );
  // A planned deployment's notes are written in the days before it starts.
  const from = start > Date.now() ? Date.now() - 5 * DAY : start;
  const to = start > Date.now() ? Date.now() : Math.max(start, end);

  return Array.from({length: count}, (_, index) => {
    const salt = `note-${index}`;
    const author = pick(AUTHORS, deployment.id, `${salt}/author`);
    const at = from + ((index + spread(deployment.id, `${salt}/at`)) / count) * (to - from);
    return {
      id: `${deployment.id}:${salt}`,
      authorEmail: author.email,
      authorName: author.name,
      createdAt: new Date(at).toISOString(),
      editedAt: null,
      body: pick(NOTE_BODIES, deployment.id, `${salt}/body`),
    };
  });
};

/**
 * How many seeded jobs may be standby (2026-10-01): standby cover is the exception at
 * Express Mission, and a third of the register on it read wrong.
 */
export const MAX_SEEDED_STANDBY = 5;

const work = (
  deployment: DeploymentBooking,
  allowStandby: boolean,
): Pick<DeploymentParticulars, 'jobType' | 'crew'> => {
  const vocabulary = DATASET.work;
  if (vocabulary === undefined) return {jobType: null, crew: []};
  // Once the standby quota is used, the deal is between the request types only.
  const types = allowStandby
    ? vocabulary.jobTypes
    : vocabulary.jobTypes.filter((type) => type.prefix !== undefined);
  // Consecutive names from a seeded start, so nobody holds two roles on one lorry.
  const start = Math.floor(spread(deployment.id, 'work/crew') * vocabulary.crew.length);
  return {
    jobType: pick(types, deployment.id, 'work/type').id,
    crew: vocabulary.crewRoles.map((role, index) => ({
      id: `${deployment.id}:crew-${index}`,
      role,
      name: vocabulary.crew[(start + index) % vocabulary.crew.length] ?? '',
    })),
  };
};

/**
 * A seeded deployment's reference, in its job type's own format (2026-10-01): a
 * request number like `ERQ0065692`, scattered rather than counted because they are
 * TNB's numbers and not ours. A standby job sits on an ERQ or PRQ number too. An
 * estate without job types keeps `DEP-0001`, counted by `ordinal`, oldest first.
 */
export const seedReference = (
  deployment: DeploymentBooking,
  jobType: string | null,
  ordinal: number,
): string => {
  const work = DATASET.work;
  if (work === undefined || jobType === null) return `DEP-${String(ordinal).padStart(4, '0')}`;
  const requests = work.jobTypes.filter((type) => type.prefix !== undefined);
  const prefix =
    work.jobTypes.find((type) => type.id === jobType)?.prefix ??
    pick(requests, deployment.id, 'reference/request').prefix;
  const number = Math.floor(spreadBetween(deployment.id, 'reference', 10_000, 999_999));
  return `${prefix}${String(number).padStart(work.referenceDigits, '0')}`;
};

/**
 * The seeded customer, contacts, notes, job type and crew for one deployment.
 * `allowStandby` is false once `MAX_SEEDED_STANDBY` jobs have been dealt standby.
 */
export const seedParticulars = (
  deployment: DeploymentBooking,
  allowStandby = true,
): DeploymentParticulars => {
  const job = work(deployment, allowStandby);
  // An ERQ or PRQ is a TNB request by definition; standby work is anyone's.
  const issuer = DATASET.work?.jobTypes.find((type) => type.id === job.jobType)?.clientId;
  const client = clientById(issuer ?? null) ?? pick(DEPLOYMENT_CLIENTS, deployment.id, 'client');
  const contactCount = 1 + Math.floor(spread(deployment.id, 'contacts/count') * 3);
  return {
    clientId: client.id,
    contacts: Array.from({length: contactCount}, (_, index) => contact(deployment.id, index, client)),
    notes: notes(deployment),
    pin: null,
    ...job,
  };
};
