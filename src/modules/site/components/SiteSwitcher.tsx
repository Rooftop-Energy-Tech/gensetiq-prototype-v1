import {Link} from '@tanstack/react-router';
import {CheckIcon, ChevronsUpDownIcon} from 'lucide-react';
import {useState} from 'react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import {sortSites, useSiteSummaries} from '../data/sites';
import {useEstateAlarmCounts} from '../data/siteAlarmQueue';
import type {Site} from '../types/site.type';

/**
 * The site rail's header: which site you are on, and a way to any other.
 *
 * ## Why a switcher and not a title
 *
 * Because the design puts a `ChevronsUpDown` glyph on it, and that glyph means one
 * thing. It is also the gesture the page was missing: moving between two sites
 * used to mean going back to `/sites`, finding the row and clicking it — three
 * steps to compare two yards, which is a thing operators do constantly during an
 * incident.
 *
 * ## Why the list is alarm-ordered
 *
 * `sortSites` is the sites list's own ranking — worst standing alarm first, then by
 * name — so the switcher and the list agree about what is urgent. A separately
 * alphabetised menu would be a second opinion about the estate, and the first thing
 * anyone would notice is that the two disagreed.
 *
 * It ranked by the **condition verdict** until 2026-09-14 and now ranks by the queue
 * itself, which is the same change the list made and for the same reason. The counts
 * that do the ranking are not drawn here: the menu is a way *to* a site, and thirteen
 * alarm pills stacked in a 224px popover would be a worse copy of the screen this
 * menu exists to save a trip to.
 *
 * The list is not filtered or searchable. Twenty-five sites fit a scrolling menu,
 * and a search field here would be a second, worse copy of the sites screen's
 * toolbar. If the estate grows past what a menu can hold, the right answer is to
 * send the reader to `/sites` rather than to rebuild it in a popover.
 */
export const SiteSwitcher = ({site}: {site: Site}) => {
  const [open, setOpen] = useState(false);
  const summaries = useSiteSummaries();
  // One reading for as long as the rail is mounted, the rule every `now` in this app
  // follows: a menu that re-derived the estate's queue on each render would reshuffle
  // itself under the pointer.
  const [now] = useState(() => Date.now());
  const counts = useEstateAlarmCounts(now);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-primary">{site.name}</span>
          <span className="truncate text-xs text-secondary">{site.locationLabel}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
      </PopoverTrigger>

      {/* Matched to the trigger's width so the menu reads as the header opening
          rather than as a panel landing on top of it. Capped in height because
          twenty-five rows is taller than a short viewport. */}
      <PopoverContent align="start" className="max-h-80 w-[224px] overflow-y-auto">
        {sortSites(summaries, counts).map((summary) => (
          <Link
            key={summary.site.id}
            to="/sites/$siteId"
            params={{siteId: summary.site.id}}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            <span className="min-w-0 flex-1 truncate">{summary.site.name}</span>
            <CheckIcon
              className={cn(
                'size-4 shrink-0',
                summary.site.id === site.id ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
};
