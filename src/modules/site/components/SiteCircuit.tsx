import {useMemo, useState} from 'react';


import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {SiteSummary} from '../data/sites';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {SitePlantScene} from './SitePlantScene';
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
 * over a tab strip or a picker: the control is the thing. A reader who wants the
 * bank's state of health clicks the bank in the circuit they were already reading,
 * rather than translating it into a label in a list somewhere else on the page.
 *
 * ## Two columns, and where they stop being two
 *
 * The drawing is a fixed canvas — 398px, or 530px once an array adds its own
 * column — and the panel wants whatever is left. So the left track is sized to
 * `siteDiagramWidth` and the right takes the remainder, with a floor: a card under
 * about 20rem starts wrapping badges one to a line, which is a worse reading than
 * stacking.
 *
 * `xl` is where that becomes possible rather than a guess. This page carries the
 * global rail *and* the site's own nav, so its content column is about 380px
 * narrower than the viewport: 901px at `xl`, which is 530 for a solar hybrid's
 * drawing and 355 for its card. One step down at `lg` it is 645px, and there is no
 * honest way to divide that — the diagram alone would take four fifths of it. So
 * below `xl` the band folds into a column, the drawing centred over its card, which
 * is the old stack cut to the one device that was asked for.
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
 * tab can change the site's supply, which takes an array or a bank out from under a
 * selection. The route can change site under a mounted component, so a key from the
 * previous site would otherwise survive into this one. And a site can have no
 * devices at all, where the answer is `undefined` and the panel says so.
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
  /**
   * Which projection of the site the band is showing.
   *
   * **Opens on the plant.** A reader arriving at a site page is asking what is there and
   * what state it is in, and the compound answers that in one look: the cabinets, the set,
   * the frame over them, the tower. The schematic answers the narrower question of what is
   * connected to what, which is what somebody already troubleshooting wants, and it is a
   * click away rather than a second band — two drawings of one site stacked would say
   * everything twice.
   */
  const devices = siteDevices(summary);

  /**
   * What is standing on each box in the drawing — the pills under the node names.
   *
   * **Sliced out of the site's own queue**, exactly as `SiteDevicePanel` does it, and
   * for the identical reason: `useSiteAlarmQueue` is the union the strip at the top of
   * this page counts and the Alarms tab lists, with every row tagged by the asset it
   * belongs to. Slicing it is the one way to get these numbers that cannot disagree
   * with the card this drawing opens, a few hundred pixels to the right. A second call
   * to `assertedPlantAlarms` here would agree today and be a second place for it to
   * stop.
   *
   * One tag each for the array, the bank and the cabinet, because a site has one of
   * each. `SITE` is the cabinet's slice — the category id and the word it prints
   * differ; `plantAlarm.type.ts` says why.
   *
   * **The sets are not sliced that way.** A yard can hold several, they share the
   * monitoring unit's AC rows, and each box is about one machine — so each takes the
   * union its own page takes, the controller's bits plus the unit's `GENSET` rows. The
   * genset device card is built from the same two calls, so a box and the card it opens
   * count one list. Two sets in one yard therefore both carry the yard's AC rows, which
   * is correct: at a site with no incomer that AC is each engine's own output.
   */
  const handling = useAlarmHandling();
  const {standing} = useSiteAlarmQueue(summary.site.id, now);
  const alarms = useMemo(() => {
    const plantStanding = plantAlarmQueue(summary.site.id, role, 'GENSET', handling).standing;

    const byDevice: Partial<Record<SiteDeviceKey, Record<AlertSeverity, number>>> = {
      site: countBySeverity(standing.filter((row) => row.asset === 'SITE')),
    };

    for (const {genset} of summary.gensets) {
      byDevice[gensetDeviceKey(genset.id)] = countBySeverity([
        ...standingAlarms(genset.id, handling),
        ...plantStanding,
      ]);
    }

    return byDevice;
  }, [standing, summary, role, handling]);
  /**
   * What the panel is reporting on, or `undefined` for the site's own overview.
   *
   * **Nothing is the default, and it is a state rather than an absence.** The page used to
   * open on whatever was carrying the site, which meant a reader arriving was immediately
   * looking at one asset's card without having asked for it — and there was no way back to
   * the site as a whole, because every click was a selection. Now the drawing's background
   * clears, and cleared means the site's own figures: what is carrying it, what it draws,
   * what the bank holds. That is the question a reader actually arrives with.
   *
   * `picked` is still not trusted directly. The Settings tab can change the supply out from
   * under a selection, and the route can change site under a mounted component, so a key
   * that is no longer among this site's devices falls back to `undefined` — the overview —
   * rather than to another asset the reader never chose.
   */
  const selected = picked !== undefined && devices.includes(picked) ? picked : undefined;

  // A **grid-backed** site with no set still has a circuit worth drawing: mains
  // straight to the load says "on the grid, no plant fitted", which is a real and
  // reassuring state. So does a **hybrid** — the array and the bank are still there
  // and still carrying. A **diesel-prime** site with no set has no incomer and no
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
      {/* `items-stretch`, which is the grid default and was previously overridden to
          `items-start`. The card is shorter than the drawing at every device — a
          bank's three figures against a 380px canvas — so starting it left a ragged
          band with the panel's border stopping a third of the way down beside a full
          height diagram. Stretched, the two read as one band and the card's ground
          runs the height of the thing it is describing.

          The content stays top-aligned inside the card: it is the *box* that grows,
          not the type, so nothing is centred against the drawing by accident. */}
      <div
        className="flex flex-col gap-4 xl:grid xl:items-stretch"
        style={{
          // The plant scene measures whatever it is given and scales the compound to
          // fit, so it takes a share of the row — and the larger share, because it is a
          // drawing of objects rather than of boxes and lines: the equipment has to be
          // big enough to recognise. The card beside it holds at 18rem, which is where
          // its badges stop wrapping one to a line.
          gridTemplateColumns: 'minmax(34rem, 2.4fr) minmax(18rem, 1fr)',
        }}
      >
        {/* The scene scales the compound to whatever width it is given, so it fills
            the track and has no slack to centre. */}
        <div className="flex min-w-0 justify-center py-2">
          <SitePlantScene
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
              height of the drawing beside it, and on every device but the genset that left
              a large empty panel under three figures. Where nothing is picked there is no
              card to sit in, so the site's own figures stand as one — see
              `SiteTelemetry`. */}
          {selected === undefined ? (
            <SiteTelemetry summary={summary} role={role} device={undefined} now={now} />
          ) : (
            <SiteDevicePanel
              summary={summary}
              role={role}
              device={selected}
              now={now}
              telemetry={
                <SiteTelemetry
                  summary={summary}
                  role={role}
                  device={selected}
                  now={now}
                  embedded
                />
              }
            />
          )}
        </div>
      </div>
    </section>
  );
};
