import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

import {BankHome} from '@/modules/battery/components/detail/BankHome';
import {useBatteryBank} from '@/modules/battery/data/banks';

/**
 * The bank home page — the section a click from `Asset ▸ Battery` lands on, and
 * the one the design draws.
 *
 * The parent route has already resolved and 404'd the id, so the lookup here cannot
 * fail. It is repeated rather than threaded down as loader data for the same reason
 * the solar and genset home pages repeat their own: the parent renders only the
 * rail, and a route boundary should not carry an object it does not use.
 */
const BankHomeRoute = () => {
  const {bankId} = Route.useParams();
  const [now] = useState(() => Date.now());
  const bank = useBatteryBank(bankId, now);
  if (bank === undefined) return null;

  return <BankHome key={bankId} bank={bank} now={now} />;
};

export const Route = createFileRoute('/_authenticated/battery_/$bankId/')({
  component: BankHomeRoute,
});
