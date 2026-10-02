import {amount as baseAmount} from '@/lib/format';

/**
 * Numbers as the Fuel pages write them: a comma and a space between each group of
 * three, `164, 158` (Jeff, 2026-10-01). Every figure in `modules/fuel` goes through
 * these two rather than `toLocaleString` or `lib/format`'s `amount` directly, so the
 * separator is set in one place. The rest of the app keeps the plain comma.
 */
const spaced = (text: string): string => text.replace(/,/g, ', ');

/** `164, 158` — a bare figure. */
export const figure = (value: number): string => spaced(value.toLocaleString('en-MY'));

/** `164, 158 L` — `lib/format`'s `amount`, with the Fuel pages' separator. */
export const amount = (value: number, unit: string, precision = 0): string =>
  spaced(baseAmount(value, unit, precision));
