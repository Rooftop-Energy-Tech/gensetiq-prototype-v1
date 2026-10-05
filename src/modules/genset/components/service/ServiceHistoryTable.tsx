import {FileTextIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {REGISTER_FRAME, REGISTER_ROWS, REGISTER_TABLE, REGISTER_TH} from '@/components/global/registerTable';
import {figure, stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {serviceSiteLabel} from '../../data/services';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import type {ServiceRecord, ServiceSchedule} from '../../types/service.type';

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={cn(REGISTER_TH, 'px-3', align === 'right' ? 'text-right' : 'text-left')}
  >
    {children}
  </th>
);

/**
 * The attachment cell.
 *
 * Three states, and the third is the one worth having:
 *
 *  - a seeded record points at a PDF in `public/` and always opens;
 *  - a record logged in this session opens from its object URL;
 *  - a record logged in an *earlier* session has its filename and no file, because
 *    the URL died with the tab that made it.
 *
 * The third renders as the filename in plain text with the reason on hover,
 * rather than a link that does nothing. A dead link is a bug report; a filename
 * that says why it cannot be opened is a known limit of a prototype with no
 * backend, which is what this is.
 */
const AttachmentCell = ({record}: {record: ServiceRecord}) => {
  if (record.document.url === null) {
    return (
      <span
        className="inline-flex items-center gap-2 text-tertiary"
      >
        <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{record.document.fileName}</span>
      </span>
    );
  }

  return (
    <a
      href={record.document.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
    >
      <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{record.document.fileName}</span>
    </a>
  );
};

/**
 * Every service this genset has had, newest first.
 *
 * The four columns are the four facts the app claims on its own account — site,
 * technician, when, and which machine. Everything else a technician recorded is
 * in the attached document, unparsed and unsummarised, because a checklist is a
 * record of somebody's judgement and turning twenty-eight ticks into a
 * green badge would be the app asserting something the paper does not.
 *
 * The genset column is here even though every row is the same genset. It is what
 * makes a row copyable — a service is identified by machine and date, and a
 * screenshot of this table without the machine on it identifies nothing.
 */
/**
 * What a visit did, in words: `Full service` when it did every item, else the
 * items by name. An item since removed from the schedule is left out.
 */
const workDone = (record: ServiceRecord, schedule: ServiceSchedule): string => {
  if (record.itemIds === undefined) return 'Full service';
  if (schedule.items.every((item) => record.itemIds?.includes(item.id))) return 'Full service';
  const names = schedule.items.filter((item) => record.itemIds?.includes(item.id)).map((item) => item.name);
  return names.length === 0 ? '—' : names.join(', ');
};

export const ServiceHistoryTable = ({
  genset,
  records,
  schedule,
}: {
  genset: Genset;
  records: Array<ServiceRecord>;
  /** The schedule, to name the items a visit did. */
  schedule: ServiceSchedule;
}) => (
  <section aria-label="Service history" className="flex flex-col gap-3">
    <h2 className="text-base font-medium text-primary">Service history</h2>

    {records.length === 0 ? (
      <p className="text-sm text-secondary">No services recorded.</p>
    ) : (
      <div className={cn('overflow-x-auto', REGISTER_FRAME)}>
        <table className={cn(REGISTER_TABLE, REGISTER_ROWS)}>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Location</Th>
              <Th>Work done</Th>
              <Th>Technician</Th>
              <Th>Genset</Th>
              <Th align="right">Run hours at service</Th>
              <Th>Report</Th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap text-primary">
                  {stampAt(record.performedAt)}
                </td>
                {/* The site as it was, not as it is — see `ServiceRecord.siteId`.
                    A set that has since moved yards still shows where the work
                    was actually done. */}
                <td className="px-3 py-2.5 text-secondary">{serviceSiteLabel(record.siteId)}</td>
                <td className="max-w-[260px] px-3 py-2.5 text-primary">{workDone(record, schedule)}</td>
                <td className="px-3 py-2.5 text-secondary">{record.technicianName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
                  {gensetName(genset)}
                </td>
                <td className="px-3 py-2.5 text-right text-secondary tabular-nums">
                  {figure(record.engineHoursAtService)} h
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <AttachmentCell record={record} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {records.some((record) => record.notes !== undefined) && (
      <dl className="flex flex-col gap-2 px-1">
        {records
          .filter((record) => record.notes !== undefined)
          .map((record) => (
            <div key={record.id} className="flex flex-wrap gap-x-3 text-xs">
              <dt className="text-secondary">{stampAt(record.performedAt)} · remarks</dt>
              <dd className="text-primary">{record.notes}</dd>
            </div>
          ))}
      </dl>
    )}
  </section>
);
