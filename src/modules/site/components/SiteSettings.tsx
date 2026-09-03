import {BatteryChargingIcon, BoomBoxIcon, SunMediumIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {SITE_POWER_ROLES} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {setSitePowerRole, useSitePowerRole} from '../data/siteConfig';
import type {SiteSummary} from '../data/sites';
import {SiteIdentityPanel} from './settings/SiteIdentityPanel';
import {SiteDiagram} from './SiteDiagram';
import {SiteGensets} from './SiteGensets';
import {SiteMetering} from './SiteMetering';

/**
 * The site's Settings tab — what this yard *is*, and how the page draws it.
 *
 * ## The order of the sections, and why
 *
 * **Identity and placement** first: the site's own facts — its name, where it
 * stands, its region and its programme. They are first because they are what a
 * reader arrives to fix. A pin in the wrong district or a site filed under the
 * wrong rollout is a data correction, and it is the errand that brings somebody to
 * this tab in the first place.
 *
 * **Power configuration** second, on its own and with room to explain itself. It is
 * a given like the five above it and it is not like them in one way that matters:
 * the others change what the page *says* and this one changes what the page
 * **draws**. A control that redraws a circuit deserves more than a row in a form,
 * because it is the one on this tab a reader could mistake for reconfiguring plant.
 *
 * Then the plant this site holds — gensets and meters — and last the circuit
 * itself, as the preview of the choice above.
 *
 * ## What the power setting is
 *
 * Which of the estate's four power configurations this site is: grid-backed,
 * diesel prime, diesel hybrid, or solar hybrid. It is a *display* choice — it
 * selects which sources the single-line diagram draws onto the bus — and the copy
 * below says so in as many words, because a control on a page called Settings will
 * otherwise be read as reconfiguring plant. See `SitePowerRole` for where that
 * line is drawn and why.
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
  GRID_BACKUP: {
    label: 'Grid, backed by genset',
    icon: UtilityPoleIcon,
    claim:
      'There is a utility incomer. The genset starts when it fails and hands the load back when it returns.',
    effect: 'The diagram draws the grid above the gensets, on its own transfer contactor.',
  },
  DIESEL_PRIME: {
    label: 'Diesel prime',
    icon: BoomBoxIcon,
    claim:
      'No incomer and no storage. The genset carries the tower continuously, and a second set is a spare rather than a backup.',
    effect: 'The diagram draws the gensets alone, and a site with none feeding reads as an outage.',
  },
  DIESEL_HYBRID: {
    label: 'Diesel hybrid',
    icon: BatteryChargingIcon,
    claim:
      'No incomer. A battery carries the tower and the genset runs in blocks to recharge it, near its efficient loading rather than idling at what the tower draws.',
    effect: 'The diagram adds the battery to the bus, above the gensets.',
  },
  SOLAR_HYBRID: {
    label: 'Solar hybrid',
    icon: SunMediumIcon,
    claim:
      'No incomer. Solar carries the day and charges the battery, the battery carries the night, and the genset is the backstop for a run of dull days.',
    effect: 'The diagram adds the array and the battery to the bus, above the gensets.',
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
      <SiteIdentityPanel siteId={summary.site.id} />

      <hr className="border-subtle" />

      <section aria-labelledby="power-configuration" className="flex flex-col gap-5 px-6 py-7">
        <div className="flex flex-col gap-1">
          <h2 id="power-configuration" className="text-sm font-medium text-primary">
            Power configuration
          </h2>
          <p className="max-w-2xl text-sm text-secondary">
            How {summary.site.name} is powered. This selects the circuit the site page draws.
            It does not reconfigure a genset, and nothing about how the sets here behave
            depends on it.
          </p>
        </div>

        {/* A two-column grid rather than a flex row: four options at `flex-1`
            each squeeze to a column too narrow for the sentence that makes them
            worth choosing between. */}
        <div
          role="radiogroup"
          aria-labelledby="power-configuration"
          className="grid max-w-3xl gap-3 sm:grid-cols-2"
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

        {summary.gensets.length === 0 && role === 'DIESEL_PRIME' ? (
          <p className="text-sm text-secondary">
            Nothing supplies this site. It is set to run on its own gensets and none are
            fitted.
          </p>
        ) : (
          <SiteDiagram summary={summary} dutyId={summary.defaultDutyId} role={role} />
        )}
      </section>
    </div>
  );
};
