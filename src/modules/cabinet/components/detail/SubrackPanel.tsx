import {SunMediumIcon, ThermometerIcon, UtilityPoleIcon} from 'lucide-react';

import type {ReactNode} from 'react';

import {AlarmPill} from '@/components/global/AlarmPill';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {SiteDeviceCard, SiteDeviceFigures} from '@/modules/site/components/SiteDeviceCard';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {
  INVERTER_SHELF_PART,
  RECTIFIER_POSITIONS,
  bayAssertedRows,
  bayWatchedRows,
} from '../../data/shelfLayout';
import type {SubrackCabinet} from '../../types/cabinet.type';
import type {ShelfPosition} from '../../types/shelfPosition.type';
import type {SubrackModule} from '../../types/subrackModule.type';

/**
 * What the selected bay is, beside the drawing.
 *
 * ## Why it is the site page's device card and not a card of its own
 *
 * Because it is the same interaction. The site page draws a circuit, a reader clicks
 * a node, and the panel to its right becomes that device — and a reader who has used
 * that page needs no instruction to use this one. `SiteDeviceCard` is that panel's
 * shell, so borrowing it makes the two behave identically for free, in the way
 * `BankAlarms` borrows the genset module's alarm tables rather than growing a second
 * set that could disagree.
 *
 * ## The nine bays with nothing behind them are the reason this exists
 *
 * Ten of the nineteen named parts are modules with readings, and this panel prints
 * them the way the cards it replaced did. The other nine are the interesting part: the
 * three distribution branches, the SMU, the GIM, the UIM, the M48500, the AC input and
 * the fitted inverter. Each of those says that nothing is polled from it — on a badge,
 * once, rather than in a closing sentence on each — except the four that do carry
 * cross-referenced alarm rows, the three distribution branches and the AC input, which
 * name their rows and say whether any is standing. The two empty inverter slots get a
 * panel of their own saying what could go in them.
 *
 * ## Every bay gets one line and then rows
 *
 * The shape is the same whichever bay is picked: a heading, badges, **one sentence**,
 * the readings if there are any, the specification as `MetricRow`s, and the alarm rows
 * that watch it. Nothing on this panel is a paragraph.
 *
 * That is a deliberate reversal. Each bay used to carry a paragraph of function and,
 * under the figures, a second smaller paragraph of caveat, and between them they held
 * every number this page knows — an input range, four output ratings, a hold voltage, a
 * shelf's fill, two register addresses. All of it survived; none of it is a sentence
 * any more. A person reading this has a cabinet door open, and a row is faster to find
 * a number in than a clause is. See `BayLine`, which is where the one-line rule lives
 * so it cannot quietly become two.
 *
 * That is a real answer and not a shrug. The whole alarm model in this app is built
 * on the argument that a quiet row means one of three things — nothing wrong, nothing
 * watching, or nothing fitted — and that presenting the second as the first is the
 * one failure mode worth designing against. Nine parts where a person would
 * reasonably expect a reading and there is none is exactly that situation, drawn to
 * scale, and a click is the cheapest way to say which of the three each one is.
 *
 * The SMU is the bay worth clicking. Every figure on this page arrives through it,
 * and it is the one part of the cabinet whose own health the cabinet cannot report.
 */

/**
 * **How much of this bay is watched, and how much of that is standing.** One sentence.
 *
 * A bay with two rows watching it and neither asserted has been **checked and found
 * well**; a bay with no rows at all has not been checked. Printing the denominator is
 * what separates those two, and it is the same sentence every Alarms tab in this app
 * ends with. That is the whole of what this says now.
 *
 * ## It used to list the rows, and the pills took that over
 *
 * Under this sentence sat one link per standing row — a triangle in the row's severity,
 * the register name, the rank behind it. `AlarmPill` in the badge row at the head of
 * the card now carries exactly that, so the list was the same fact twice on one card,
 * about four rows of specification apart. Jeff had it removed (2026-09-10).
 *
 * What it cost is nothing this panel needed: the pills are links to the same tab, in
 * the same `positionAlarmRows` order, reading the same `bayAssertedRows`. What is kept
 * is the part the pills genuinely cannot say — **the denominator** — because a pill can
 * only exist for a row that is standing, and the honest signal about most bays in this
 * cabinet is that nothing is looking at them at all.
 */
