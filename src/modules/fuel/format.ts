/**
 * Numbers as the Fuel pages write them: a comma and a space between each group of
 * three, `164, 158` (Jeff, 2026-10-01). The Fuel pages set that separator first;
 * since 2026-10-05 it is the whole app's, and lives in `lib/format`. This file stays
 * as the import every Fuel component already names, re-exporting rather than
 * re-spacing, so a figure is never spaced twice (`164,  158`).
 */
export {amount, figure} from '@/lib/format';
