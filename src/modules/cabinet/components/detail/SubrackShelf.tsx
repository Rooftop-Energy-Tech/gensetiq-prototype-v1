import {useState} from 'react';

import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmsIn} from '@/modules/site/data/plantAlarms';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {CABINET_SHELVES, bayKey, shelfLayoutFits, shelfPositions} from '../../data/shelfLayout';
import {reportedSlots, subrackModules} from '../../data/subrackModules';
import {cabinetFlowLabel} from '../../types/cabinet.type';
import type {SubrackCabinet} from '../../types/cabinet.type';
import type {SubrackModule} from '../../types/subrackModule.type';
import {SubrackFigure} from './SubrackFigure';
import {SubrackPanel} from './SubrackPanel';
import {SubrackRack} from './SubrackRack';

/**
 * The shelf band: the cabinet drawn front-on, and whichever bay is selected beside it.
 *
 * The site page's `SiteCircuit` in the cabinet's terms — a figure on the left, a
 * panel on the right, one `useState` between them and nothing else. That is
 * deliberate down to the layout: a reader who has clicked a genset on the site
 * diagram already knows how this works, and the two pages having the same shape is
 * worth more than either having a shape of its own.
 *
 * ## The fallback is not dead code
 *
 * `SubrackRack` — the wrapping grid of ten cards this replaced — is still rendered
 * when the elevation does not describe the cabinet in front of it. The drawing is a
 * traced photograph of the `ICC330-H1-C8` at SBH-1336 with six rectifier bays and
 * four SSU bays; the day a second monitoring unit is added to `UNITS` with a
 * different shelf, those bay numbers become confident labels on bays that are not
 * there.
 *
 * A grid that reflows is a worse answer to *which one do I pull* and a perfectly good
 * answer to *what is in this shelf*, so that is what an unrecognised cabinet gets.
 * The alternative — drawing the elevation anyway — trades a real question for a
 * wrong one, and the guard costs one comparison.
 */
