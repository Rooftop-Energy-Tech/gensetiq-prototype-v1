import {CheckIcon} from 'lucide-react';

import {BRAND_IDS, brandIdentity, dataset} from '@/brands';
import {ACTIVE_BRAND_ID, BUILD_BRAND_ID} from '@/brands/active';
import {setStoredBrandId, storedBrandId} from '@/brands/selection';
import type {BrandId} from '@/brands';
import {cn} from '@/lib/utils';

/**
 * Settings — one section, and it switches which customer this build is.
 *
 * ## Why a picker exists at all
 *
 * Because the alternative was restarting the dev server. Three brands share one
 * build now (see `brands/types.ts`), and the thing a designer actually does with
 * that is compare them: is the rail dark enough behind this mark, does the amber
 * still read on that blue, does the estate's own vocabulary make the summary cards
 * scan. That is a two-second loop with a control and a forty-second one with a
 * terminal.
 *
 * ## Why it is hidden on a customer's own deployment
 *
 * A dropdown offering "Sabah Electricity" on a CelcomDigi demo is a small leak of
 * an account, and the person who notices it is the customer. So the rule is:
 *
 *  - **in dev**, always shown — this is where the comparing happens;
 *  - **in a production build**, shown only on the unbranded `gensetiq` build, which
 *    is the one for prospects and decks and has no customer to leak.
 *
 * A deployed `celcomdigi` or `sesb` build therefore never lists another customer.
 * The check is against `BUILD_BRAND_ID` rather than the active brand deliberately:
 * a customer build stays a customer build even after somebody has switched it in
 * their own browser, so the picker cannot let itself back in.
 *
 * ## Why switching reloads
 *
 * A brand names a dataset, and the estate is built once at module load. See
 * `brands/selection.ts` — the short version is that a live swap's failure mode is
 * one estate's site names over another's totals, which reviews fine and demos
 * badly.
 */
export const BRAND_PICKER_VISIBLE = import.meta.env.DEV || BUILD_BRAND_ID === 'gensetiq';

/** What each brand is, in the one line a reader needs to choose between them. */
const BRAND_BLURB: Record<BrandId, string> = {
  celcomdigi: 'A mobile carrier’s tower network, in their navy and bright blue.',
  sesb: 'A state utility’s substations and rural mini-grids, in their electric blue.',
  gensetiq: 'The product with no customer on it — teal, the IQ mark, and no lockup.',
};

const BrandOption = ({
  id,
  selected,
  onSelect,
}: {
  id: BrandId;
  selected: boolean;
  onSelect: () => void;
}) => {
  const brand = brandIdentity(id);
  const estate = dataset(brand.dataset);

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border bg-element p-4 transition-colors',
        'focus-within:ring-[3px] focus-within:ring-outline',
        selected ? 'border-teal/40' : 'border-subtle hover:border-default',
      )}
    >
      <input
        type="radio"
        name="brand"
        value={id}
        checked={selected}
        onChange={onSelect}
        // Visually replaced by the tile, but kept in the tree rather than
        // `display: none` so it stays focusable and announces its checked state.
        className="sr-only"
      />

      {/* The brand's own rail colour, carrying its own mark — the swatch is the
          thing being chosen, so it is drawn rather than named. Fixed 40px square so
          three marks of different aspect ratios still line up down the column. */}
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-md"
        style={{backgroundColor: brand.theme.sidebar}}
      >
        <img
          src={brand.mark}
          alt=""
          className="max-h-6 max-w-6 object-contain"
          aria-hidden="true"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">{brand.name}</span>
          {id === BUILD_BRAND_ID && (
            <span className="rounded bg-highlight px-1.5 py-0.5 text-[11px] leading-4 text-secondary">
              this build
            </span>
          )}
        </span>
        <span className="text-sm text-secondary">{BRAND_BLURB[id]}</span>
        <span className="pt-1 text-[13px] leading-[18px] text-secondary">
          {estate.label} · {estate.sites.length} sites, {estate.gensets.length} gensets ·{' '}
          {estate.groupingLabel.replace(/^By /, '')}s
        </span>
      </span>

      {selected && (
        <CheckIcon className="size-[18px] shrink-0 text-teal" aria-hidden="true" />
      )}
    </label>
  );
};

export const SettingsPage = () => {
  const overridden = storedBrandId() !== undefined;

  return (
    <div className="flex flex-col gap-2.5 px-4 pt-1 pb-6">
      <section aria-labelledby="brand" className="flex flex-col gap-5 px-6 py-7">
        <div className="flex flex-col gap-1">
          <h2 id="brand" className="text-sm font-medium text-primary">
            Brand
          </h2>
          <p className="max-w-2xl text-sm text-secondary">
            Which customer this build is. Changes the rail, the marks, the login
            door, the tab, and the estate — each brand carries its own sites and
            machines. <strong className="font-medium text-primary">Reloads the app</strong>,
            because the estate is built once when it starts.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="brand"
          className="grid max-w-3xl gap-3"
        >
          {BRAND_IDS.map((id) => (
            <BrandOption
              key={id}
              id={id}
              selected={id === ACTIVE_BRAND_ID}
              onSelect={() => setStoredBrandId(id === BUILD_BRAND_ID ? undefined : id)}
            />
          ))}
        </div>

        <p className="text-[13px] leading-[18px] text-secondary">
          {overridden ? (
            <>
              Saved in this browser only, and only until you clear site data — this
              prototype has no backend, so a colleague opening the same URL gets{' '}
              {brandIdentity(BUILD_BRAND_ID).name}, what the build itself was made as.
            </>
          ) : (
            <>
              Running {brandIdentity(BUILD_BRAND_ID).name}, what this build was made
              as. Picking another stores it in this browser only.
            </>
          )}
        </p>
      </section>
    </div>
  );
};
