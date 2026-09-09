import {Link} from '@tanstack/react-router';
import {SunMediumIcon, ThermometerIcon, TriangleAlertIcon, UtilityPoleIcon} from 'lucide-react';

import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {SiteDeviceCard, SiteDeviceFigures} from '@/modules/site/components/SiteDeviceCard';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {positionAlarmRows} from '../../data/shelfLayout';
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
 * the fitted inverter. Each of those says, in words, that nothing is polled from it —
 * except the four that do carry cross-referenced alarm rows, the three distribution
 * branches and the AC input, which name their rows and say whether any is standing.
 * The two empty inverter slots get a panel of their own saying what could go in
 * them.
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
 * The rows this bay's alarms would appear as, and whether any is standing.
 *
 * Both halves matter and the second is the one usually missing. A bay with two rows
 * watching it and neither asserted has been **checked and found well**; a bay with no
 * rows at all has not been checked. Printing the denominator is what separates them,
 * and it is the same sentence every Alarms tab in this app now ends with.
 */
const BayAlarms = ({
  position,
  standing,
  catalogue,
  cabinetId,
}: {
  position: ShelfPosition;
  standing: ReadonlyArray<AlarmView>;
  catalogue: ReadonlySet<string>;
  cabinetId: string;
}) => {
  /* The claim, narrowed to the rows this site's unit actually publishes.
     `positionAlarmRows` names ten rows against the AC input, nine of which only
     exist where there is an incomer — so an unfiltered denominator would tell a
     reader at a hybrid that ten rows watch a bay when one does. */
  const watched = positionAlarmRows(position).filter((row) => catalogue.has(row));
  if (watched.length === 0) return null;

  const asserted = standing.filter((row) => watched.includes(row.name));

  return (
    <div className="flex flex-col gap-1.5">
      {asserted.map((row) => (
        <Link
          key={row.id}
          to="/cabinet/$cabinetId/alarms"
          params={{cabinetId}}
          className="flex items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-outline"
        >
          <TriangleAlertIcon
            className={cn('size-4 shrink-0', SEVERITY_META[row.severity].textClassName)}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate text-primary">{row.name}</span>
          <span className={cn('shrink-0 text-xs', SEVERITY_META[row.severity].textClassName)}>
            {SEVERITY_META[row.severity].label}
          </span>
        </Link>
      ))}

      <p className="text-xs text-tertiary">
        {asserted.length === 0
          ? `${watched.length === 1 ? 'One row watches' : `${watched.length} rows watch`} this bay and ${watched.length === 1 ? 'it is not' : 'none is'} standing.`
          : `${asserted.length} of ${watched.length} rows against this bay ${asserted.length === 1 ? 'is' : 'are'} standing.`}
      </p>
    </div>
  );
};

