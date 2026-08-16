import {FileTextIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {stampAt} from '@/lib/format';
import {siteLabel} from '@/modules/site/data/siteSeed';
import {gensetName} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import type {ServiceRecord} from '../../types/service.type';

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
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
        title="Attached in an earlier session. The file itself is not stored — this prototype keeps records but not documents."
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
export const ServiceHistoryTable = ({
  genset,
  records,
}: {
  genset: Genset;
  records: Array<ServiceRecord>;
}) => (
  <section aria-label="Service history" className="flex flex-col gap-3">
    <h2 className="text-base font-medium text-primary">Service history</h2>

    {records.length === 0 ? (
      <p className="max-w-prose text-sm text-secondary">
        No services have been recorded against this genset. Logging one sets the baseline both
        counters measure from.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-xs text-secondary">
              <Th>Service date</Th>
              <Th>Site</Th>
              <Th>Technician</Th>
              <Th>Genset</Th>
              <Th align="right">Hours at service</Th>
              <Th>Report</Th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-subtle last:border-b-0">
                <td className="px-3 py-2.5 font-medium whitespace-nowrap text-primary">
                  {stampAt(record.performedAt)}
                </td>
                {/* The site as it was, not as it is — see `ServiceRecord.siteId`.
                    A set that has since moved yards still shows where the work
                    was actually done. */}
                <td className="px-3 py-2.5 text-secondary">{siteLabel(record.siteId)}</td>
                <td className="px-3 py-2.5 text-secondary">{record.technicianName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
                  {gensetName(genset)}
                </td>
                <td className="px-3 py-2.5 text-right text-secondary tabular-nums">
                  {record.engineHoursAtService.toLocaleString('en-MY')} h
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
