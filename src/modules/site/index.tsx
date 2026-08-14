import {useMemo} from 'react';
import {SearchXIcon, SearchIcon} from 'lucide-react';

import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {SITE_SUMMARIES, searchSites, sortSites} from './data/sites';
import {SitesTable} from './components/SitesTable';
import type {SiteSearch} from './types/view.type';

type SitesPageProps = {
  search: SiteSearch;
  /** Patch the URL search params; anything omitted is left as-is. */
  onSearchChange: (next: Partial<SiteSearch>) => void;
};

/**
 * `/sites` — seventeen sites, worst condition first.
 *
 * No view switcher and no preview panel, unlike the fleet screen. A site has no
 * second representation worth building: its position on a map is its gensets'
 * position, which `/gensets?view=map` already draws, and a preview panel would
 * duplicate the site page it links to almost line for line.
 */
export const SitesPage = ({search, onSearchChange}: SitesPageProps) => {
  const {q = ''} = search;

  const summaries = useMemo(() => sortSites(searchSites(SITE_SUMMARIES, q)), [q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      {/* 373px is the design's search width on the fleet screen; the same box for
          the same job. It matches the site's name, its placename, what kind of
          load it carries and the tags standing on it — the last because "which
          site is BRF9540 at" is the question this list gets asked most. */}
      <InputGroup className="w-full max-w-[373px]">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={q}
          onChange={(event) => onSearchChange({q: event.target.value || undefined})}
          placeholder="Site, place or genset tag"
          aria-label="Search sites"
        />
      </InputGroup>

      <div className="min-h-0 min-w-0 flex-1">
        {summaries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 pt-16 text-center">
            <SearchXIcon className="size-6 text-tertiary" aria-hidden="true" />
            <p className="text-sm text-secondary">No sites match “{q}”.</p>
          </div>
        ) : (
          <SitesTable summaries={summaries} />
        )}
      </div>
    </div>
  );
};
