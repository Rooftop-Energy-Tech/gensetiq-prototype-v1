/** Display formatters. Kept free of React so they're trivially testable. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "57 minutes ago" — the phrasing used throughout the genset detail panel.
 *
 * Deliberately not `Intl.RelativeTimeFormat` with a fixed unit: telemetry ages
 * span seconds (a genset reporting now) to days (one that dropped off the
 * network), and a single unit reads badly at one end or the other.
 */
export const relativeTime = (iso: string, now: number = Date.now()): string => {
  const elapsed = now - new Date(iso).getTime();

  // Clock skew, or a device whose RTC runs fast. Don't render "-3 minutes ago".
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(elapsed / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/**
 * "3 mins" / "2 hrs" / "4 days" — telemetry age, without the "ago".
 *
 * The genset home page's connectivity badge reads `Online  |  3 mins`, where the
 * pipe already supplies the relationship. `relativeTime()` above would put a
 * second one in with "ago" and make the badge two words too long for its 24px
 * pill.
 */
export const age = (iso: string, now: number = Date.now()): string => {
  const elapsed = Math.max(0, now - new Date(iso).getTime());

  if (elapsed < MINUTE) return 'live';

  const [count, unit] =
    elapsed < HOUR
      ? [Math.floor(elapsed / MINUTE), 'min']
      : elapsed < DAY
        ? [Math.floor(elapsed / HOUR), 'hr']
        : [Math.floor(elapsed / DAY), 'day'];

  return `${count} ${unit}${count === 1 ? '' : 's'}`;
};

/** "1763L (72%)" — litres remaining plus the percentage of tank capacity. */
export const fuelLevel = (litres: number, capacityLitres: number): string => {
  const percent = capacityLitres > 0 ? Math.round((litres / capacityLitres) * 100) : 0;
  return `${Math.round(litres).toLocaleString('en-MY')}L (${percent}%)`;
};

/** Fraction of tank remaining, clamped to 0–1 for use as a bar width. */
export const fuelFraction = (litres: number, capacityLitres: number): number => {
  if (capacityLitres <= 0) return 0;
  return Math.min(1, Math.max(0, litres / capacityLitres));
};

/**
 * "1,763 L  |  72%" — the fuel headline on the genset home page.
 *
 * Deliberately not `fuelLevel()` above: that one is a table cell and reads
 * "1763L (72%)" to stay narrow. This one is a 16px figure with room to breathe,
 * and the design separates the two halves with a spaced pipe rather than
 * parentheses because neither number is subordinate to the other.
 */
export const fuelHeadline = (litres: number, capacityLitres: number): string => {
  const percent = capacityLitres > 0 ? Math.round((litres / capacityLitres) * 100) : 0;
  return `${Math.round(litres).toLocaleString('en-MY')} L  |  ${percent}%`;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * "8:09 9 Aug 2026" — a run's start and end stamps.
 *
 * Hand-assembled rather than `Intl.DateTimeFormat`: the design writes the hour
 * unpadded ("8:09", not "08:09") and the day unpadded, and no locale gives that
 * combination. `en-GB` comes closest and still pads the hour.
 */
export const stampAt = (iso: string): string => {
  const at = new Date(iso);
  const minute = String(at.getMinutes()).padStart(2, '0');
  return `${at.getHours()}:${minute} ${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
};

/** "01 Jul 2026" — a date with no time of day, e.g. "Refuel by". */
export const stampDate = (iso: string): string => {
  const at = new Date(iso);
  return `${String(at.getDate()).padStart(2, '0')} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
};

/**
 * "12 hours", "45 minutes", "3 days 4 hours" — how long a run has lasted.
 *
 * Minutes are dropped once the run passes an hour, and hours once it passes a
 * day. An operator reading "time running" wants the magnitude, and a genset that
 * has been turning for three days does not need the odd 37 minutes spelled out.
 */
export const duration = (milliseconds: number): string => {
  const minutes = Math.floor(Math.max(0, milliseconds) / MINUTE);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    const head = `${hours} hour${hours === 1 ? '' : 's'}`;
    return rest === 0 ? head : `${head} ${rest} minute${rest === 1 ? '' : 's'}`;
  }

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const head = `${days} day${days === 1 ? '' : 's'}`;
  return rest === 0 ? head : `${head} ${rest} hour${rest === 1 ? '' : 's'}`;
};

/**
 * A telemetry value with its unit — "1,763 L", "24.2 L/hr", "0.94".
 *
 * `precision` is carried on the reading rather than inferred from the value:
 * 24.0 L/hr must still render as "24.0", or a rate that happens to land on a
 * whole number looks like it is measured to a coarser resolution than its
 * neighbours in the same list.
 */
export const amount = (value: number, unit: string, precision = 0): string => {
  const figure = value.toLocaleString('en-MY', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  if (unit === '') return figure;
  // Percent is the exception to the space: "89%", not "89 %". SI units take a
  // thin gap by convention and `%` does not — it reads as a typo.
  return unit === '%' ? `${figure}%` : `${figure} ${unit}`;
};
