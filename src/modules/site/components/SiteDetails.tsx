import {amount} from '@/lib/format';
import {DetailBand} from '@/components/global/DetailBand';
import type {DetailRow} from '@/components/global/DetailBand';
import {SITE_KIND_LABEL} from '../data/sites';
import {customerShortName} from '../data/customers';
import {HAS_PROGRAMS, programShortName} from '../data/programs';
import type {SitePowerRole} from '../types/site.type';
import type {SiteSummary} from '../data/sites';
import {supplyLabel} from './supplyMeta';

/**
 * A coordinate, as a site record writes one.
 *
 * Signed decimal degrees to four places — about eleven metres, which is the scale
 * at which the difference between two gensets in the same yard stops mattering and
 * well past the scale at which a seeded mock figure means anything. `N`/`S` and
 * `E`/`W` rather than a leading minus, because the minus is the one character in a
 * coordinate that gets lost between a spreadsheet and a work order.
 *
 * The settings field takes and stores the **signed** number, which is what MapLibre
 * wants and what a reader pastes in. This is a display, and only a display.
 */
const coordinate = (value: number, positive: string, negative: string): string =>
  `${Math.abs(value).toFixed(4)}° ${value < 0 ? negative : positive}`;

/**
 * The third band: what this site *is*, under the picture of how it is wired.
 *
 * `DetailBand` owns the shape — the two-column split, the container query it keys
 * off, the padding — because the genset, solar and battery pages carry the same band
 * and used to carry the same markup three more times. This file owns only the rows,
 * which is the part that is actually the site's.
 *
 * ## Why these sit below the diagram rather than in the strip above
 *
 * Because they belong to the drawing. The strip carries the figures that move —
 * generation, fuel, alarms — and a reader checks those to decide whether anything
 * needs doing today. These do not move: how the yard is fed, where it is and what is
 * installed are facts about the installation, and their job is to tell you what you
 * have just been looking at.
 *
 * They were beside the diagram until the design moved them underneath it; the note in
 * `SiteHome` at the band itself has the reasoning.
 *
 * ## Why the site's own name is in a list under its own header
 *
 * It looks redundant and it is deliberate. **Every row in this band is a field the
 * Settings tab edits**, in the order that tab presents them, and a reader who has
 * just renamed a site should be able to see the new name land somewhere that isn't
 * chrome. A band that showed five of the six editable facts and left the sixth to be
 * inferred from the breadcrumb would be the version that reads as an oversight.
 *
 * `Programme` is withheld entirely on an estate whose dataset declares none — an
 * empty roster means the grouping does not exist here, and a row reading "Unassigned"
 * at every site would be a column of nothing pretending to be data.
 *
 * `Load` is added to the design's two. The frame states how the site is fed and how
 * much is installed but never what the installation is *for*, and the load's
 * tolerance for an outage is what makes everything else on this page urgent or
 * routine.
 */
export const SiteDetails = ({
  summary,
  role,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
}) => {
  const rows: Array<DetailRow> = [
    {label: 'Site name', value: summary.site.name},
    {label: 'Region', value: customerShortName(summary.site.customer)},
    // Withheld rather than shown as "Unassigned" — see the note above.
    ...(HAS_PROGRAMS
      ? [{label: 'Programme', value: programShortName(summary.site.program)}]
      : []),
    {label: 'Supply', value: supplyLabel(role, summary.gensets.length)},
    {label: 'Latitude', value: coordinate(summary.site.latitude, 'N', 'S')},
    {label: 'Longitude', value: coordinate(summary.site.longitude, 'E', 'W')},
    {label: 'Installed capacity', value: amount(summary.ratedKw, 'kW')},
    {label: 'Load', value: SITE_KIND_LABEL[summary.site.kind]},
  ];

  return <DetailBand ariaLabel="Site details" rows={rows} />;
};
