import type {Genset} from '../../types/genset.type';
import {engineHoursOf, useServiceRecords, useServiceStatus} from '../../data/services';
import {LogServiceDialog} from './LogServiceDialog';
import {ServiceDueHero} from './ServiceDueHero';
import {ServiceHistoryTable} from './ServiceHistoryTable';
import {ServiceScheduleCard} from './ServiceScheduleCard';

/**
 * The Service tab — is this genset due, and what has been done to it.
 *
 * Three bands, in the order the questions get asked:
 *
 *  1. **Is it due, and on which counter.** Both counters, at the same size.
 *  2. **What is it measured against.** The two intervals, editable.
 *  3. **What has actually been done.** The log, and the documents behind it.
 *
 * Band 2 is a setting and nothing else. It briefly also carried the arithmetic
 * behind the counters — the meter now, the meter at the last service, the date
 * of it — on the theory that a counter is more trustworthy when its inputs are
 * visible. All three were already on the page: the hero states the result and
 * the history table carries the hour reading and date of every service including
 * the newest, so the middle band was re-stating its neighbours rather than
 * adding to them.
 */
export const GensetService = ({genset}: {genset: Genset}) => {
  const status = useServiceStatus(genset.id);
  const records = useServiceRecords().filter((record) => record.gensetId === genset.id);
  const engineHours = engineHoursOf(genset.id);

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-medium text-primary">Service</h1>
        <LogServiceDialog genset={genset} currentEngineHours={engineHours} />
      </div>

      <ServiceDueHero status={status} />

      <ServiceScheduleCard gensetId={genset.id} schedule={status.schedule} />

      <ServiceHistoryTable genset={genset} records={records} />
    </div>
  );
};
