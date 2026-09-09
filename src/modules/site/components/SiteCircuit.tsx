import {useState} from 'react';
import {BoxesIcon, NetworkIcon} from 'lucide-react';

import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';

import type {SiteSummary} from '../data/sites';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {SiteDiagram} from './SiteDiagram';
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
  const [view, setView] = useState<'schematic' | 'plant'>('plant');

  const devices = siteDevices(summary, role);
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
      {/* The switcher sits above the band rather than inside either drawing, because it
          belongs to the band: it changes which projection the left track carries, and
          the card on the right is unaffected — same device, same figures, whichever
          drawing chose it. */}
      <div className="flex justify-center pb-1 xl:justify-start">
        <Tabs value={view} onValueChange={(next) => setView(next as 'schematic' | 'plant')}>
          <TabsList className="w-[70px]">
            {/* `tabIndex` by hand for the reason `PlantToolbar` gives: Radix's
                roving-focus group leaves every trigger at -1 until one is clicked,
                which makes a fresh switcher unreachable by keyboard. */}
            <TabsTrigger
              value="schematic"
              className="flex-1"
              aria-label="Single-line diagram"
              tabIndex={view === 'schematic' ? 0 : -1}
            >
              <NetworkIcon aria-hidden="true" />
            </TabsTrigger>
            <TabsTrigger
              value="plant"
              className="flex-1"
              aria-label="Plant on site"
              tabIndex={view === 'plant' ? 0 : -1}
            >
              <BoxesIcon aria-hidden="true" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div
        className="flex flex-col gap-4 xl:grid xl:items-stretch"
        style={{
          // The schematic is a fixed canvas and asks for its measured width. The plant
          // scene measures whatever it is given and scales the compound to fit, so it
          // takes a share of the row instead — and the larger share, because it is a
          // drawing of objects rather than of boxes and lines: the same figures that are
          // legible in a 88px box need the equipment under them to be big enough to
          // recognise. The card beside it holds at 18rem, which is where its badges stop
          // wrapping one to a line.
          // **One template for both views, and it is the plant view's.** The card on the
          // right used to be sized off whichever drawing was showing, so switching view
          // resized the card and re-flowed its badges — the reader's eye lost the thing
          // they were reading because they changed how they were looking at the site. The
          // schematic is a fixed canvas and simply sits at the left of the wider track,
          // which costs it nothing: it was never going to use the space.
          gridTemplateColumns: 'minmax(34rem, 2.4fr) minmax(18rem, 1fr)',
        }}
      >
        {/* Centred while the band is a column, as the frame centres it, and left in
            its track once it is a row. Handed the width directly rather than sized
            to the drawing: the diagram measures what it is given and scales itself,
            so a wrapper that hugged it would make that circular. */}
        <div className="flex min-w-0 justify-center py-2 xl:justify-start">
          {view === 'schematic' ? (
            <SiteDiagram
              summary={summary}
              dutyId={summary.defaultDutyId}
              role={role}
              selection={{devices, selected, onSelect: setPicked}}
            />
          ) : (
            <SitePlantScene
              summary={summary}
              dutyId={summary.defaultDutyId}
              role={role}
              selection={{devices, selected, onSelect: setPicked}}
              onClear={() => setPicked(undefined)}
            />
          )}
        </div>

        {/* `h-full` on the track and on the card inside it: a stretched grid item is
            only as tall as its row, and the card is its child rather than the item
            itself. Inert in the phone column, where the parent has no height to be a
            fraction of. */}
        <div className="flex h-full min-w-0 flex-col gap-3">
          {selected !== undefined && (
            <SiteDevicePanel summary={summary} role={role} device={selected} now={now} />
          )}
          {/* The trend under the card, or the site's own figures where nothing is picked —
              see `SiteTelemetry`. It is the same slot either way, so clearing a selection
              replaces one reading with another rather than leaving a hole. */}
          <SiteTelemetry summary={summary} role={role} device={selected} now={now} />
        </div>
      </div>
    </section>
  );
};
