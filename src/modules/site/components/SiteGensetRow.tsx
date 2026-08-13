import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {ActivityIcon, BellIcon, DropletIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import {gensetName} from '@/modules/genset/types/genset.type';
import type {ControlMode} from '@/modules/genset/types/telemetry.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {ControlPad} from '@/modules/genset/components/detail/ControlPad';
import {CurrentRunCard} from '@/modules/genset/components/detail/CurrentRunCard';
import {CONDITION_META, SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {SiteGenset} from '../data/sites';

/**
 * One genset at the site: what it is, what its current run has done, and the four
 * buttons for it.
 *
 * The row is the design's, and it is deliberately **the genset's own components**
 * — `CurrentRunCard` and `ControlPad` are the same ones its home page renders,
 * not site-flavoured copies. A control pad that behaved differently depending on
 * which page you pressed it from would be the worst kind of divergence to ship: the
 * rules about when START is live (`MANUAL` only, and only when it would change
 * something) are safety rules, and they belong in one component.
 *
 * The four badges are the design's four, and they are ordered by how quickly they
 * go stale: run state and load change by the second, the tank by the hour, the
 * condition and its alert counts by the day.
 */
export const SiteGensetRow = ({
  member,
  /** Is the changeover giving this set the load? Decides whether it reports a kW. */
  onLoad,
  now,
}: {
  member: SiteGenset;
  onLoad: boolean;
  now: number;
}) => {
  const {genset, detail} = member;

  /**
   * Mode is per-row state, for the same reason `GensetHome` keeps it in component
   * state rather than the URL: it describes what the *machine* is set to, not what
   * the reader is looking at, so it has no business being linkable. Each row owns
   * its own — two sets at one site are two controllers.
   */
  const [mode, setMode] = useState<ControlMode>(detail.controlMode);

  const stateMeta = RUN_STATE_META[genset.runState];
  const StateIcon = stateMeta.icon;
  const conditionMeta = CONDITION_META[detail.condition];
  const counts = countBySeverity(detail.alerts);

  return (
    // Unbordered, as the design now draws it. The row's own contents already carry
    // edges — the run card and the four control tiles are bordered — and boxing
    // those inside a second box was a frame around a frame.
    <div className="flex flex-wrap items-center gap-x-5 gap-y-6 px-5 py-6">
      {/* 268px rather than the design's 249. The frame's four badges pair into two
          rows of two at its placeholder values, and they should keep that shape —
          but a real load reads "205 kW" where the frame writes "10 kW", which is
          enough to tip the first badge onto a line of its own at 249px. */}
      <div className="flex w-[268px] shrink-0 flex-col gap-2">
        {/* The name is the way *into* the genset, exactly as in the fleet table —
            a site page is a summary, and anyone who wants the dials, the phase
            currents or the alert list is one click from them. */}
        <Link
          to="/gensets/$gensetId"
          params={{gensetId: genset.id}}
          className="truncate rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
        >
          {gensetName(genset)}
        </Link>

        <div className="flex flex-wrap gap-x-1 gap-y-[7px]">
          <Badge variant="secondary" className="whitespace-pre">
            <StateIcon className={stateMeta.iconClassName} aria-hidden="true" />
            {stateMeta.label}
            {/* A kW figure only while the engine turns *and* the changeover has this
                set on the bus. "0 kW" on a stopped set would read as a genset
                running into an open breaker — a real fault, and a different one —
                and a running set whose load has been transferred away is delivering
                nothing here, however much its own controller is still metering. */}
            {detail.loadKw !== null && (
              <>
                <span className="text-tertiary"> | </span>
                {onLoad ? amount(detail.loadKw, 'kW') : 'off-load'}
              </>
            )}
          </Badge>

          <Badge variant="secondary" className="whitespace-pre">
            <DropletIcon className="text-fuel" aria-hidden="true" />
            {fuelHeadline(genset.fuelLitres, genset.fuelCapacityLitres)}
          </Badge>

          <Badge variant="secondary">
            <ActivityIcon className={conditionMeta.textClassName} aria-hidden="true" />
            {conditionMeta.label}
          </Badge>

          {detail.alerts.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="cursor-help gap-1.5">
                  <BellIcon className="text-secondary" aria-hidden="true" />
                  {/* Critical, warning, neutral — coloured rather than labelled,
                      which is the design's treatment and the only way three counts
                      fit in a 70px pill. The tooltip spells them out. */}
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
          )}
        </div>
      </div>

      {/* Capped at the design's 479px rather than left to absorb the row's slack.
          The card holds three label/value pairs and a timeline; past its designed
          width it gains nothing but distance between a label and its number, and
          the frame's own layout leaves the leftover space to the right of the
          control pad. */}
      <div className="flex min-w-[380px] max-w-[479px] flex-1">
        <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
      </div>

      <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />
    </div>
  );
};
