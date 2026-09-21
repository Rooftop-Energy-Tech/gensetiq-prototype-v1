import type {CabinetPart, PlantAlarmCategory} from '@/modules/site/types/plantAlarm.type';
import type {AlertSeverity} from './alert.type';
import type {AlarmHandling} from './alarmState.type';

/**
 * One row on the Alarms page, whichever device is asserting it.
 *
 * ## Why the tables stopped taking `TrackedAlarm`
 *
 * Because two devices now report on the same machine, and the page has to show
 * both in one list. The genset's own controller raises bits off its register map,
 * and the **site's monitoring unit** watches the AC feeding the rectifiers — which
 * at a site with no utility incomer is this set's own output, so a phase failure
 * there is a dropped phase on this engine.
 *
 * Those two do not share a shape and should not be made to. A controller bit has a
 * threshold on a reading behind it and a protection class from Deep Sea's map; a
 * monitoring-unit register has neither, and carries Huawei's own class instead. The
 * earlier attempt at this put the second kind in a band of its own underneath,
 * which kept the types clean and made a reader scan two lists to answer one
 * question — *what is this set carrying* — with the more serious row possibly in
 * the lower one.
 *
 * So the tables take **the four things a row needs to be rendered and acted on**,
 * and each source adapts into it. Neither source's type has to know the other
 * exists, and there is exactly one table, one ordering and one standing count.
 *
 * ## Why `provenance` is a string and not a device field
 *
 * The line under the name is the row's claim of where it came from, and the two
 * sources say it differently on purpose: a controller bit gives its rule and its
 * coordinates (`< 24 V · register 1299 bit 0`) because a technician at the panel
 * can find that bit on the display, and a monitoring-unit register names the device
 * and its address (`Huawei SMU02C · 0x5009`) because the panel has never heard of
 * it. Modelling that as `{device, register, bit}` would mean the row that has no
 * bit carrying a `null` one, and the page deciding per row which fields to print —
 * which is the same conditional, one level less honest.
 */
export type AlarmView = {
  /**
   * The handling store's key.
   *
   * A controller bit uses its `GensetAlert.id` — `ktb3360-earth-fault`, one machine's
   * instance of a rule. A monitoring-unit row uses its `PlantAlarm.id` —
   * `sbh-1336-5009`, keyed on the **site** rather than the set, because the register
   * is one register: two machines on one yard share the AC bus, and acknowledging a
   * dropped phase from one of their pages has to acknowledge it from the other's.
   */
  id: string;
  /** The alarm's name, as its own device writes it. Never prettified. */
  name: string;
  /** The second line under the name — see the note above. */
  provenance: string;
  /** The protection class, in the asserting device's own vocabulary. */
  className: string;
  severity: AlertSeverity;
  raisedAt: string;
  handling: AlarmHandling;
  /**
   * Which asset this row is about — **only on the site's page**, and absent
   * everywhere else on purpose.
   *
   * An asset's own Alarms tab is already about one of them: the bank's page saying
   * `Battery` against every row would be the page repeating its own title
   * twenty-eight times. The site's page is the one screen where four assets' rows
   * sit in one queue, so it is the one screen where a row has to say which it
   * belongs to — and it is the axis that page's filter works on.
   *
   * The site itself is one of the four, which stretches the word a little: the
   * cabinet's door sensor and the load fuses are the plant a tower stands on rather
   * than a thing on a register of assets. It is the word the product uses for the
   * four things a technician is dispatched to, and one honest word beats two exact
   * ones nobody can keep straight.
   *
   * Optional rather than nullable so the three asset tabs need no change to omit it:
   * there is nothing for them to say here, and `null` would be a field they have to
   * remember to set.
   */
  asset?: PlantAlarmCategory;
  /**
   * Which part of the cabinet this row is about — the site tab's third tier of
   * filter reads it.
   *
   * Absent on every row that is not the monitoring unit's. A genset controller's own
   * bits and this app's derived rules are not about anything in the subrack, and a
   * part on them would be a fact nobody put there. `asset` above is absent for the
   * same reason on a row read outside the site's pooled queue.
   */
  part?: CabinetPart;
};
