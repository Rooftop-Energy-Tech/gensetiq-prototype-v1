import {CircleSlashIcon, SunMediumIcon, TriangleAlertIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {amount} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {reportedSlots, subrackModules} from '../../data/subrackModules';
import type {SubrackCabinet} from '../../types/cabinet.type';
import type {SubrackModule, SubrackSlotKind} from '../../types/subrackModule.type';

/**
 * The shelf opened up: one card per module, rectifiers then SSUs.
 *
 * The same element the bank's modules got, for the same reason and with the same
 * argument behind it — a cabinet reading one number cannot show you the module that
 * is about to go. What differs is that this rack has **two kinds** in it, and that
 * only one kind is ever working at a time.
 *
 * ## Why the idle group is drawn and not hidden
 *
 * At SBH-1336 in daylight the array carries the tower through its SSUs and the six
 * rectifiers deliver nothing. Drawing only the working group would answer *what is
 * converting* and lose the question a reader actually opens a cabinet page with,
 * which is *what is in this shelf*. The idle cards read `0.0 kW` and say `standby` in
 * words, because a rectifier passing nothing behind a generating array is the plant
 * working exactly as specified — it is not a fault and must not look like one.
 *
 * It is also the state the source document wants watched: `Low Rectifier Capacity`
 * may be computed from *available* rather than installed output, and with no grid
 * here the shelf is idle most of the day. If that alarm sits asserted while these
 * cards read zero, that is the signature, and the row should be dropped.
 *
 * ## Why half the cards cannot say whether they are healthy
 *
 * Every rectifier reads `not reported`. Rectifier addresses are hand-set on the
 * LCD and nobody has confirmed the six here were addressed, so the thirty
 * per-rectifier alarm registers are deliberately unpolled — "Rectifier 3 Fault"
 * against an unconfirmed address is a real value under a wrong name. SSU identity is
 * positional, so its four rows are trustworthy per slot.
 *
 * Drawing that gap is the point. A rack that left the rectifiers blank would read as
 * six healthy modules, which is precisely the "an alarm reading 0 is ambiguous three
 * ways" mistake the whole alarm model is built to avoid. What the unit *does* report
 * about them is the shelf as a group, and those four rows are on the Alarms tab.
 */

const KIND_META: Record<SubrackSlotKind, {label: string; icon: LucideIcon; tone: string}> = {
  // The incomer's glyph, because that is what a rectifier converts — the same icon
  // the site diagram draws on its mains node and the sites list on its supply badge.
  // `text-teal` is the app's live-conductor colour, which is what a working
  // rectifier is; there is no mains token and a class that resolves to nothing
  // fails silently.
  RECTIFIER: {label: 'Rectifier', icon: UtilityPoleIcon, tone: 'text-teal'},
  SSU: {label: 'Solar Supply Unit', icon: SunMediumIcon, tone: 'text-solar'},
};

/** What the card says under its label, and how loudly. */
const noteFor = (module: SubrackModule): {text: string; kind: 'fault' | 'quiet'} => {
  if (module.fault === 'ASSERTED') return {text: 'fault', kind: 'fault'};
  if (module.fault === 'NOT_REPORTED') return {text: 'not reported', kind: 'quiet'};
  return module.outputKw > 0 ? {text: 'carrying', kind: 'quiet'} : {text: 'standby', kind: 'quiet'};
};

export const SubrackRack = ({cabinet}: {cabinet: SubrackCabinet}) => {
  // Live, so clearing an `SSU 3 Fault` on the Alarms tab unmarks slot 3 on the way
  // back — the two are one alarm and not a copy of it.
  const handling = useAlarmHandling();
  const role = useSitePowerRole(cabinet.siteId);
  const modules = subrackModules(cabinet, role, handling);
  const reported = reportedSlots(modules);

  return (
    <section aria-label="Subrack modules" className="flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium text-primary">The shelf</h2>
        <p className="text-xs text-tertiary">
          {`${cabinet.rectifiers} rectifiers of ${cabinet.rectifierKw} kW · ${cabinet.ssus} Solar Supply Units · ${reported} of ${modules.length} slots reported individually`}
        </p>
      </div>

      {/* `auto-fill` at an 11rem minimum: the band sits inside two rails whose width
          the viewport does not describe, so how many cards fit is a fact about this
          container and nothing else.

          A rem wider than the bank's rack, and the extra rem is `Rectifier 1` — a
          spelled-out name needs more room than `M03`, and at 10rem the figure and
          its note wrapped on every card rather than only on a phone. */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {modules.map((module) => {
          const meta = KIND_META[module.kind];
          const Icon = meta.icon;
          const note = noteFor(module);
          const working = module.outputKw > 0;

          return (
            <li
              key={module.id}
              className={cn(
                'flex flex-col gap-2.5 rounded-md border bg-element p-3',
                note.kind === 'fault' ? 'border-severity-warning/40' : 'border-subtle',
              )}
            >
              {/* The name on a line of its own, and `whitespace-nowrap` so it can
                  never be anything else.

                  It shared this line with the state note and lost: `Rectifier 1`
                  and `not reported` want about 180px between them and a 10rem card
                  has 136px inside its padding, so the name broke after `Rectifier`
                  and the identity of the module read as two lines of nothing. A
                  label is the one thing on a card that must survive every width —
                  everything else on it is only meaningful once you know which slot
                  you are looking at.

                  So the note moved down beside the figure, which is where it
                  belonged anyway: `standby` and `carrying` are statements about the
                  kilowatts, not about the name. */}
              <span className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-secondary">
                <Icon
                  className={cn('size-3.5 shrink-0', working ? meta.tone : 'text-tertiary')}
                  aria-hidden="true"
                />
                {module.label}
              </span>

              {/* The output as the card's headline, the way charge is the bank
                  module's: it is the one figure that says whether this slot is doing
                  anything, and the note beside it says why. `sr-only` on the subject
                  because "1.0 kW" alone is a number with no owner.

                  `flex-wrap` rather than a second guess at the widths: at a card
                  wide enough the figure and its note sit on one line, and at the
                  narrowest they stack, without either being truncated. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <p className="flex items-baseline gap-0.5">
                  <span className="sr-only">{meta.label} output</span>
                  <span
                    className={cn(
                      'text-lg leading-7 font-semibold',
                      working ? 'text-primary' : 'text-tertiary',
                    )}
                  >
                    {module.outputKw.toFixed(1)}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      working ? 'text-primary' : 'text-tertiary',
                    )}
                  >
                    kW
                  </span>
                </p>

                {note.kind === 'fault' ? (
                  <Badge variant="secondary" className="gap-1">
                    <TriangleAlertIcon className="text-severity-warning" aria-hidden="true" />
                    <span className="text-severity-warning">{note.text}</span>
                  </Badge>
                ) : (
                  // Not a badge. A pill is how this app draws a state worth acting
                  // on, and `standby` and `not reported` are neither — one is the
                  // plant working and the other is the absence of a claim.
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs whitespace-nowrap',
                      module.fault === 'NOT_REPORTED' ? 'text-tertiary' : 'text-secondary',
                    )}
                  >
                    {module.fault === 'NOT_REPORTED' && (
                      <CircleSlashIcon className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    {note.text}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <MetricRow label="Type" value={meta.label} />
                <MetricRow label="Temp" value={`${module.tempC.toFixed(1)} °C`} />
                {/* An em dash on the SSUs rather than the rectifier's rating, which
                    is the rule the array's equipment band follows: `rectifierKw` is
                    the shelf's AC→DC module and nothing states what a conversion
                    unit is rated at. Printing 4 kW here would invent a nameplate,
                    and inventing it on the half of the shelf whose modules the site
                    is actually running on is the worst place to do it. */}
                <MetricRow
                  label="Rated"
                  value={module.kind === 'RECTIFIER' ? amount(cabinet.rectifierKw, 'kW') : '—'}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
