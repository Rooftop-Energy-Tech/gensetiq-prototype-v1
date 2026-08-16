import {useState} from 'react';
import {ActivityIcon, GaugeIcon, PlusIcon, XIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {fitMeter, meterAt, spareMeters, useMeters} from '@/modules/meter/data/meters';
import {METER_POINTS, METER_POINT_LABEL} from '@/modules/meter/types/meter.type';
import type {MeterFeed, MeterPoint, PowerMeter} from '@/modules/meter/types/meter.type';
import type {SiteSummary} from '../data/sites';

/**
 * What is measuring this site, circuit by circuit.
 *
 * ## Why two slots and not one list
 *
 * Because a site has exactly two circuits worth metering and **one meter each**, so
 * the shape of the control should be the shape of the switchboard: a slot per circuit,
 * either filled or empty. A flat list of "meters at this site" would leave the reader
 * to work out which circuits were covered by reading down it, and would say nothing at
 * all about the circuits that aren't — which is the more important half.
 *
 * The two are genuinely different measurements rather than a redundancy. Mains
 * metering is what the site **imports**, and it goes to nothing the moment a genset
 * picks up the load; load metering is what the customer **consumes**, and it does not.
 * A site with only mains metering is blind during exactly the events this product
 * exists to watch.
 *
 * ## Why an empty slot is worth drawing
 *
 * It is the whole point. Most sites in this estate have no metering at all, and the
 * page used to quote a grid figure at every one of them — instrumentation nobody had
 * bought. An empty slot says plainly that the circuit is unmeasured, which is a fact
 * with an owner and a price, rather than a blank the reader has to notice.
 */

/** What the site page will be able to say about this circuit, once fitted. */
const feedSummary = (feed: MeterFeed): string =>
  feed.state === 'METERED'
    ? amount(feed.kw, 'kW')
    : feed.state === 'NOT_REPORTING'
      ? 'No reading'
      : 'Unmetered';

const MeterIdentity = ({meter}: {meter: PowerMeter}) => (
  <span className="flex min-w-0 items-center gap-3">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-highlight">
      <GaugeIcon className="size-[18px] text-secondary" aria-hidden="true" />
    </span>
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-primary">{meter.serial}</span>
      <span className="truncate text-[13px] leading-[18px] text-secondary">{meter.model}</span>
    </span>
    {/* Only the failure is badged. A device that is doing its job needs no chip —
        the reading beside it already proves it. */}
    {!meter.online && (
      <Badge variant="element" className="ml-1 shrink-0 border-subtle">
        <ActivityIcon className="size-3 text-severity-warning" aria-hidden="true" />
        Not reporting
      </Badge>
    )}
  </span>
);

const CircuitSlot = ({
  summary,
  point,
  feed,
}: {
  summary: SiteSummary;
  point: MeterPoint;
  feed: MeterFeed;
}) => {
  const all = useMeters();
  const [picking, setPicking] = useState(false);

  const fitted = meterAt(all, summary.site.id, point);
  const spares = spareMeters(all);

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-subtle bg-element p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-primary">{METER_POINT_LABEL[point]}</h3>
        <span
          className={cn(
            'text-[13px]',
            feed.state === 'METERED' ? 'text-primary' : 'text-secondary',
          )}
        >
          {feedSummary(feed)}
        </span>
      </div>

      <p className="text-[13px] leading-[18px] text-secondary">
        {point === 'MAINS'
          ? 'What the site imports from the grid. Reads nothing while a genset carries the load.'
          : 'What the customer consumes, whichever supply is carrying it.'}
      </p>

      {fitted !== undefined ? (
        <div className="mt-1 flex items-center justify-between gap-4">
          <MeterIdentity meter={fitted} />
          <Button variant="outline" size="sm" onClick={() => fitMeter(fitted.id, null)}>
            <XIcon aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : picking ? (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-secondary">Fit a meter from stores</p>
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>

          {spares.length === 0 ? (
            <p className="rounded-md border border-dashed border-subtle px-3 py-4 text-center text-[13px] text-secondary">
              No meters in stores. Remove one from another circuit first.
            </p>
          ) : (
            <ul className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
              {spares.map((meter) => (
                <li
                  key={meter.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-subtle p-2"
                >
                  <MeterIdentity meter={meter} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fitMeter(meter.id, {siteId: summary.site.id, point});
                      setPicking(false);
                    }}
                  >
                    <PlusIcon aria-hidden="true" />
                    Fit
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-4">
          <p className="text-sm text-secondary">No meter fitted.</p>
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            <PlusIcon aria-hidden="true" />
            Fit a meter
          </Button>
        </div>
      )}
    </div>
  );
};

export const SiteMetering = ({summary}: {summary: SiteSummary}) => {
  const feeds: Record<MeterPoint, MeterFeed> = {
    MAINS: summary.mains.feed,
    LOAD: summary.loadFeed,
  };

  return (
    <section aria-labelledby="metering" className="flex flex-col gap-5 px-6 py-7">
      <div className="flex flex-col gap-1">
        <h2 id="metering" className="text-sm font-medium text-primary">
          Metering
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          Power meters fitted at {summary.site.name}, one per circuit. A circuit with no meter
          reports no figure — the site page says so rather than estimating one. Fitting a
          meter does not change what the site draws; it changes whether the app can tell you.
        </p>
      </div>

      <div className="flex max-w-3xl flex-wrap gap-3">
        {METER_POINTS.map((point) => (
          <CircuitSlot key={point} summary={summary} point={point} feed={feeds[point]} />
        ))}
      </div>
    </section>
  );
};
