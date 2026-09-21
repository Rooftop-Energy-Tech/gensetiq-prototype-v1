import {useMemo, useState} from 'react';

import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {SiteSummary} from '../data/sites';
import {gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {SiteDiagram, siteDiagramWidth} from './SiteDiagram';
import {SiteTelemetry} from './SiteTelemetry';
import {SiteDevicePanel, siteDevices} from './SiteDevicePanel';

/**
 * The page's second band: the single-line diagram, and beside it the detail of
 * whichever device the reader has picked out of it.
 *
 * ## The drawing is the navigation
 *
 * The devices used to be a stack of full-width rows at the foot of the page. Every
 * one of them was a second mention of something the diagram had already drawn, and
 * the two were 900px apart with a chart in between — so the page said "this genset
 * is carrying the site" at the top and "here is that genset" at the bottom, with
 * nothing joining the two but the reader's memory.
 *
 * Clicking the box is that join. It is also the arrangement's one real advantage
 * over a tab strip or a picker: the control is the thing. A reader who wants a set's
 * hours clicks it in the circuit they were already reading, rather than translating
 * it into a label in a list somewhere else on the page.
 *
 * ## The pill picker that stood here in between
 *
 * Two drawings have been through this band and both were removed — the schematic
 * when the telco plant came out, the isometric plant scene because a mast and a row
 * of equipment cabinets draw a *telco* site rather than a yard. What was left was a
 * row of pill buttons: `Site`, then one per set.
 *
 * The schematic is back and the pills are gone with it. Tristan's call, 2026-09-21.
 * The pills were an honest control and they drew nothing — a reader arriving at a
 * site could not see what was feeding it without reading the strip's words, and this
 * band's whole argument is that the picture answers that in one look. Nothing in a
 * single-line diagram is telco: an incomer, an isolator, a set and a load is the
 * electrical truth about a compound whatever the compound is for.
 *
 * `Site` — the picker's first pill, and the way back to the site's own figures — is
 * now a **click on the drawing's background**, which is what the plant scene did with
 * `onClear` while it was here.
 *
 * ## Two columns, and where they stop being two
 *
 * The drawing is a fixed 398px canvas and the panel wants whatever is left. So the
 * left track is sized to `siteDiagramWidth()` and the right takes the remainder, with
 * a floor: a card under about 18rem starts wrapping badges one to a line, which is a
 * worse reading than stacking.
 *
 * `xl` is where that becomes possible rather than a guess. This page carries the
 * global rail *and* the site's own nav, so its content column is about 380px
 * narrower than the viewport: 901px at `xl`, which is 398 for the drawing and ~480
 * for its card. One step down at `lg` it is 645px, and the card is then under its
 * floor. So below `xl` the band folds into a column, the drawing centred over its
 * card, which is the old stack cut to the one device that was asked for.
 *
 * Because the tracks are set in `style` rather than a class, they are also inert in
 * that column: `grid-template-columns` says nothing to a flex container, so one
 * declaration covers both arrangements and neither can drift from the other.
 *
 * ## Why the selection is derived rather than stored
 *
 * `picked` is what the reader last clicked and it is *not* trusted directly — it is
 * checked against the devices that currently exist, and falls back when it is not
 * among them. Three things make that necessary rather than cautious. The Settings
 * tab can change the site's supply. The route can change site under a mounted
 * component, so a key from the previous site would otherwise survive into this one.
 * And a site can have no devices at all, where the answer is `undefined` and the
 * panel says so.
 *
 * Deriving costs one `includes` on a list of at most a handful, and it means there
 * is no effect anywhere that has to notice those changes and correct for them.
 */
export const SiteCircuit = ({
  summary,
  role,
  now,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  now: number;
}) => {
  const [picked, setPicked] = useState<SiteDeviceKey | undefined>(undefined);
  const devices = siteDevices(summary);

  /**
   * What is standing on each box in the drawing — the pills under the node names.
   *
   * A yard can hold several sets, they share the monitoring unit's AC rows, and each
   * box is about one machine — so each takes the union its own page takes, the
   * controller's bits plus the unit's `GENSET` rows. The genset device card is built
   * from the same two calls, so a box and the card it opens count one list. Two sets
   * in one yard therefore both carry the yard's AC rows, which is correct: at a site
   * with no incomer that AC is each engine's own output.
   *
   * The mains has no entry and must not: an incomer is a supply the site is connected
   * to rather than a machine on the books, so there is nothing standing *on* it to
   * count. See `deviceOfSource`.
   */
  const handling = useAlarmHandling();
  const alarms = useMemo(() => {
    const plantStanding = plantAlarmQueue(summary.site.id, role, 'GENSET', handling).standing;

    const byDevice: Partial<Record<SiteDeviceKey, Record<AlertSeverity, number>>> = {};
    for (const {genset} of summary.gensets) {
      byDevice[gensetDeviceKey(genset.id)] = countBySeverity([
        ...standingAlarms(genset.id, handling),
        ...plantStanding,
      ]);
    }

    return byDevice;
  }, [summary, role, handling]);

  /**
   * What the panel is reporting on, or `undefined` for the site's own overview.
   *
   * **Nothing is the default, and it is a state rather than an absence.** The page used to
   * open on whatever was carrying the site, which meant a reader arriving was immediately
   * looking at one machine's card without having asked for it. Cleared means the site's
   * own figures: what is carrying the yard and what it draws, which is the question a
   * reader actually arrives with — and the drawing's background is the way back to it.
   *
   * `picked` is still not trusted directly. The Settings tab can change the supply out from
   * under a selection, and the route can change site under a mounted component, so a key
   * that is no longer among this site's devices falls back to `undefined` — the overview —
   * rather than to another asset the reader never chose.
   */
  const selected = picked !== undefined && devices.includes(picked) ? picked : undefined;

  // A **grid-backed** site with no set still has a circuit worth drawing: mains
  // straight to the load says "on the grid, nothing posted here", which is a real and
  // reassuring state. A **diesel-prime** site with no set has no incomer and no
  // machines, so there is nothing to draw: the diagram would be a load box with a
  // conductor arriving from nowhere.
  if (summary.gensets.length === 0 && role === 'DIESEL_PRIME') {
    return (
      <section aria-label="Site circuit" className="py-2">
        <p className="max-w-sm text-sm text-secondary">
          Nothing supplies this site. It is set to run on its own gensets and none are
          fitted.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Site circuit">
      {/* `items-stretch`, the grid default: the card is shorter than the drawing at a
          multi-set site, and starting it would leave a ragged band with the panel's
          border stopping partway down beside a full-height diagram. Stretched, the two
          read as one band and the card's ground runs the height of the thing it is
          describing. The content stays top-aligned inside the card: it is the *box*
          that grows, not the type. */}
      <div
        className="flex flex-col gap-4 xl:grid xl:items-stretch"
        style={{
          // The drawing is a fixed canvas, so its track is exactly that wide rather
          // than a fraction — it was never going to use more, and a `fr` here would
          // leave it floating in a track it cannot fill. The card takes the rest and
          // holds at 18rem, which is where its badges stop wrapping one to a line.
          gridTemplateColumns: `${siteDiagramWidth()}px minmax(18rem, 1fr)`,
          columnGap: '1.5rem',
        }}
      >
        {/* Centred in its track below `xl`, where the track is the whole column and the
            398px canvas would otherwise sit hard left under a full-width card. Handed
            the width directly rather than sized to the drawing: the diagram measures
            what it is given and scales itself, so a wrapper that hugged it would make
            that circular. */}
        <div className="flex min-w-0 justify-center py-2">
          <SiteDiagram
            summary={summary}
            dutyId={summary.defaultDutyId}
            role={role}
            selection={{devices, selected, onSelect: setPicked}}
            alarms={alarms}
            onClear={() => setPicked(undefined)}
          />
        </div>

        {/* `h-full` on the track and on the card inside it: a stretched grid item is
            only as tall as its row, and the card is its child rather than the item
            itself. Inert in the phone column, where the parent has no height to be a
            fraction of. */}
        <div className="flex h-full min-w-0 flex-col gap-3">
          {/* The trend goes **inside** the card, at its foot: the card is stretched to the
              height of the drawing beside it, and three figures over a large empty panel
              is the worse reading. Where nothing is picked there is no card to sit in, so
              the site's own figures stand as one — see `SiteTelemetry`. */}
          {selected === undefined ? (
            <SiteTelemetry summary={summary} role={role} device={undefined} now={now} />
          ) : (
            <SiteDevicePanel
              summary={summary}
              role={role}
              device={selected}
              now={now}
              telemetry={
                <SiteTelemetry summary={summary} role={role} device={selected} now={now} embedded />
              }
            />
          )}
        </div>
      </div>
    </section>
  );
};
