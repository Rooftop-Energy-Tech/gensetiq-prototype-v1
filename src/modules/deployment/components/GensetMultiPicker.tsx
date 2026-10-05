import {useState} from 'react';
import {CheckIcon, ChevronDownIcon, SearchIcon, XIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {dayMonth, figure, fuelLevel} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useFleet} from '@/modules/genset/data/deployment';
import type {Genset} from '@/modules/genset/types/genset.type';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import {conflictFor} from '../data/store';
import type {DeploymentBooking} from '../types/deployment.type';

/** Great-circle distance in km: a lorry's distance is longer, but the order is the same. */
const distanceKm = (from: {latitude: number; longitude: number}, to: Genset): number => {
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLon = (to.longitude - from.longitude) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

/**
 * Pick the gensets for a new deployment (2026-09-30). Searchable by plate or model,
 * several at once, nearest to the address first. A set already booked over the
 * chosen dates is listed greyed out with the deployment in its way, because "why
 * isn't BRU 3805 here" is the question a dispatcher asks next.
 */
export const GensetMultiPicker = ({
  selected,
  onChange,
  dates,
  origin,
}: {
  selected: Array<string>;
  onChange: (gensetIds: Array<string>) => void;
  /** The draft's dates, which decide who is free. */
  dates: DeploymentBooking;
  /** The draft's position, for distance. `undefined` until an address is chosen. */
  origin: {latitude: number; longitude: number} | undefined;
}) => {
  const fleet = useFleet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const rows = fleet
    .map((genset) => ({
      genset,
      conflict: conflictFor(genset.id, dates),
      km: origin === undefined ? undefined : distanceKm(origin, genset),
    }))
    .filter(({genset}) => {
      const needle = query.trim().toLowerCase();
      return (
        needle === '' ||
        gensetLabel(genset).toLowerCase().replace(/\s/g, '').includes(needle.replace(/\s/g, '')) ||
        genset.model.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      // Busy sets sink; the rest run nearest first, or by plate before an address.
      if ((a.conflict === undefined) !== (b.conflict === undefined)) {
        return a.conflict === undefined ? -1 : 1;
      }
      if (a.km !== undefined && b.km !== undefined) return a.km - b.km;
      return gensetLabel(a.genset).localeCompare(gensetLabel(b.genset));
    });

  const byId = new Map(fleet.map((genset) => [genset.id, genset]));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((each) => each !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            id="new-deployment-gensets"
            type="button"
            className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-default bg-element px-3 text-left text-sm shadow-xs outline-none focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand"
          >
            <span className={cn(selected.length === 0 ? 'text-tertiary' : 'text-primary')}>
              {selected.length === 0
                ? 'Choose gensets'
                : `${selected.length} ${selected.length === 1 ? 'genset' : 'gensets'} selected`}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0">
          <div className="flex items-center gap-2 border-b border-subtle px-3">
            <SearchIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plate or model"
              aria-label="Search plate or model"
              className="h-10 w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
            />
          </div>
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="flex max-h-80 flex-col overflow-y-auto p-1"
          >
            {rows.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-secondary">No matching gensets</li>
            )}
            {rows.map(({genset, conflict, km}) => {
              const picked = selected.includes(genset.id);
              const busy = conflict !== undefined;
              return (
                <li key={genset.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={picked}
                    disabled={busy}
                    onClick={() => toggle(genset.id)}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                        picked ? 'border-brand bg-brand text-brand-text' : 'border-default',
                      )}
                    >
                      {picked && <CheckIcon className="size-3" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium text-primary">
                          {gensetLabel(genset)}
                          <span className="font-normal text-secondary"> · {genset.model}</span>
                        </span>
                        {km !== undefined && (
                          <span className="shrink-0 text-xs text-secondary">
                            {km < 10 ? km.toFixed(1) : figure(Math.round(km))} km
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-secondary">
                        {busy
                          ? `On ${conflict.reference}${conflict.endsAt === null ? ', no planned end' : ` until ${dayMonth(conflict.endsAt)}`}`
                          : `${genset.siteId === null ? 'In the depot' : `At ${genset.locationLabel}`} · Fuel ${fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <ul aria-label="Selected gensets" className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const genset = byId.get(id);
            const label = genset === undefined ? id : gensetLabel(genset);
            return (
              <li
                key={id}
                className="flex items-center gap-1 rounded-md border border-subtle bg-highlight py-0.5 pr-1 pl-2 text-xs text-primary"
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => toggle(id)}
                  className="flex size-4 cursor-pointer items-center justify-center rounded-sm text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-outline"
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
