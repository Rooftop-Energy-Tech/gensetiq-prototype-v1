import {BoomBoxIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {SITE_POWER_ROLES} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {setSitePowerRole, useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteDiagram} from './SiteDiagram';
import {SiteGensets} from './SiteGensets';
import {SiteMetering} from './SiteMetering';

/**
 * The site's Settings tab — one section, and it configures how the site page draws
 * this yard's supply.
 *
 * ## Why there is only one section
 *
 * The tab's old placeholder promised three things: which gensets are installed,
 * how the changeover is configured, and who gets called out. Two of those have no
 * data behind them and the third is already a live control on the Home tab. A
 * heading over an empty div is worse than a page that does one thing, so this does
 * one thing.
 *
 * ## What the setting is
 *
 * Whether this yard has a **mains incomer the gensets back up**, or whether the
 * gensets **are** the supply. It is a *display* choice — it selects which circuit
 * the single-line diagram draws — and the copy below says so in as many words,
 * because a control on a page called Settings will otherwise be read as
 * reconfiguring plant. See `SitePowerRole` for where that line is drawn and why.
 *
 * ## Why it applies on click, with no Save
 *
 * There is no backend to save to. A Save button would imply a round-trip, a
 * server-side record and a rollback that do not exist, and the honest version of
 * "this is stored in your browser" is a control that visibly takes effect and a line
 * of text saying where it went. It is the same stance the changeover on the Home tab
 * takes: the effect is real, the claim about it is small.
 */

type RoleCopy = {
  label: string;
  icon: LucideIcon;
  /** What picking this asserts about the yard. */
  claim: string;
  /** What it changes on the site page — stated so the reader is not guessing. */
  effect: string;
};

const ROLE_COPY: Record<SitePowerRole, RoleCopy> = {
  STANDBY: {
    label: 'Backup to mains',
    icon: UtilityPoleIcon,
    claim: 'There is a mains incomer. The gensets start when it fails and hand the load back when it returns.',
    effect: 'The diagram draws the mains above the gensets, on its own transfer contactor.',
  },
  PRIME: {
    label: 'Main power source',
    icon: BoomBoxIcon,
    claim: 'There is no mains supply. The gensets carry the load continuously, and a second set is a spare rather than a backup.',
    effect: 'The diagram draws the gensets alone, and a site with none feeding reads as an outage.',
  },
};

/**
 * One choice, as a card rather than a row in a radio list.
 *
 * `radio` inputs rather than the segmented track the changeover uses: that track
 * works because its options are one word each, and these need a sentence apiece to
 * be worth choosing between. A native radio also gets arrow-key movement within the
 * group for free, which a row of buttons would have to reimplement.
 */
const RoleOption = ({
  role,
  selected,
  onSelect,
}: {
  role: SitePowerRole;
  selected: boolean;
  onSelect: () => void;
}) => {
  const copy = ROLE_COPY[role];
  const Icon = copy.icon;

  return (
    <label
      className={cn(
        'flex flex-1 cursor-pointer items-start gap-3 rounded-lg border bg-element p-4 transition-colors',
        'focus-within:ring-[3px] focus-within:ring-outline',
        selected ? 'border-teal/40' : 'border-subtle hover:border-default',
      )}
    >
      <input
        type="radio"
        name="site-power-role"
        value={role}
        checked={selected}
        onChange={onSelect}
        // Visually replaced by the tile itself, but kept in the tree rather than
        // `display: none` so it stays focusable and announces its checked state.
        className="sr-only"
      />

      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          selected ? 'bg-teal/16' : 'bg-highlight',
        )}
      >
        <Icon
          className={cn('size-[18px]', selected ? 'text-teal' : 'text-secondary')}
          aria-hidden="true"
        />
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-primary">{copy.label}</span>
        <span className="text-sm text-secondary">{copy.claim}</span>
        <span className="pt-1 text-[13px] leading-[18px] text-secondary">{copy.effect}</span>
      </span>
    </label>
  );
};

export const SiteSettings = ({summary}: {summary: SiteSummary}) => {
  const role = useSitePowerRole(summary.site.id);

  return (
    <div className="flex flex-col gap-2.5 px-4 pt-1 pb-6">
      <section aria-labelledby="power-configuration" className="flex flex-col gap-5 px-6 py-7">
        <div className="flex flex-col gap-1">
          <h2 id="power-configuration" className="text-sm font-medium text-primary">
            Power configuration
          </h2>
          <p className="max-w-2xl text-sm text-secondary">
            How {summary.site.name} is fed. This selects the circuit the site page draws — it
            does not reconfigure a genset, and nothing about how the sets here behave depends
            on it.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="power-configuration"
          className="flex max-w-3xl flex-wrap gap-3"
        >
          {SITE_POWER_ROLES.map((option) => (
            <RoleOption
              key={option}
              role={option}
              selected={option === role}
              onSelect={() => setSitePowerRole(summary.site.id, option)}
            />
          ))}
        </div>

        <p className="text-[13px] leading-[18px] text-secondary">
          Saved in this browser only. This prototype has no backend, so the choice does not
          sync and a colleague opening {summary.site.name} sees the default.
        </p>
      </section>

      <hr className="border-subtle" />

      <SiteGensets summary={summary} />

      <hr className="border-subtle" />

      <SiteMetering summary={summary} />

      <hr className="border-subtle" />

      {/* The setting's own effect, drawn. Cheap — `SiteDiagram` is already a pure
          function of `(summary, dutyId, role)` — and it is the most useful thing the
          page can show: the choice above is about a picture, so the picture is the
          argument. It uses the site's real duty set and real meter reading, which is
          why this is the site page's circuit rather than an illustration of one. */}
      <section aria-label="Circuit preview" className="flex flex-col gap-5 px-6 py-7">
        <h2 className="text-sm font-medium text-primary">
          {summary.site.name} as {ROLE_COPY[role].label.toLowerCase()}
        </h2>

        {summary.gensets.length === 0 && role === 'PRIME' ? (
          <p className="text-sm text-secondary">
            Nothing supplies this site. It is set to run on its own gensets and none are
            installed.
          </p>
        ) : (
          <SiteDiagram summary={summary} dutyId={summary.defaultDutyId} role={role} />
        )}
      </section>
    </div>
  );
};