/** A bay the gateway is silent about: what it is, and that nothing is read from it. */
const InertBay = ({
  label,
  identity,
  children,
}: {
  label: string;
  identity: string;
  children: ReactNode;
}) => (
  <SiteDeviceCard label={label} identity={identity} badges={<NotPolled />}>
    <p className="max-w-prose text-sm text-secondary">{children}</p>
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
  positionAlarmRows(position).filter((row) => catalogue.has(row)).length;

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
    <BayAlarms
      position={position}
      standing={standing}
      catalogue={catalogue}
      cabinetId={cabinet.id}
    />
  );

  if (module !== undefined) {
    const rectifier = module.kind === 'RECTIFIER';
    const Icon = rectifier ? UtilityPoleIcon : SunMediumIcon;
    const working = module.outputKw > 0;

    return (
      <SiteDeviceCard
        label={rectifier ? 'Rectifier' : 'Solar conversion unit'}
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
            {module.fault === 'ASSERTED' && (
              <Badge variant="secondary" className="whitespace-pre">
                <TriangleAlertIcon className="text-severity-warning" aria-hidden="true" />
                <span className="text-severity-warning">Fault</span>
              </Badge>
            )}
            {module.fault === 'NOT_REPORTED' && (
              <Badge variant="secondary" className="text-tertiary">
                Not reported per bay
              </Badge>
            )}
          </>
        }
      >
        {/* What the module is *for*, before what it is doing.
            The ten bays with readings were the only ones on the drawing with no
            functional description — the inert ones had to explain themselves to
            justify being drawn at all, and the modules were left to be identified by
            their own labels. `Rectifier 3` names a bay; it does not tell a reader
            what would stop working if that bay were empty, and this page is opened by
            people deciding whether to drive out to a site. */}
        <p className="max-w-prose text-sm text-secondary">
          {rectifier
            ? 'An R4875G5: turns the AC arriving at the cabinet — the incomer, or the genset — into the −48 V DC the tower runs on, at 48 V / 75 A and 97% efficient. The shelf load-shares across all six, so each carries a sixth of the load and any one can be pulled hot while the rest hold the site up. The G5 is the variant that holds 57 V constant, which is what the lithium bank needs.'
            : 'An S4875G1, the solar DC/DC module: it takes the string voltage coming off the PV distribution shelf — 58 to 150 V — and converts it to the same −48 V the rectifiers deliver, tracking the array\u2019s maximum power point to better than 99.8% as the light changes. Peak efficiency 98.2%, and it draws under 1.2 W overnight rather than switching off.'}
        </p>

        <SiteDeviceFigures
          figures={[
            {label: 'Delivering now', value: module.outputKw.toFixed(1), unit: 'kW'},
            {label: 'Temperature', value: module.tempC.toFixed(1), unit: '°C'},
          ]}
        />

        <div className="flex flex-col gap-1">
          {/* Rated is the rectifier's alone. An SSU's throughput is the array's, not
              a nameplate the unit publishes, and printing the rectifier's 4 kW
              against it would be the same wrong figure the card rack printed before
              it was corrected. */}
          {/* The conversion in four words, because it is the one fact that separates
              the two kinds of module in this shelf and a reader scanning the spec
              block should not have to infer it from the paragraph above. Both ends
              of both arrows are the same −48 V bus, which is the whole reason these
              two live in one rack. */}
          <MetricRow
            label="Converts"
            value={rectifier ? 'AC → −48 V DC' : 'Array DC → −48 V DC'}
          />
          {/* Both kinds have a rating now. The SSU's used to read `—`, which was
              true when nothing on the cabinet stated one and false as soon as the
              part was identified: an `S4875G1` is 4013 W, datasheet-confirmed, and
              four of them is 16.05 kW against this site's 16.20 kWp array — a DC:AC
              ratio of 1.009, so the stage was sized to the roof. It is still `—` at
              a site whose shelf was sized rather than counted, because there is no
              part there to have a datasheet. See `MonitoringUnit.ssuKw`. */}
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
          <MetricRow label="Part" value={rectifier ? 'R4875G5' : 'S4875G1'} />
          {/* The vendor's word for the bay, which is the whole reason this row is
              here: the metal is silkscreened `PSU` and every screen in this app says
              `Rectifier`, so a person at the open door needs the two joined once. */}
          <MetricRow label="Marked on the shelf" value={rectifier ? 'PSU' : 'SSU'} />
          <MetricRow
            label="Bay identity"
            value={rectifier ? 'Hand-set on the LCD' : 'Read off detection pins'}
          />
        </div>

        {alarms}

        {rectifier ? (
          <>
            <p className="max-w-prose text-xs text-tertiary">
              The rows above are about the{' '}
              <span className="text-secondary">shelf as a group</span> —{' '}
              <span className="text-secondary">Rectifier Abnormal</span> says one of
              the six is unwell without saying which. Rectifier addresses are hand-set
              on the SMU's LCD by watching an indicator blink, nobody has confirmed the
              six here were addressed, and so the thirty per-rectifier registers are
              deliberately unpolled. This bay's number is how a person counts along the
              shelf, not an address the device agreed to.
            </p>

            {/* The shelf's own headroom, which is a fact about the drawing a reader
                cannot get from it: three of the nine positions are empty and this
                elevation only draws the six that are filled. */}
            <p className="max-w-prose text-xs text-tertiary">
              The shelf has{' '}
              <span className="text-secondary">nine rectifier positions</span> and six
              are filled, so 24 kW of the 36 kW it could pass is installed and three
              bays are headroom for more AC rectification. The nine count rectifiers
              only — the solar units sit in positions of their own, which is why six
              plus four was never over-subscribing a nine-slot shelf.
            </p>
          </>
        ) : (
          <p className="max-w-prose text-xs text-tertiary">
            An SSU reads its own bay off detection and power-identifying pins, so{' '}
            <span className="text-secondary">{`SSU ${module.slot} Fault`}</span> is
            about the module in this bay and no other — the one thing the rectifiers
            above cannot say. <span className="text-secondary">SSU Lost</span> beside
            it is about the four as a group. The strings behind this bay are a separate
            row on the array's own tab: the pair being separable is the device's best
            diagnostic here.
          </p>
        )}
      </SiteDeviceCard>
    );
  }

  switch (position.kind) {
    case 'DISTRIBUTION': {
      return (
        <SiteDeviceCard
          label="Distribution"
          identity={`DCDU-600AN1 · branch ${position.slot} of 3`}
          badges={
            <>
              <Badge variant="secondary" className="whitespace-pre">
                200 A
              </Badge>
              <WatchedBy count={watchedCount(position, catalogue)} />
            </>
          }
        >
          <p className="max-w-prose text-sm text-secondary">
            Where the −48 V bus leaves the cabinet. The DCDU-600AN1 has three 200 A
            branches and the unit reports on them together, not one by one.
          </p>
          {alarms}
          <p className="max-w-prose text-xs text-tertiary">
            The register block that would index the branches individually was
            deliberately left out of the poll set: its index runs to six, and nobody
            can yet say whether it counts these three branches or six of the thirteen
            battery modules. A critical row under a possibly-wrong label is the worst
            outcome available.
          </p>
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
          <InertBay label="Monitoring unit" identity="No unit fitted">
            This bay is empty. The shelf's make-up at this site is sized from the
            plant rather than counted off a device, so nothing here reports on the
            cabinet — and nothing in the app has looked inside this box.
          </InertBay>
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
          <p className="max-w-prose text-sm text-secondary">
            Every figure on this page arrives through this bay. The SMU sits on the
            cabinet's internal CAN bus, reads the rectifiers, the SSUs, the bus and the
            enclosure, and publishes them over Modbus to the gateway.
          </p>

          {unit !== undefined && (
            <div className="flex flex-col gap-1">
              <MetricRow label="Gateway" value={unit.gatewayId} />
              <MetricRow label="Poll table" value={`${unit.pollEntries} entries`} />
              <MetricRow
                label="Rows published"
                value={`${unit.alarmRows} alarm · ${unit.telemetryRows} telemetry`}
              />
            </div>
          )}

          <p className="max-w-prose text-xs text-tertiary">
            It is also the one part of this cabinet whose own health the cabinet cannot
            report. If this bay is dead, every reading on this page goes stale rather
            than wrong, and nothing here would say so — the gateway's own liveness is
            the only thing that would.
          </p>
        </SiteDeviceCard>
      );
    }

    case 'AC_INPUT': {
      return (
        <SiteDeviceCard
          label="AC input"
          identity="Incomer and surge arrester"
          badges={<WatchedBy count={watchedCount(position, catalogue)} />}
        >
          {/* Role-neutral on purpose. This said "there is no grid at this site, so
              what arrives here is the genset" — true of the configuration SBH-1336
              is in, and false the moment a reader flips it to grid-backed on the
              settings tab, which they can do in two clicks. `useSitePowerRole` is
              read live precisely so the figures follow that switch, and copy that
              did not follow it with them would be the one thing on the page still
              describing the old configuration. */}
          <p className="max-w-prose text-sm text-secondary">
            Where the AC supply lands before the rectifiers — the incomer at a site
            that has one, and the genset otherwise. Nothing arrives here at all while
            the bank or the array is carrying the tower.
          </p>
          {alarms}
          <p className="max-w-prose text-xs text-tertiary">
            The nine per-phase rows exist only where there is an incomer, so this bay's
            count moves with the site's configuration. The arrester is
            datasheet-confirmed fitted at 30 kA, so a quiet{' '}
            <span className="text-secondary">AC SPD Fault</span> rules out "not fitted"
            — but nothing polled reports its health, so it cannot separate a good
            arrester from an unsupported row. The one thing it would tell you is that
            the plant runs normally while the site stands unprotected.
          </p>
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
        <InertBay label="Genset I/O" identity="GIM01C">
          The genset expansion board, in the upper of the SMU's two slots: it is what
          the plant starts and stops the engine through, and it carries the reset line
          and the fuel-level input. So the diesel side of this site is wired to the
          tower's DC plant through this bay — a fact worth knowing before pulling it.
          Nothing in the poll set addresses the board itself, so a quiet drawing here
          means nobody is looking rather than that it is well.
        </InertBay>
      );

    case 'UIM':
      return (
        <InertBay label="Environment I/O" identity="UIM05B1">
          The sensor and dry-contact board, in the SMU's other slot, sharing one bay's
          height with the GIM above it. The cabinet's door, water and smoke rows arrive
          through contacts on a board like this one, which is what makes it the bay
          those alarms depend on without appearing on it. Its own two temperature
          registers exist in the map at 0x102E and 0x102F and are{' '}
          <span className="text-secondary">not in the poll set</span>, so nothing here
          reports on the board.
        </InertBay>
      );

    case 'CONVERTER':
      return (
        <InertBay label="Auxiliary power" identity="M48500N1">
          Everything else in this shelf converts *into* the −48 V bus; this one
          converts back out of it, at small scale, to run the equipment that cannot
          take −48 V. It takes 40 to 60 V in and gives two 12 V DC outputs at 100 W,
          two 24 V DC at 200 W and four 24 V AC at 200 W, behind its own on/off switch.
          Two must never be paralleled. It is also where the gateway that reads this
          whole page gets its power — regulated 12 V was already in the plant, so
          nothing of ours had to be added to make the cabinet observable. Nothing in
          the poll set addresses the module itself.
        </InertBay>
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
          >
            Nothing is fitted in this slot. The ETP23006-C1A1 takes three 2000 VA
            I23002G1 modules for its full 6 kVA and this cabinet has one, in the slot to
            the left — so the shelf is running at a third of its rating and two more
            could go in without any change to the rack.
          </InertBay>
        );
      }

      return (
        <InertBay
          label="Inverter"
          identity={`ETP23006-C1A1 · slot ${position.slot} of 3`}
        >
          Runs the rack's conversion in reverse and at real scale: −48 V DC back out as
          230 V AC at 50 Hz, through one 63 A output, for the equipment at the site that
          needs mains. The shelf is rated 6 kVA — 4.8 kW — from three 2000 VA I23002G1
          modules, which is what its three slots are, and this cabinet has one of them
          fitted. Its DC input draws up to 120 A at 53.5 V, so a full shelf is a
          material share of what the plant delivers rather than an afterthought.
          Nothing in the poll set addresses it, and no alarm row anywhere in this app is
          about it.
        </InertBay>
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
