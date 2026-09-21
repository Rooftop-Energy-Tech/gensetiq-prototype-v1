import {useState} from 'react';


import {cn} from '@/lib/utils';
import type {SiteSummary} from '../data/sites';
import {gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import type {SitePowerRole} from '../types/site.type';
import {SiteTelemetry} from './SiteTelemetry';
import {SiteDevicePanel, siteDevices} from './SiteDevicePanel';

/**
 * The page's second band: which machine is being reported on, and its detail.
 *
 * ## It used to be a drawing
 *
 * Two of them, in fact. A single-line schematic saying what was connected to what,
 * and an isometric scene of the compound — the pad, the cabinet line-up, the set and
 * the mast over them — with a switcher between. Clicking an object selected it, and
 * the argument for that arrangement was that the control *is* the thing: a reader who
 * wants a machine's detail clicks it in the picture they were already reading, rather
 * than translating it into a label in a list.
 *
 * Both are gone. A mast, a DC bus and a row of telco equipment cabinets draw a **telco
 * site**, and this product posts a genset to a yard whatever the yard is there for —
 * a substation, a quarry, a construction compound. A drawing that is wrong about the
 * place is worse than no drawing, however good the navigation argument was.
 *
 * So the selection is a picker again. It costs the join the drawing gave for free, and
 * that is a real loss rather than a neutral swap — worth revisiting if a genset-estate
 * drawing is ever worth making. What it buys is a band that does not claim this fleet
 * lives on telecom towers.
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
  const devices = siteDevices(summary);

  /**
   * What the panel is reporting on, or `undefined` for the site's own overview.
   *
   * **Nothing is the default, and it is a state rather than an absence.** The page used to
   * open on whatever was carrying the site, which meant a reader arriving was immediately
   * looking at one machine's card without having asked for it. `Site` is the first entry in
   * the picker and the one it opens on: what is carrying the yard and what it draws, which
   * is the question a reader actually arrives with.
   *
   * `picked` is still not trusted directly. The Settings tab can change the supply out from
   * under a selection, and the route can change site under a mounted component, so a key
   * that is no longer among this site's devices falls back to `undefined` — the overview —
   * rather than to another asset the reader never chose.
   */
  const selected = picked !== undefined && devices.includes(picked) ? picked : undefined;

  // A **grid-backed** site with no set is still worth reporting on: mains carrying the
  // load says "on the grid, nothing posted here", which is a real and reassuring state.
  // A **diesel-prime** site with no set has no incomer and no machines, so there is
  // nothing to report: no supply, and no posting to read figures off.
  if (summary.gensets.length === 0 && role === 'DIESEL_PRIME') {
    return (
      <section aria-label="Site plant" className="py-2">
        <p className="max-w-sm text-sm text-secondary">
          Nothing supplies this site. It is set to run on its own gensets and none are
          fitted.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Site plant" className="flex flex-col gap-4">
      {/* The picker the drawing used to be.
          
          There was an isometric scene here — the pad, the cabinet line-up, the set and
          the tower over them — and clicking an object selected it. It is gone: a radio
          mast and a row of telco equipment cabinets draw a *telco* site, and this
          product posts a genset to a yard whatever the yard is for.

          What the scene did besides look like the place was pick a device, so that is
          what stands in its place. `Site` leads, then one entry per machine standing
          here. No alarm pills on it: the card below already leads with the selected
          machine's, and a second copy in the control would be the same count in two
          places on one band. Only where there is a choice — a yard with one set gets
          its card directly, because a one-option control implies options that do not
          exist, which is the rule `TrendPanel` follows. */}
      {devices.length > 1 && (
        <nav
          aria-label="Site plant"
          className="flex h-9 w-fit items-center rounded-lg bg-inset p-[3px]"
        >
          {[undefined, ...devices].map((device) => {
            const active = device === selected;

            return (
              <button
                key={device ?? 'site'}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(device)}
                className={cn(
                  'flex h-full cursor-pointer items-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-subtle bg-highlight text-primary'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {device === undefined
                  ? 'Site'
                  : (summary.gensets.find(({genset}) => gensetDeviceKey(genset.id) === device)
                      ?.genset.tag ?? 'Genset')}
              </button>
            );
          })}
        </nav>
      )}

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
    </section>
  );
};
