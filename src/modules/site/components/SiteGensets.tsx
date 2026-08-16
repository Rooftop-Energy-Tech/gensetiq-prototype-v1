import {useState} from 'react';
import {BoomBoxIcon, MapPinIcon, PlusIcon, XIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {deployGenset, useFleet} from '@/modules/genset/data/deployment';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import type {Genset} from '@/modules/genset/types/genset.type';
import {siteLabel} from '../data/siteSeed';
import type {SiteSummary} from '../data/sites';

/**
 * Which gensets stand at this site — and the control that changes it.
 *
 * The Settings tab's original placeholder promised exactly this, and it is the other
 * half of what a site *is*: a place, and the machines on it. The power role above
 * says how the yard is fed; this says what is in it.
 *
 * ## Attaching moves the machine
 *
 * A site is a customer's **yard**, not a folder — `fleet.ts` puts co-sited units
 * within a hundred metres of each other because that is what being at the same site
 * means. So attaching is a lorry, not a checkbox: the set takes on the site's
 * placename and a spot in its yard, and its pin moves on the fleet map.
 *
 * That consequence is written on the control rather than left to be discovered.
 * Somebody attaching a Penang set to a Petaling Jaya site is relocating it, and a
 * picker that quietly did so while claiming to "add" would be lying about the
 * biggest thing it does.
 *
 * **Detaching moves nothing.** The set stops being part of this installation and
 * goes to the depot; it is still standing in the yard until somebody collects it.
 *
 * ## Why other sites' sets are in the picker
 *
 * Because the alternative is worse. Restricting it to the depot would make every
 * transfer a two-step errand across two pages, and the intermediate state — a set
 * belonging nowhere — is one nobody asked for. Listing them with `Move from Hosp-006`
 * on the button keeps the one step while making it impossible to take a set off
 * another site without reading that you are doing it.
 */

/** Tag, model and run state — the three facts every row here leads with. */
const GensetIdentity = ({genset}: {genset: Genset}) => {
  const meta = RUN_STATE_META[genset.runState];
  const Icon = meta.icon;

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-highlight">
        <BoomBoxIcon className="size-[18px] text-secondary" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-primary">{genset.tag}</span>
        <span className="truncate text-[13px] leading-[18px] text-secondary">{genset.model}</span>
      </span>
      <Badge variant="element" className="ml-1 shrink-0 border-subtle">
        <Icon className={cn('size-3', meta.iconClassName)} aria-hidden="true" />
        {meta.label}
      </Badge>
    </span>
  );
};

export const SiteGensets = ({summary}: {summary: SiteSummary}) => {
  const all = useFleet();
  const [picking, setPicking] = useState(false);

  const {site, gensets} = summary;

  /**
   * Everything not already here, depot first.
   *
   * Depot leads because it is the cost-free choice — taking a set from there changes
   * one site, taking one from another yard changes two.
   */
  const candidates = all
    .filter((genset) => genset.siteId !== site.id)
    .sort(
      (left, right) =>
        Number(left.siteId !== null) - Number(right.siteId !== null) ||
        left.tag.localeCompare(right.tag),
    );

  const attach = (gensetId: string) => {
    deployGenset(gensetId, site.id);
    setPicking(false);
  };

  return (
    <section aria-labelledby="gensets-installed" className="flex flex-col gap-5 px-6 py-7">
      <div className="flex flex-col gap-1">
        <h2 id="gensets-installed" className="text-sm font-medium text-primary">
          Gensets installed
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          The machines standing at {site.name}. Attaching one deploys it here — it takes this
          site's location and moves on the fleet map. Detaching sends it to the depot; nothing
          physically moves until somebody collects it.
        </p>
      </div>

      <div className="flex max-w-3xl flex-col gap-2">
        {gensets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
            No gensets are installed here. This site has no standby plant of its own.
          </p>
        ) : (
          gensets.map(({genset}) => (
            <div
              key={genset.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-element p-3"
            >
              <GensetIdentity genset={genset} />

              <span className="flex shrink-0 items-center gap-3">
                {/* Worth saying before somebody detaches it. The site's draw and its
                    whole diagram hang off whichever set is on the bus. */}
                {genset.id === summary.defaultDutyId && (
                  <span className="text-[13px] text-secondary">on the bus</span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deployGenset(genset.id, null)}
                    >
                      <XIcon aria-hidden="true" />
                      Detach
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-64">
                    Send {genset.tag} to the depot. It stays where it is standing — only its
                    membership of {site.name} ends.
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
          ))
        )}
      </div>

      {picking ? (
        <div className="flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-primary">Attach a genset</p>
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>

          <p className="flex items-center gap-2 text-[13px] leading-[18px] text-secondary">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Attaching moves the set to {site.locationLabel}.
          </p>

          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
              Every genset in the fleet is already here.
            </p>
          ) : (
            // Capped and scrollable: with 24 units in the fleet this list is most of
            // them, and a settings section should not push its own controls off the
            // page to show a menu.
            <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {candidates.map((genset) => (
                <li
                  key={genset.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-element p-3"
                >
                  <GensetIdentity genset={genset} />

                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] text-secondary">
                      {genset.siteId === null ? 'In the depot' : genset.locationLabel}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => attach(genset.id)}>
                      <PlusIcon aria-hidden="true" />
                      {/* Naming the site a set is being taken from is the whole
                          reason other sites' units are listed at all. */}
                      {genset.siteId === null ? 'Attach' : `Move from ${siteLabel(genset.siteId)}`}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setPicking(true)}>
          <PlusIcon aria-hidden="true" />
          Attach a genset
        </Button>
      )}
    </section>
  );
};
