import {useState} from 'react';

import type {SiteSummary} from '../data/sites';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {SiteDiagram, siteDiagramWidth} from './SiteDiagram';
import {SiteDevicePanel, siteDefaultDevice, siteDevices} from './SiteDevicePanel';

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

  const devices = siteDevices(summary, role);
  const selected =
    picked !== undefined && devices.includes(picked)
      ? picked
      : siteDefaultDevice(summary, role, devices);

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
      <div
        className="flex flex-col gap-4 xl:grid xl:items-start"
        style={{gridTemplateColumns: `${siteDiagramWidth(role)}px minmax(20rem, 1fr)`}}
      >
        {/* Centred while the band is a column, as the frame centres it, and left in
            its track once it is a row. Handed the width directly rather than sized
            to the drawing: the diagram measures what it is given and scales itself,
            so a wrapper that hugged it would make that circular. */}
        <div className="flex min-w-0 justify-center py-2 xl:justify-start">
          <SiteDiagram
            summary={summary}
            dutyId={summary.defaultDutyId}
            role={role}
            selection={{devices, selected, onSelect: setPicked}}
          />
        </div>

        <div className="min-w-0">
          <SiteDevicePanel summary={summary} role={role} device={selected} now={now} />
        </div>
      </div>
    </section>
  );
};
