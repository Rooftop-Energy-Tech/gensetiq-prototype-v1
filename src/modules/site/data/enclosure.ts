import {spread} from '@/modules/genset/data/spread';

/**
 * How warm an enclosure on a tower is running, °C.
 *
 * ## Why this is site data and not battery or cabinet data
 *
 * Because there are **two** enclosures at an instrumented site and the rule is the
 * same for both. The `ICC330-H1-C8` holds the rectifier shelf, the SSUs, the
 * distribution unit and the monitoring unit itself; the `ESC330-D6` cabinets beside
 * it hold the battery modules. Neither owns the other, and a copy of this in each
 * module would be a second chance for the two to drift apart — which matters here
 * more than usual, because the whole reason both print a temperature is that a
 * reader compares them.
 *
 * They are separately ventilated boxes, so they are given **separate salts** and
 * separate duty. Same rule, two enclosures, two answers — a subrack idling at a
 * tenth of its rating and a battery cabinet taking charge are not the same
 * temperature and must not read as one.
 *
 * ## Nothing here has been measured
 *
 * There is no temperature anywhere in this model to derive an enclosure's from. The
 * monitoring unit at the one instrumented site polls two probes for the **battery**
 * and nothing for the subrack, and the other twenty-four sites have no probe at all.
 * So this is a baseline stated as a baseline rather than dressed up as a reading:
 * an ambient the enclosure sits in, plus a rise for how hard it is working.
 *
 * The range is what a ventilated equipment cabinet on a Malaysian tower actually
 * runs at. Ambient in Sabah and Sarawak sits in the high twenties day and night, and
 * a fan-cooled or heat-exchanged enclosure holds a couple of degrees above it. Drawn
 * from the id and the salt so a given box reads the same figure on every visit.
 */
const COOLEST_C = 27;
const WARMEST_C = 32;

/**
 * How much a box warms itself at full continuous throughput, °C.
 *
 * Applied in proportion to what it is **actually** passing against what it could,
 * which on this estate means the term is nearly always small: a bank rated at half
 * its energy in kilowatts floating a 4 kW tower, or a 24 kW rectifier shelf against
 * the same tower, are both working at under a fifth of what they can do, so they
 * contribute a degree rather than six.
 *
 * That is the honest answer and not a disappointing one. It is why the spread
 * *within* an enclosure is what a reader is actually looking at, and why a plant
 * being hammered — a load-shed event, a genset carrying everything at noon — would
 * visibly stand out instead of being lost in a baseline.
 */
const FULL_DUTY_RISE_C = 6;

/**
 * @param id    The site the enclosure stands on, so a box reads the same every visit.
 * @param salt  Which enclosure — two boxes on one pad must not share an ambient.
 * @param duty  What it is passing against what it could, `0`–`1`. Clamped, so a
 *              caller dividing by a rounded nameplate cannot push it past full.
 */
export const enclosureTempC = (id: string, salt: string, duty: number): number => {
  const ambient = COOLEST_C + spread(id, salt) * (WARMEST_C - COOLEST_C);
  return ambient + Math.min(1, Math.max(0, duty)) * FULL_DUTY_RISE_C;
};
