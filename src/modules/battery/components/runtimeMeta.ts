import {lightToken} from '@/styles/colors';
import type {BatteryBank} from '../types/bank.type';

/**
 * How much of the night a bank could carry, as three buckets — the register's map
 * scale and the dot beside its charge figure.
 *
 * ## Why runtime and not charge
 *
 * `BatteryRegister` sorts by hours left and argues the case there: *"a percentage is
 * a ratio whose denominator is not in the table… so two rows both reading `42%` can
 * be four hours apart, and a charge sort files the one that needs a truck tonight
 * next to the one that is fine until Thursday."* A map coloured by state of charge
 * would make exactly that mistake in a form a reader cannot check — a pin has no
 * denominator to print — so the pins carry the same quantity the sort does.
 *
 * ## Why not state of health
 *
 * It is the bank's other percentage and the other column that can be wrong, and it
 * deliberately drives neither the sort nor the pins. Health moves over years, so a
 * map of it would hand back the same picture every morning; runtime changes through
 * the day and is what somebody opens this screen to see.
 *
 * ## Where the two lines are
 *
 * The model puts `hoursLeft` between about 1.3 and 12.3 hours — `autonomyHours` is
 * specified at 10–20, state of charge is held between 0.42 and 0.88, and the bottom
 * quarter of the pack is not the tower's to spend (see `SHED_FLOOR`). The thresholds
 * are operational rather than statistical:
 *
 *  - **under 3 hours** is a bank that will not see the morning on its own. If the
 *    genset does not start or the sun does not come up on schedule, this is the site
 *    that drops — it is tonight's problem.
 *  - **3 to 8 hours** carries the night and not the day after it. Worth knowing
 *    about, nobody is driving out for it.
 *  - **8 hours and up** is a bank doing its job.
 *
 * They are also picked so that the estate reliably has one of each to look at, which
 * is the same thing `isSilent` does when it chooses its salt: a seeded estate exists
 * to show a reader every state the app can draw.
 *
 * The three tokens are `CONDITION_META`'s, so a low bank here is the same red as a
 * critical genset two screens over. `mapColor` is a literal rather than a token name
 * because MapLibre evaluates paint properties in a shader, where
 * `var(--severity-ok)` means nothing.
 */
export const BANK_RUNTIMES = ['LOW', 'FAIR', 'GOOD'] as const;

export type BankRuntime = (typeof BANK_RUNTIMES)[number];

/** Hours. See the note above for why the lines are here. */
const LOW_HOURS = 3;
const FAIR_HOURS = 8;

export const bankRuntime = (bank: BatteryBank): BankRuntime => {
  if (bank.hoursLeft < LOW_HOURS) return 'LOW';
  if (bank.hoursLeft < FAIR_HOURS) return 'FAIR';
  return 'GOOD';
};

export const BANK_RUNTIME_META: Record<
  BankRuntime,
  {label: string; detail: string; dotClassName: string; mapColor: string}
> = {
  LOW: {
    label: 'Low',
    detail: `Under ${LOW_HOURS} hours left`,
    dotClassName: 'bg-severity-critical',
    mapColor: lightToken['severity-critical'],
  },
  FAIR: {
    label: 'Fair',
    detail: `${LOW_HOURS}–${FAIR_HOURS} hours left`,
    dotClassName: 'bg-severity-warning',
    mapColor: lightToken['severity-warning'],
  },
  GOOD: {
    label: 'Good',
    detail: `Over ${FAIR_HOURS} hours left`,
    dotClassName: 'bg-severity-ok',
    mapColor: lightToken['severity-ok'],
  },
};
