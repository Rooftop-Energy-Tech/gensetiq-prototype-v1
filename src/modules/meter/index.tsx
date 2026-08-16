import {useMemo} from 'react';
import {SearchIcon, SearchXIcon} from 'lucide-react';

import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {sitePowerRole} from '@/modules/site/data/siteConfig';
import {circuitFlowKw, siteSummary} from '@/modules/site/data/sites';
import {METER_POINT_LABEL} from './types/meter.type';
import type {PowerMeter} from './types/meter.type';
import {meterSiteName, useMeters} from './data/meters';
import {MetersTable} from './components/MetersTable';

/**
 * `/meters` — the metering estate.
 *
 * A flat list of devices rather than a per-site view, because the question it exists
 * to answer is a fleet question: **what have we actually instrumented?** Sixteen boxes
 * across seventeen sites, and the interesting rows are the ones in stores and the ones
 * that have gone quiet. Per-site metering is configured on the site's own Settings tab,
 * where the two circuits are; each row here links straight through to it.
 *
 * No map and no preview panel, for the same reasons the sites list has neither: a
 * meter's position is its site's, and a panel would duplicate the row.
 */

/** What each fitted meter is reading right now, by meter id. */
const readingsFor = (meters: Array<PowerMeter>): Record<string, number | null> =>
  Object.fromEntries(
    meters.map((meter) => {
      if (meter.fitting === null) return [meter.id, null];

      const summary = siteSummary(meter.fitting.siteId);
      if (summary === undefined) return [meter.id, null];

      // The default duty set, not a live selection: the changeover is component state
      // on the site page and does not exist over here. It only shifts *which* set is
      // carrying, never whether something is — so the circuit's flow is unaffected.
      return [
        meter.id,
        circuitFlowKw(
          summary,
          summary.defaultDutyId,
          sitePowerRole(meter.fitting.siteId),
          meter.fitting.point,
        ),
      ];
    }),
  );

const matches = (meter: PowerMeter, needle: string): boolean =>
  [
    meter.serial,
    meter.model,
    meter.fitting === null ? 'in stores' : meterSiteName(meter.fitting.siteId),
    meter.fitting === null ? '' : METER_POINT_LABEL[meter.fitting.point],
  ].some((field) => field.toLowerCase().includes(needle));

export const MetersPage = ({
  search,
  onSearchChange,
}: {
  search: {q?: string};
  onSearchChange: (next: {q?: string}) => void;
}) => {
  const {q = ''} = search;
  const all = useMeters();

  const meters = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle === '' ? all : all.filter((meter) => matches(meter, needle));
  }, [all, q]);

  const readings = useMemo(() => readingsFor(meters), [meters]);

  const fitted = all.filter((meter) => meter.fitting !== null).length;
  const silent = all.filter((meter) => meter.fitting !== null && !meter.online).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 373px is the design's search width on the fleet screen; the same box for
            the same job. It matches the serial, the model, the site and the circuit. */}
        <InputGroup className="w-full max-w-[373px]">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(event) => onSearchChange({q: event.target.value || undefined})}
            placeholder="Search meters"
            aria-label="Search meters"
          />
        </InputGroup>

        {/* The estate in one line, and it is deliberately about coverage rather than
            device count: "how many are there" is not a question anybody has, and
            "how many circuits are we blind on" is the whole reason for this screen. */}
        <p className="text-sm text-secondary">
          {fitted} of {all.length} fitted
          {silent > 0 && <span className="text-severity-warning"> · {silent} not reporting</span>}
        </p>
      </div>

      {meters.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <SearchXIcon className="size-6 text-secondary" aria-hidden="true" />
          <p className="text-sm text-secondary">No meters match “{q}”.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MetersTable meters={meters} readings={readings} />
        </div>
      )}
    </div>
  );
};
