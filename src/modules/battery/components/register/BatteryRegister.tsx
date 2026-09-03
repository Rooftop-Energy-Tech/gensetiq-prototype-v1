import {Link} from '@tanstack/react-router';
import {BatteryChargingIcon} from 'lucide-react';
import {useState} from 'react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {SITE_POWER_ROLE_LABEL} from '@/modules/site/types/site.type';
import {useBatteryBanks} from '../../data/banks';
import {BANK_FLOW_LABEL, bankFlow, bankName} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';

/**
 * `/battery` — the bank register.
 *
 * ## What used to be here
 *
 * A `SectionTabs` scaffold: a title, a subtitle counting the estate's storage, and
 * six empty tabs. It was standing in for two different pages at once, exactly as
 * `/solar`'s scaffold was, and its own note said what the fix would be — *"the bank
 * register — a row per bank across both hybrid configurations. Site, usable kWh,
 * hours of autonomy, and the state of charge now."*
 *
 * That is this table, column for column. The six tabs moved down onto a bank, where
 * every one of their `ComingSoon` bodies is finally about the right object.
 *
 * ## Why it sorts by hours left and not by charge
 *
 * Worst first, which is the ranking the sites list uses for condition and the fleet
 * uses for attention. There are no battery *alarms* in this model — nothing raises
 * one — so runtime is the thing here most likely to need somebody tonight, and a
 * register that opened alphabetically would bury the flat bank at position nineteen.
 *
 * It sorted by **charge** first, and that was the wrong key. A percentage is a ratio
 * whose denominator is not in the table: these banks run 38 to 93 kWh at 78 to 98%
 * health, against loads that differ as much again. So two rows both reading `42%`
 * can be four hours apart, and a charge sort files the one that needs a truck
 * tonight next to the one that is fine until Thursday. Hours divide all of that out,
 * which is why the `Charge` cell now prints them under the percentage — a sort key a
 * reader cannot see is a table that looks mis-ordered.
 *
 * **Health is the other column that can be wrong, and it deliberately does not drive
 * the sort.** It moves over years rather than hours, so a health-sorted register
 * would hand back the same order every morning — a ranking with no news in it —
 * while the charge sort changes through the day and is what the page is opened for.
 * Health is a column to *scan*, not to be ranked by, at least until something in
 * this model raises an alarm on it.
 *
 * ## Why there is no toolbar
 *
 * `/solar` has a search box and a sort control because a system has half a dozen
 * things worth sorting by. A bank has a handful of columns and the sort is already
 * on the one that matters; a search field over nine rows would be a control with no
 * question behind it. If this estate grows past a screenful the right move is the
 * solar register's toolbar, lifted whole.
 *
 * ## Why health is not next to charge
 *
 * Two percentage columns touching read as one quantity printed twice, and the
 * misreading they invite is the expensive one — 81% health taken for a worse 81%
 * charge. So health sits at the far end, next to `Autonomy`, where it is next to
 * the figure it actually erodes: the hours in that column are the specification,
 * and health is how much of the specification is still in the cabinet.
 */
const COLUMNS = [
  {label: 'Bank', width: '24%'},
  {label: 'Charge', width: '13%'},
  {label: 'Flow', width: '19%'},
  {label: 'Autonomy', width: '16%'},
  {label: 'Health', width: '13%'},
  {label: 'Configuration', width: '15%'},
] as const;

const byHoursLeft = (banks: Array<BatteryBank>): Array<BatteryBank> =>
  [...banks].sort(
    (left, right) =>
      left.hoursLeft - right.hoursLeft || left.siteName.localeCompare(right.siteName),
  );

export const BatteryRegister = () => {
  // One clock for the page, so every row's charge is read at the same instant —
  // the rule `useSolarSystems` and the site page both follow.
  const [now] = useState(() => Date.now());
  const banks = useBatteryBanks(now);

  const totalKwh = banks.reduce((sum, bank) => sum + bank.kwh, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col items-start gap-0.5 px-4 pt-4 pb-2">
        <h1 className="max-w-full truncate text-base font-medium text-primary">Battery</h1>
        <p className="max-w-full truncate text-sm text-secondary">
          {banks.length} {banks.length === 1 ? 'bank' : 'banks'} ·{' '}
          {Math.round(totalKwh).toLocaleString('en-MY')} kWh usable
        </p>
      </div>

      {banks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-secondary">
          No site on this estate is currently configured with storage.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Battery banks, worst runtime first, with charge and hours left, flow,
              autonomy, state of health and the configuration each was specified for
            </caption>
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.label} style={{width: column.width}} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byHoursLeft(banks).map((bank) => {
                const flow = bankFlow(bank);

                return (
                  <tr key={bank.id}>
                    <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                      <Link
                        to="/battery/$bankId"
                        params={{bankId: bank.id}}
                        className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {bankName(bank)}
                      </Link>
                      <span className="block truncate text-xs text-tertiary">
                        {bank.locationLabel}
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2 tabular-nums">
                      <span className="block text-primary">
                        {Math.round(bank.soc * 100)}%
                      </span>
                      {/* The sort key, shown. See the note above on why it is not
                          the percentage above it. */}
                      <span className="block text-xs text-tertiary">
                        {amount(bank.hoursLeft, 'h', 1)} left
                      </span>
                    </td>

                    <td className="h-13 border-b border-subtle p-2">
                      <Badge variant="secondary" className="whitespace-pre">
                        <BatteryChargingIcon
                          className={flow === 'IDLE' ? 'text-tertiary' : 'text-battery'}
                          aria-hidden="true"
                        />
                        {BANK_FLOW_LABEL[flow]}
                        {flow !== 'IDLE' && (
                          <>
                            <span className="text-secondary"> | </span>
                            {amount(Math.abs(bank.powerKw), 'kW')}
                          </>
                        )}
                      </Badge>
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {amount(bank.autonomyHours, 'h')} from full
                    </td>

                    <td className="h-13 border-b border-subtle p-2 text-primary tabular-nums">
                      {Math.round(bank.soh * 100)}%
                    </td>

                    <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                      {SITE_POWER_ROLE_LABEL[bank.role]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