const BayAlarms = ({
  position,
  standing,
  catalogue,
}: {
  position: ShelfPosition;
  standing: ReadonlyArray<AlarmView>;
  catalogue: ReadonlySet<string>;
}) => {
  const watched = bayWatchedRows(position, catalogue);
  if (watched.length === 0) return null;

  /* Only the count is wanted now — the pills name the rows themselves. Still read
     through `bayAssertedRows` rather than counted here, so this sentence and those
     pills can never disagree about how many are standing. */
  const asserted = bayAssertedRows(position, standing, catalogue);

  return (
    <p className="text-xs text-tertiary">
      {asserted.length === 0
        ? `${watched.length === 1 ? 'One row watches' : `${watched.length} rows watch`} this bay and ${watched.length === 1 ? 'it is not' : 'none is'} standing.`
        : `${asserted.length} of ${watched.length} rows against this bay ${asserted.length === 1 ? 'is' : 'are'} standing.`}
    </p>
  );
};

/**
 * The **one line** a bay gets to say what it is, and the only prose on this panel.
 *
 * ## Why one line and not the paragraph it replaced
 *
 * Every bay used to carry a paragraph of function and, under the readings, a second
 * smaller paragraph of caveat — the nine rectifier positions, the detection pins, the
 * register block nobody could name. That was written to answer "what would stop
 * working if this bay were empty", and it answered it at a length nobody reading a
 * shelf with the door open is going to get through.
 *
 * So the facts stay and the sentences go. What was a paragraph is a line; what was a
 * caveat is either a `MetricRow` or nothing. A reader scanning a spec block finds
 * `Converts · Array DC → −48 V DC` faster than they find the same claim in the middle
 * of a sentence, and the numbers that were buried in prose — an input range, four
 * output ratings, a slot count — are worth more as rows than as clauses.
 *
 * It is a component rather than a class string on eleven paragraphs so the rule is
 * enforceable in one place: this renders a line, and there is nowhere in it for a
 * second one to grow back.
 */
const BayLine = ({children}: {children: ReactNode}) => (
  <p className="max-w-prose text-sm text-secondary">{children}</p>
);

/**
 * The `Part number` row, which **every** bay in the shelf carries.
 *
 * ## Why every bay and not only the ones with readings
 *
 * Because it is the row somebody orders a spare against, and a bay with no telemetry
 * is exactly the bay whose part number is hardest to find any other way — nothing
 * about the `GIM01C` reaches this app except the fact that it is a `GIM01C`. Nineteen
 * bays with the row in the same place beats ten with it and nine without.
 *
 * ## Three answers, and they are different claims
 *
 * - **A part number**, from `ShelfPosition.part`, which is the only place one is
 *   written in this app.
 * - **`None fitted`** where the bay is an unpopulated slot. Two of the three inverter
 *   slots are empty, and an empty slot has no part number rather than an unknown one.
 *   What *would* go in it is on the `Takes` row below, so the fact is not lost.
 * - **`Not recorded`** where the bay has a part and nobody wrote it down. One bay: the
 *   AC input, whose arrester is datasheet-confirmed at 30 kA and unnamed. Printed
 *   rather than omitted, because a missing row reads as a bay that has no part number
 *   and this one has a part number nobody has.
 *
 * Which is the same three-way distinction the whole alarm model in this app rests on —
 * nothing wrong, nothing watching, nothing fitted — applied to a spare part.
 */