export const SubrackShelf = ({cabinet}: {cabinet: SubrackCabinet}) => {
  /**
   * Live, so clearing an `SSU 3 Fault` on the Alarms tab unmarks bay 3 on the way
   * back and empties this panel's cross-reference in the same pass. The two screens
   * are one alarm rather than a copy of it, which is the rule the whole section was
   * rebuilt on.
   */
  const handling = useAlarmHandling();
  const role = useSitePowerRole(cabinet.siteId);
  const modules = subrackModules(cabinet, role, handling);
  const {standing} = plantAlarmQueue(cabinet.siteId, role, 'SITE', handling);

  /**
   * Every `SITE` row this unit publishes, so a bay's panel can print a denominator
   * that is true here rather than the full claim.
   *
   * It moves with the power role, which is the point: flip this site to grid-backed
   * on its settings tab and the AC input bay goes from one watched row to ten,
   * because `AC_SPECS` is only in the catalogue where there is an incomer.
   */
  const catalogue = new Set(
    plantAlarmsIn(cabinet.siteId, role, 'SITE').map((alarm) => alarm.label),
  );

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const selected = picked ?? shelfDefaultBay(cabinet, modules);
  const position = shelfPositions().find((bay) => bay.key === selected);

  /* Not this cabinet's shelf — the elevation would label bays that are not there.
     The grid of cards is the honest answer instead, and it brings its own heading, so
     this returns before drawing one. See the note above. */
  if (!shelfLayoutFits(cabinet) || position === undefined) {
    return <SubrackRack cabinet={cabinet} />;
  }

  /**
   * How many named parts the drawing has, which is the denominator the caption needs.
   *
   * Two kinds of position are excluded and for the same reason: they are not parts.
   * **Blanking plates**, which are metal nobody has identified, and **empty slots** —
   * two of the ETP23006's three inverter bays. Twenty-three positions are drawn, two
   * are blanks and two are empty slots, so nineteen are parts. Counting the other four
   * would put absences in a denominator that exists to say how much of the real
   * hardware anybody is watching, and it would understate the gap rather than state
   * it.
   */
  const parts = CABINET_SHELVES.reduce(
    (total, shelf) =>
      total +
      shelf.positions.filter((bay) => bay.kind !== 'BLANK' && bay.fitted !== false)
        .length,
    0,
  );
  const reported = reportedSlots(modules);

  return (
    <section aria-label="Subrack" className="flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium text-primary">The shelf</h2>
        {/* What the drawing cannot print in its bays, live fact first.

            **Which group is carrying** leads, and it is the one clause here that
            changes minute to minute. It used to be a badge in a band of its own above
            this one, along with the enclosure temperature and a headroom figure; those
            two are columns in the strip at the top of the page and went, and this one
            came down here because it has no other home and because it is a fact about
            the shelf — the bays below agree with it to the kilowatt. In
            `text-secondary` against the rest's tertiary, so the live clause and the
            specification do not read as one sentence.

            Then the make-up, because it is what the page is about. Then how much of it
            the unit reports on individually, which is the shelf's real headline — four
            parts of nineteen, with every rectifier among the fifteen that are silent.
            That ratio is the honest version of a drawing in which most bays look fine
            because nothing is looking at them. */}
        <p className="text-xs text-tertiary">
          <span className="text-secondary">{cabinetFlowLabel(cabinet)}</span>
          {` · ${cabinet.rectifiers} rectifiers of ${cabinet.rectifierKw} kW · ${cabinet.ssus} Solar Supply Units · ${reported} of ${parts} parts reported individually`}
        </p>
      </div>

      {/* 44rem for the drawing, up from 36rem when it became the centrepiece, and it
          is what the design width has to spare: 1440px less the app's rail and the
          section's 334px and the band's own padding leaves 1074px, so 44rem of drawing
          plus the gap still leaves the panel 346px — comfortably over the 20rem that
          `Rows published ── 58 alarm · 22 telemetry` needs.

          `minmax(0, …)` rather than a fixed track, so on a narrower window the drawing
          gives the panel its minimum first instead of pushing the band sideways. One
          column until `xl`, because the two side by side inside those same rails leaves
          the drawing about 300px, and a shelf read through a letterbox is the grid it
          replaced with extra steps. */}
      <div
        className="flex flex-col gap-4 xl:grid xl:items-start xl:gap-6"
        style={{gridTemplateColumns: 'minmax(0, 44rem) minmax(20rem, 1fr)'}}
      >
        <SubrackFigure modules={modules} selected={selected} onSelect={setPicked} />

        <div className="min-w-0">
          <SubrackPanel
            cabinet={cabinet}
            position={position}
            module={modules.find(
              (module) => module.kind === position.kind && module.slot === position.slot,
            )}
            standing={standing}
            catalogue={catalogue}
          />
        </div>
      </div>
    </section>
  );
};

/**
 * Which bay the band opens on.
 *
 * The same rule `siteDefaultDevice` follows, and for its reason: a page should open
 * on whatever a reader would have clicked first. In order of what wins:
 *
 * 1. **A faulted bay.** If the unit is asserting `SSU 2 Fault` then that module is
 *    why anybody opened this page, and making them find it in the drawing first is
 *    the panel arriving one click late.
 * 2. **The first bay of whichever group is carrying.** In daylight that is
 *    `Solar Supply Unit 1` and under a genset it is `Rectifier 1` — either way, the
 *    bay doing the work.
 * 3. **`Rectifier 1`.** When the bank is carrying or the tower is unserved nothing in
 *    the shelf is converting, and the top-left bay is where a person's eye lands.
 */
const shelfDefaultBay = (
  cabinet: SubrackCabinet,
  modules: ReadonlyArray<SubrackModule>,
): string => {
  const faulted = modules.find((module) => module.fault === 'ASSERTED');
  if (faulted !== undefined) return bayKey(faulted.kind, faulted.slot);

  const carrying = modules.find((module) => module.outputKw > 0);
  if (carrying !== undefined) return bayKey(carrying.kind, carrying.slot);

  return cabinet.rectifiers > 0 ? bayKey('RECTIFIER', 1) : bayKey('SSU', 1);
};
