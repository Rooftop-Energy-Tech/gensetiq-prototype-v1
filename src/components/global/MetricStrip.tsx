import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';

/**
 * The strip across the top of a site, a system or a bank: the two or three figures
 * that move, then the alarm counts.
 *
 * ## Why one component for three pages
 *
 * Because the design draws one. The site frame, the solar frame and the battery
 * frame all open on the same rule — three equal columns, a label over a figure
 * twice, and the severity pill third — and the only thing that differs is which
 * two figures. That is the caller's business and nothing else here is.
 *
 * Equal thirds rather than content-width columns, so the strip reads as a rule
 * across the page and the eye can drop to any of the three without hunting.
 * Content-width columns would bunch every page's figures at the left and leave the
 * rest of a 1,530px band empty.
 *
 * ## Why the third column is always the alarms
 *
 * Because it is the one column every page can fill. Generation exists at a system,
 * fuel at a genset, charge at a bank — and none of them anywhere else. Alarms are
 * the one quantity all three plant types raise, so pinning them to a fixed column
 * is what lets a reader moving between the three know where to look without
 * reading the labels first.
 */
export const MetricStrip = ({
  metrics,
  counts,
  ariaLabel,
}: {
  /**
   * Two in the design, three where a page has a third question of the same kind —
   * the genset's tank, its runway and its service counter. Not a licence to keep
   * adding: the strip's value is that a reader knows where to look before they
   * read the labels, and a column that moves between pages costs exactly that.
   */
  metrics: ReadonlyArray<{label: string; value: string}>;
  counts: Record<AlertSeverity, number>;
  ariaLabel: string;
}) => (
  <section
    aria-label={ariaLabel}
    // A column at phone width: three equal thirds of a 390px screen gives each
    // figure 120px, which is narrower than "Generation today" needs.
    className="flex flex-col gap-4 rounded-md border border-subtle bg-element px-5 py-4 sm:flex-row sm:gap-3"
  >
    {metrics.map((metric) => (
      <div key={metric.label} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-secondary">{metric.label}</span>
        <span className="text-base font-semibold text-primary tabular-nums">
          {metric.value}
        </span>
      </div>
    ))}

    <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span className="truncate text-sm font-medium text-secondary">Alarm</span>
      {/* Three counts in one pill, coloured rather than labelled — the design's
          treatment, and the only way three numbers fit the column. The tooltip
          spells them out, exactly as each device row's does. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="cursor-help gap-1.5">
            <BellIcon className="text-secondary" aria-hidden="true" />
            {ALERT_SEVERITIES.map((severity) => (
              <span key={severity} className={SEVERITY_META[severity].textClassName}>
                {counts[severity]}
              </span>
            ))}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex flex-col gap-1">
          {ALERT_SEVERITIES.map((severity) => (
            <span key={severity}>
              {SEVERITY_META[severity].label} · {counts[severity]}
            </span>
          ))}
        </TooltipContent>
      </Tooltip>
    </div>
  </section>
);
