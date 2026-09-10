import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {PlantAlarmCategory} from '../types/plantAlarm.type';

/**
 * **A demo fixture, and nothing more.** It is not a claim about any device.
 *
 * ## What it is for
 *
 * The part cards — junction boxes on the array page, modules on the bank page — mark a
 * faulted part in the severity's own edge, tint, badge and chip glyph, all read from one
 * `SEVERITY_META` entry. On the live estate you can only ever see one of the three.
 *
 * Both rows that mark a part are Huawei class `MA`: `PV N Array Fault` is generated from
 * one spec per conversion unit, `Lithium Battery N Abnormal` from one spec per module, and
 * `SEVERITY_OF_HUAWEI` maps `MA` to `CRITICAL`. So every faulted part on every site is red,
 * and the warning and neutral treatments have no way to appear on a screen anybody can
 * open — which makes them the two that quietly rot.
 *
 * Jeff asked to see all three, on every array and every bank (2026-09-10).
 *
 * ## Why it is not a rerank
 *
 * `PlantAlarmSpec` has a `reranked: {to, why}` field for exactly the case where this app's
 * ranking should differ from Huawei's, and **nothing in the catalogue sets it**. It is the
 * wrong tool here. Both row families are generated from a single spec and differ only by
 * *which unit they watch*, so ranking module 2 a warning and module 3 a note would assert
 * that the same BMS fault matters less on one module than another. That is a false
 * statement about the SMU02C, in the file whose whole job is to model it faithfully — and
 * it would move severity counts on every site in the estate.
 *
 * So the catalogue is untouched and this sits outside it.
 *
 * ## Why it lives behind `assertedPlantAlarms` and not in the racks
 *
 * Because a fixture applied where a part card reads it, rather than where the rows come
 * from, makes the page contradict itself. The array page reads its rows in two places —
 * the alarm queue and `systems.ts`, which counts them to floor `downStrings` — and the
 * bank page in four: `faultedModules`, `BankAlarms`, `BankHome`'s strip counts, and the
 * site's own alarm list. Override one and a card shows a fault chip beside `4 of 4
 * delivering`, or a rack marks three modules while the strip above it counts one.
 *
 * `assertedPlantAlarms` is the one function all six of those go through, so that is where
 * this is consulted. Nothing downstream knows the fixture exists.
 *
 * ## What it changes and what it does not
 *
 * For a category it names, it **replaces** that category's asserted rows rather than
 * editing them — well-defined for both, because each is the only row family in its
 * category. It also steps around `dealt`, which is the point for the bank: `groupOf` files
 * all thirteen module addresses as one group, so the real dealing can never stand more
 * than one module row, and one module is not a severity showcase.
 *
 * Untouched: the register catalogue, `SEVERITY_OF_HUAWEI`, the Huawei class each row still
 * publishes, the `SITE` and `GENSET` categories, and any site with no monitoring unit.
 * `PlantAlarmCatalogue` — the page that lists the register map itself — reads the catalogue
 * and still shows every one of these rows as `MA`/critical, which is correct: that page
 * documents the device, and this one dresses a demo.
 *
 * ## Turning it off
 *
 * Set `DEMO_SEVERITY_SHOWCASE` to `false`. Every category falls back to what the catalogue
 * deals and nothing else has to change. To drop one category, delete its entry.
 */
const DEMO_SEVERITY_SHOWCASE = true;

/**
 * The three ranks on the first three units of each family, in order — so the treatments
 * land on adjacent cards and can be read against each other rather than hunted for.
 *
 * First three rather than spread out, because comparing them is the whole purpose, and the
 * parts past them stay clean as controls: every array on the estate has at least six
 * junction boxes and every bank at least seven modules.
 *
 * A site publishing fewer units than there are ranks simply shows fewer — the lookup misses
 * and that rank is skipped, rather than a row being invented for a unit the catalogue does
 * not publish.
 */
const DEMO_RANKS: Partial<
  Record<PlantAlarmCategory, ReadonlyArray<{label: string; severity: AlertSeverity}>>
> = {
  SOLAR: [
    {label: 'PV 1 Array Fault', severity: 'CRITICAL'},
    {label: 'PV 2 Array Fault', severity: 'WARNING'},
    {label: 'PV 3 Array Fault', severity: 'NEUTRAL'},
  ],
  BATTERY: [
    {label: 'Lithium Battery 1 Abnormal', severity: 'CRITICAL'},
    {label: 'Lithium Battery 2 Abnormal', severity: 'WARNING'},
    {label: 'Lithium Battery 3 Abnormal', severity: 'NEUTRAL'},
  ],
};

/** The ranks this category is dressed with, or `undefined` to leave it to the catalogue. */
export const demoRanksFor = (
  category: PlantAlarmCategory,
): ReadonlyArray<{label: string; severity: AlertSeverity}> | undefined =>
  DEMO_SEVERITY_SHOWCASE ? DEMO_RANKS[category] : undefined;

/**
 * How an invented row names itself — `(test) Lithium Battery 2 Abnormal`.
 *
 * **The marker leads because a trailing one does not survive the card.** A fault chip has
 * about 109px of text at five cards across; `PV 2 Array Fault` is about 98px of it, so
 * `PV 2 Array Fault (test)` truncates to `PV 2 Array Fault (tes…`, cutting off precisely
 * the caveat it exists to make. Leading with it means the register name is what gets cut,
 * and the tooltip still carries the whole string.
 *
 * This deliberately breaks the rule both racks state — *publish the label the gateway
 * publishes, exactly, because that raw string is what the Alarms tab lists and what history
 * is keyed on*. Breaking it is the point: these rows are **not** what the gateway
 * publishes, and a demo row that names itself like a real one is the failure this marker
 * prevents. The break stays consistent, because `name` is set once on the view and every
 * surface reads that one field, so the card, the Alarms tab and the site list still agree
 * with each other.
 *
 * `faultedBoxes` and `faultedModules` both step over a leading `(...)` before reading the
 * unit index, because which part a row is about is a property of the register and not of
 * how the row is labelled.
 */
export const demoTestName = (label: string): string => `(test) ${label}`;