const partNumberOf = (position: ShelfPosition): string =>
  position.fitted === false ? 'None fitted' : (position.part ?? 'Not recorded');

const PartNumber = ({value}: {value: string}) => (
  <MetricRow label="Part number" value={value} />
);

/**
 * A bay the gateway is silent about: what it is, and its specification as rows.
 *
 * These are the bays with no readings at all, so `MetricRow`s are the whole body —
 * there are no figures to put above them and no alarm rows to put below. Which turns
 * out to suit them: a part nothing is polled from is described entirely by its
 * datasheet, and a datasheet is a table. The `Nothing polled` badge carries what used
 * to be a closing sentence on each of them, so no bay repeats it as a row.
 */
const InertBay = ({
  label,
  identity,
  /** The part number, which every one of these prepends before its own rows. */
  part,
  line,
  rows,
}: {
  label: string;
  identity: string;
  part: string;
  line: string;
  rows: ReadonlyArray<{label: string; value: string}>;
}) => (
  <SiteDeviceCard label={label} identity={identity} badges={<NotPolled />}>
    <BayLine>{line}</BayLine>
    <div className="flex flex-col gap-1">
      <PartNumber value={part} />
      {rows.map((row) => (
        <MetricRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  </SiteDeviceCard>
);

/**
 * `Nothing polled` — and it is only ever true of three bays.
 *
 * The GIM, the M48500 and the inverter. It used to sit on the AC input too, which was
 * flatly wrong: the AC input has one watched row at a hybrid and ten at a grid-backed
 * site, and they were listed directly underneath this badge saying there were none.
 * `WatchedBy` is what that bay gets instead, so the badge and the list beneath it are
 * two readings of the same count rather than two claims.
 */
const NotPolled = () => (
  <Badge variant="secondary" className="text-tertiary">
    Nothing polled
  </Badge>
);

/** How many of a bay's claimed rows this site's unit actually publishes. */
const watchedCount = (position: ShelfPosition, catalogue: ReadonlySet<string>): number =>
  bayWatchedRows(position, catalogue).length;

/**
 * Every standing row against a bay, one pill each, at the head of its panel.
 *
 * Drawn on all four kinds of bay that have rows watching them — the rectifier and SSU
 * modules, the three distribution branches and the AC input — which is exactly the set
 * `BayAlarms` lists at the foot. Wherever the detail names a row, the headline names it
 * too, and neither can name one the other does not: both read `bayAssertedRows`.
 *
 * Nothing when nothing stands, so a healthy bay's badge row is its own facts and not a
 * space where an alarm would go.
 */
const AlarmPills = ({
  rows,
  cabinetId,
}: {
  rows: ReadonlyArray<AlarmView>;
  cabinetId: string;
}) => (
  <>
    {rows.map((row) => (
      <AlarmPill
        key={row.id}
        fault={row}
        to="/cabinet/$cabinetId/alarms"
        params={{cabinetId}}
      />
    ))}
  </>
);

/** `Watched by 10 rows` — the same number `BayAlarms` prints its denominator from. */
const WatchedBy = ({count}: {count: number}) => (
  <Badge variant="secondary" className="whitespace-pre">
    {count === 1 ? 'Watched by 1 row' : `Watched by ${count} rows`}
  </Badge>
);

export const SubrackPanel = ({
  cabinet,
  position,
  module,
  standing,
  catalogue,
}: {
  cabinet: SubrackCabinet;
  position: ShelfPosition;
  module: SubrackModule | undefined;
  standing: ReadonlyArray<AlarmView>;
  /** Every alarm row this site's unit publishes in the `SITE` category. */
  catalogue: ReadonlySet<string>;
}) => {
  const alarms = (
    <BayAlarms position={position} standing={standing} catalogue={catalogue} />
  );

  /* The same rows `BayAlarms` lists at the foot, for the pills at the top — one
     derivation, so the headline and the detail cannot disagree. */
  const assertedRows = bayAssertedRows(position, standing, catalogue);

  if (module !== undefined) {
    const rectifier = module.kind === 'RECTIFIER';
    const Icon = rectifier ? UtilityPoleIcon : SunMediumIcon;
    const working = module.outputKw > 0;

    return (
      <SiteDeviceCard
        label={rectifier ? 'Rectifier' : 'Solar Supply Unit'}
        identity={module.label}
        badges={
          <>
            <Badge variant="secondary" className="whitespace-pre">
              <Icon
                className={
                  working ? (rectifier ? 'text-teal' : 'text-solar') : 'text-tertiary'
                }
                aria-hidden="true"
              />
              {working ? 'Carrying' : 'Standby'}
            </Badge>
            <Badge variant="secondary" className="whitespace-pre">
              <ThermometerIcon className="text-tertiary" aria-hidden="true" />
              {module.tempC.toFixed(1)} °C
            </Badge>
            {/* **One pill per standing row, rank then register.** It said `Critical`
                and nothing else, so a reader looking at a red bay learned how bad it
                was at the top of the card and had to reach `BayAlarms` at the foot to
                learn *what* was wrong. Jeff asked for the title in the pill
                (2026-09-10) and for one pill each where several stand.

                Read from the **alarm rows** rather than from `module.faultSeverity`,
                which is the change that matters. That field is one severity, set by
                `subrackModules` off the bay's own positional row — so it could say
                `Critical` while `SSU Lost` stood alongside `SSU 4 Fault` and the second
                row went unmentioned until the foot of the card. The rows are the
                claim; the field was a summary of the first of them.

                Which also means these appear on bays that have no module at all — the
                distribution branches, the AC input — because those bays have watched
                rows too. `module` here only narrows the *card*, not the pills.

                `positionAlarmRows` order, so a bay's own row leads its group's. The
                badge row wraps, which is what pays for an unknown count. */}
            <AlarmPills rows={assertedRows} cabinetId={cabinet.id} />
            {module.fault === 'NOT_REPORTED' && (
              <Badge variant="secondary" className="text-tertiary">
                Not reported per bay
              </Badge>
            )}
          </>
        }
      >
        {/* What the bay is *for*, in the one line these panels now get. The rest of
            what the paragraph here used to say is in the rows below it, where a
            reader with the door open can find a number without reading a sentence.
            See `BayLine`. */}
        <BayLine>
          {rectifier
            ? "Turns the AC arriving at the cabinet into the −48 V DC the tower runs on."
            : "Turns the array's string voltage into the same −48 V the rectifiers deliver."}
        </BayLine>

        <SiteDeviceFigures
          figures={[
            {label: 'Delivering now', value: module.outputKw.toFixed(1), unit: 'kW'},
            {label: 'Temperature', value: module.tempC.toFixed(1), unit: '°C'},
          ]}
        />

        <div className="flex flex-col gap-1">
          {/* The specification, as rows, because that is what it is.
              Three paragraphs used to carry these numbers in sentences — an input
              range, an efficiency, a hold voltage, a shelf's fill. Each is a label
              and a value, and a reader at the open door wants the value. */}
          {/* The part number first, in the same place it sits on all nineteen bays.
              The conversion used to open this block, on the argument that it is the one
              fact separating the two kinds of module in the shelf — which is still
              true and is still the next row down. What changed is that this row now
              exists on every bay, and a row that moves depending on which bay you
              clicked is a row a reader has to look for. */}
          <PartNumber value={partNumberOf(position)} />
          {/* Both ends of both arrows are the same −48 V bus, which is the whole
              reason these two live in one rack. */}
          <MetricRow
            label="Converts"
            value={rectifier ? 'AC → −48 V DC' : 'Array DC → −48 V DC'}
          />
          {/* Both kinds have a rating. The SSU's used to read `—`, which was true
              when nothing on the cabinet stated one and false as soon as the part was
              identified: an `S4875G1` is 4013 W, datasheet-confirmed, and four of them
              is 16.05 kW against this site's 16.20 kWp array — a DC:AC ratio of 1.009,
              so the stage was sized to the roof. Still `—` at a site whose shelf was
              sized rather than counted, because there is no part there to have a
              datasheet. See `MonitoringUnit.ssuKw`. */}
          <MetricRow
            label="Rated"
            value={
              rectifier
                ? amount(cabinet.rectifierKw, 'kW')
                : cabinet.ssuKw === null
                  ? '—'
                  : amount(cabinet.ssuKw, 'kW', 2)
            }
          />
          <MetricRow
            label={rectifier ? 'Output' : 'String input'}
            value={rectifier ? '48 V · 75 A' : '58–150 V DC at 58 A'}
          />
          <MetricRow
            label="Efficiency"
            value={rectifier ? '97%' : '98.2% peak · MPPT better than 99.8%'}
          />
          {/* The one behaviour of each part that is not on the other. The G5 suffix
              is the whole reason this variant is in the shelf; the SSU's overnight
              draw is why a dark array still costs the bank something. */}
          <MetricRow
            label={rectifier ? 'Holds' : 'Night standby'}
            value={rectifier ? '57 V constant, for the lithium bank' : 'Under 1.2 W'}
          />
          {/* The vendor's word for the bay, which is the whole reason this row is
              here: the metal is silkscreened `PSU` or `SSU` and a person at the open
              door needs that joined to the app's own name once. The solar bay carries
              both — the marking and what it stands for — so the row still names what
              is actually printed on the shelf rather than replacing it with the
              expansion. */}
          <MetricRow
            label="Marked on the shelf"
            value={rectifier ? 'PSU' : 'SSU · Solar Supply Unit'}
          />
          <MetricRow
            label="Bay identity"
            value={rectifier ? 'Hand-set on the LCD' : 'Read off detection pins'}
          />
          {/* The shelf's own fill, which is a fact about the drawing a reader cannot
              get from it: this elevation draws only the positions that are filled.
              Derived rather than written out, so it cannot drift from the count the
              rest of the page prints. The positions count rectifiers only — the solar
              units sit in bays of their own, which is why six plus four was never
              over-subscribing a nine-slot shelf. */}
          {rectifier && (
            <MetricRow
              label="Shelf positions"
              value={`${cabinet.rectifiers} of ${RECTIFIER_POSITIONS} filled · ${amount(
                cabinet.rectifiers * cabinet.rectifierKw,
                'kW',
              )} of ${amount(RECTIFIER_POSITIONS * cabinet.rectifierKw, 'kW')}`}
            />
          )}
        </div>

        {alarms}
      </SiteDeviceCard>
    );
  }

  switch (position.kind) {
    case 'DISTRIBUTION': {
      return (
        <SiteDeviceCard
          label="Distribution"
          identity={`${partNumberOf(position)} · branch ${position.slot} of 3`}
          badges={
            <>
              <Badge variant="secondary" className="whitespace-pre">
                200 A
              </Badge>
              <AlarmPills rows={assertedRows} cabinetId={cabinet.id} />
              <WatchedBy count={watchedCount(position, catalogue)} />
            </>
          }
        >
          <BayLine>
            Where the −48 V bus leaves the cabinet, on three 200 A branches the unit
            reports on together rather than one by one.
          </BayLine>
          <div className="flex flex-col gap-1">
            <PartNumber value={partNumberOf(position)} />
            {/* The same part number on all three cells, which is why the branch number
                is what tells them apart. */}
            <MetricRow label="Branches" value={`3 × 200 A · this is ${position.slot}`} />
            {/* The block that would index the branches individually is out of the
                poll set on purpose: its index runs to six, and nobody can yet say
                whether it counts these three branches or six of the thirteen battery
                modules. A critical row under a possibly-wrong label is the worst
                outcome available, so the row says which it is instead. */}
            <MetricRow label="Per-branch registers" value="Unpolled · index unresolved" />
          </div>
          {alarms}
        </SiteDeviceCard>
      );
    }

    case 'SMU': {
      const unit = monitoringUnit(cabinet.siteId);

      /* `deviceName` and `slaveId` are nullable now that `shelf.ts` gives a cabinet
         to every solar hybrid, and three of the four have no unit. This bay cannot be
         reached at one of them — `shelfLayoutFits` requires `shelf === 'READ'`, so the
         elevation is only drawn where the modules were counted off a device — but the
         type does not know that, and an implication is not a guarantee.
         So it is handled rather than asserted, and handled the way the details band
         handles the same pair: not with an em-dash where a name goes, which reads as a
         unit nobody recorded, but by saying what is true. A drawing showing an SMU bay
         with no SMU in it is exactly the "nothing fitted read as nothing wrong"
         mistake, and this is the one panel that would commit it. */
      if (cabinet.deviceName === null) {
        return (
          <InertBay
            label="Monitoring unit"
            identity="No unit fitted"
            // Not `partNumberOf(position)`. The drawn bay is an `SMU02C` and this is
            // the branch where nothing is in it — `fitted` does not cover the case,
            // because an SMU bay is a part of the shelf rather than one of several
            // identical slots. See the guard above.
            part="None fitted"
            line="This bay is empty, so nothing in the app has looked inside this box."
            rows={[
              {label: "Shelf make-up", value: 'Sized from the plant, not counted'},
              {label: 'Readings from this cabinet', value: 'None'},
            ]}
          />
        );
      }

      return (
        <SiteDeviceCard
          label="Monitoring unit"
          identity={cabinet.deviceName}
          badges={
            cabinet.slaveId === null ? undefined : (
              <Badge variant="secondary" className="whitespace-pre">
                Slave {cabinet.slaveId}
              </Badge>
            )
          }
        >
          <BayLine>Every figure on this page arrives through this bay.</BayLine>

          {unit !== undefined && (
            <div className="flex flex-col gap-1">
              <PartNumber value={partNumberOf(position)} />
              <MetricRow label="Reads" value="Rectifiers · SSUs · bus · enclosure" />
              <MetricRow label="Buses" value="CAN inside the cabinet · Modbus out" />
              <MetricRow label="Gateway" value={unit.gatewayId} />
              <MetricRow label="Poll table" value={`${unit.pollEntries} entries`} />
              <MetricRow
                label="Rows published"
                value={`${unit.alarmRows} alarm · ${unit.telemetryRows} telemetry`}
              />
              {/* The one thing this cabinet cannot tell you about itself. If this bay
                  is dead every reading on this page goes stale rather than wrong, and
                  nothing here would say so — the gateway's own liveness is the only
                  thing that would. Worth a row precisely because it is the gap. */}
              <MetricRow label="Own health" value="Not reported by this cabinet" />
            </div>
          )}
        </SiteDeviceCard>
      );
    }

    case 'AC_INPUT': {
      return (
        <SiteDeviceCard
          label="AC input"
          identity="Incomer and surge arrester"
          badges={
            <>
              <AlarmPills rows={assertedRows} cabinetId={cabinet.id} />
              <WatchedBy count={watchedCount(position, catalogue)} />
            </>
          }
        >
          {/* Role-neutral on purpose. This said "there is no grid at this site, so
              what arrives here is the genset" — true of the configuration SBH-1336
              is in, and false the moment a reader flips it to grid-backed on the
              settings tab, which they can do in two clicks. `useSitePowerRole` is
              read live precisely so the figures follow that switch, and copy that
              did not follow it with them would be the one thing on the page still
              describing the old configuration. */}
          <BayLine>
            Where the AC supply lands before the rectifiers — the incomer at a site that
            has one, the genset otherwise.
          </BayLine>
          <div className="flex flex-col gap-1">
            {/* `Not recorded` here, and it is the only bay in the shelf that says so:
                the arrester is confirmed fitted and nobody wrote down its model. */}
            <PartNumber value={partNumberOf(position)} />
            <MetricRow label="Arrester" value="Fitted at 30 kA, datasheet-confirmed" />
            {/* Which is what makes a quiet `AC SPD Fault` ambiguous: it rules out
                "not fitted" and cannot separate a good arrester from an unsupported
                row. The one thing it would tell you is that the plant runs normally
                while the site stands unprotected. */}
            <MetricRow label="Arrester health" value="Not polled" />
            {/* The nine per-phase rows exist only where there is an incomer, so this
                bay's watched count moves with the site's configuration. */}
            <MetricRow label="Per-phase rows" value="Only where there is an incomer" />
          </div>
          {alarms}
        </SiteDeviceCard>
      );
    }

    /* The two stacked boards in the top-right corner, and they are the reason those
       two bays sit where they do: **both occupy the SMU's own expansion slots.** The
       site record is explicit that only the SMU talks northbound and that these two
       are southbound expansion, which is why the drawing has them immediately beside
       it rather than out among the converters.
       Separate bays because they are separate modules on separate handles, and
       separate panels because "one of the two boards up there" would be the drawing
       admitting it had not looked. */
    case 'GIM':
      return (
        <InertBay
          label="Genset I/O"
          identity={partNumberOf(position)}
          part={partNumberOf(position)}
          line="The board the plant starts and stops the engine through."
          rows={[
            {label: 'Controls', value: 'Start · stop · reset'},
            {label: 'Reads', value: 'Fuel level'},
            {label: 'Slot', value: "Upper of the SMU's two"},
            {label: 'Wires together', value: "The diesel side and the tower's DC plant"},
          ]}
        />
      );

    case 'UIM':
      return (
        <InertBay
          label="Environment I/O"
          identity={partNumberOf(position)}
          part={partNumberOf(position)}
          line="The sensor and dry-contact board the enclosure's alarms arrive through."
          rows={[
            {label: 'Carries', value: 'Door · water · smoke contacts'},
            {label: 'Slot', value: "Lower of the SMU's two, under the GIM"},
            /* In the register map and out of the poll set — the pair of facts that
               makes this bay the one the enclosure rows depend on without appearing
               on it. */
            {label: 'Own temperatures', value: '0x102E · 0x102F, unpolled'},
          ]}
        />
      );

    case 'CONVERTER':
      return (
        <InertBay
          label="Auxiliary power"
          identity={partNumberOf(position)}
          part={partNumberOf(position)}
          line="The one module that converts back out of the −48 V bus rather than into it."
          rows={[
            {label: 'Input', value: '40–60 V DC'},
            {label: 'DC outputs', value: '2 × 12 V at 100 W · 2 × 24 V at 200 W'},
            {label: 'AC outputs', value: '4 × 24 V at 200 W'},
            {label: 'Paralleling', value: 'Never two of these'},
            /* Regulated 12 V was already in the plant, so nothing of ours had to be
               added to make this cabinet observable. */
            {label: 'Powers', value: "The gateway that reads this page"},
          ]}
        />
      );

    case 'INVERTER': {
      /* An empty slot says so, and says which of the three it is.
         This is the one absence in the drawing worth a panel of its own. Every other
         gap is either a part that reports nothing or a blank nobody has identified;
         this is a known slot for a known kind of module with nothing in it, so the
         useful fact is capacity — the shelf takes three inverters and this cabinet
         has one. Nothing else in the app says that. */
      if (position.fitted === false) {
        return (
          <InertBay
            label="Inverter slot"
            identity={`${position.label} of 3 · empty`}
            part={partNumberOf(position)}
            line="Nothing is fitted here, and two more could go in without any change to the rack."
            rows={[
              // What would go in here, from the position's own `part` — the same
              // string the fitted slot names, written once. `Part number` above reads
              // `None fitted` off `fitted`, so the two rows together say the bay takes
              // an I23002G1 and has not got one.
              {label: 'Takes', value: `${position.part ?? 'Unknown part'} · 2000 VA`},
              {label: 'Shelf', value: '1 of 3 fitted, in the slot to the left'},
              {label: 'Rating when full', value: '6 kVA · 4.8 kW'},
            ]}
          />
        );
      }

      return (
        <InertBay
          label="Inverter"
          identity={`${INVERTER_SHELF_PART} · slot ${position.slot} of 3`}
          part={partNumberOf(position)}
          line="Runs the rack's conversion in reverse, for the equipment at the site that needs mains."
          /* Split into the module's figures and the shelf's, which is a correction
             rather than a tidy-up. `6 kVA`, the `53.5 V / 120 A` DC side and the single
             `63 A` output are all the **ETP23006's**, and they sat here unqualified
             beside a `Modules` row — so a bay that holds one 2000 VA module read as
             though it were the thing drawing 120 A. Now the part number names the
             module, `Rated` is the module's own, and everything belonging to the shelf
             says `Shelf`. */
          rows={[
            {label: 'Rated', value: '2000 VA'},
            {label: 'Converts', value: '−48 V DC → 230 V AC at 50 Hz'},
            {label: 'Shelf', value: '3 slots, 1 fitted'},
            {label: 'Shelf rating', value: '6 kVA · 4.8 kW when full'},
            /* A full shelf is a material share of what the plant delivers rather than
               an afterthought, which is the reason the DC side is worth a row. */
            {label: 'Shelf DC input', value: '53.5 V · up to 120 A'},
            {label: 'Shelf AC output', value: '230 V ±3% · one 63 A'},
            {label: 'Alarm rows', value: 'None anywhere in this app'},
          ]}
        />
      );
    }

    /* A module bay with nothing in it, which now happens at three of the four
       cabinets: `SBH-1495` and `SWK-1163` fit five rectifiers into six bays.
       It reaches here rather than the branch above because that branch needs a
       `SubrackModule`, and there is no module to have readings for. Without this case
       the bay fell through to `default` and drew an empty panel — a bay the drawing
       invites you to click and then says nothing about. */
    case 'RECTIFIER':
    case 'SSU': {
      const rectifierBay = position.kind === 'RECTIFIER';
      const fittedCount = rectifierBay ? cabinet.rectifiers : cabinet.ssus;

      return (
        <InertBay
          label={rectifierBay ? 'Rectifier bay' : 'Solar Supply Unit bay'}
          identity={`${position.label} · empty`}
          part={partNumberOf(position)}
          line="Nothing is fitted in this bay, so the shelf is carrying less than its metal takes."
          rows={[
            {label: 'Takes', value: position.part ?? 'Unknown part'},
            {
              label: 'Fitted in this shelf',
              value: rectifierBay
                ? `${fittedCount} of ${RECTIFIER_POSITIONS} positions`
                : `${fittedCount}`,
            },
            /* The reason an empty bay is worth a panel at all: it is headroom, and
               headroom is the fact a person deciding what to take to site wants. */
            {
              label: 'Adding one gives',
              value: rectifierBay
                ? amount(cabinet.rectifierKw, 'kW')
                : cabinet.ssuKw === null
                  ? '—'
                  : amount(cabinet.ssuKw, 'kW', 2),
            },
          ]}
        />
      );
    }

    /* A blank is never selected, so there is nothing to show for one.
       It is drawn and left inert on purpose. Two of the three sit where the
       photograph shows cable entries and a breaker cluster, and the honest thing to
       say about hardware nobody has named is nothing — a panel reading "empty bay"
       would be a confident claim about the one part of this drawing that cannot be
       identified. They hold the bays either side of them in the right place, which
       is the whole of their job. */
    default:
      return null;
  }
};
