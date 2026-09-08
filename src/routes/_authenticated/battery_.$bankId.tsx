import {createFileRoute, notFound} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {BankDetailShell} from '@/modules/battery/components/detail/BankDetailShell';
import {bankForLoader, useBatteryBank} from '@/modules/battery/data/banks';
import {bankName} from '@/modules/battery/types/bank.type';
import {fromSearchSchema} from '@/modules/site/types/fromSearch.type';
import type {FromSearch} from '@/modules/site/types/fromSearch.type';

/**
 * Annotated rather than inferred, for the reason the genset and solar routes give:
 * `Route`'s type depends on its `component`, the component reads loader data, and
 * inferring that data from the loader body closes the loop.
 */
type BankLoaderData = {crumb: string};

/**
 * One bank's pages: `/battery/sbh-1495`, `/battery/sbh-1495/analysis`, …
 *
 * The trailing underscore on `battery_` un-nests this from `/battery`, which is the
 * register. Without it TanStack renders the detail page inside the register, and
 * the register has no `<Outlet />`, so nothing appears at all.
 *
 * ## Why the bank is resolved twice, and why that is not a mistake
 *
 * The **loader** resolves it once to 404 a site with no storage for the whole
 * section, so six children do not repeat the check, and to name the breadcrumb —
 * which `staticData` cannot do because the label depends on the params.
 *
 * The **component** resolves it again through `useBatteryBank`, which reads the
 * live power-role store. That is the half that matters while the page is open: a
 * reader can flip this site away from a hybrid configuration on its settings tab,
 * and a page that went on drawing a bank which no longer exists — because a loader
 * ran before the change — would be the most confusing state in the app. The
 * loader's copy is the door; the hook's is the page.
 */
const BankDetailRoute = () => {
  const {bankId} = Route.useParams();
  // One clock for the whole section, so the gauge, the badges and the chart's
  // right-hand edge cannot land either side of a minute boundary.
  const [now] = useState(() => Date.now());
  const bank = useBatteryBank(bankId, now);

  // The role was changed out from under the page. `notFound()` cannot be thrown
  // from a render, so the not-found body is rendered directly.
  if (bank === undefined) return <NotFound />;

  return <BankDetailShell bank={bank} />;
};

export const Route = createFileRoute('/_authenticated/battery_/$bankId')({
  loader: ({params}): BankLoaderData => {
    const bank = bankForLoader(params.bankId, Date.now());
    if (bank === undefined) throw notFound();

    return {crumb: bankName(bank)};
  },
  // Accepts `from` so an asset opened at a site crumbs back to that site rather
  // than to its register — see `fromSearch.type.ts`. Declared on the section route
  // so every tab under it carries the param without repeating the schema.
  validateSearch: (search: Record<string, unknown>): FromSearch =>
    fromSearchSchema.parse(search),
  staticData: {crumbParent: {label: 'Battery', to: '/battery'}},
  component: BankDetailRoute,
});
