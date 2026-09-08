import {createFileRoute, useParams} from '@tanstack/react-router';

import {BankAlarms} from '@/modules/battery/components/detail/BankAlarms';

/**
 * The bank's alarms.
 *
 * ## The hardest of the three gates to remove, and why it went anyway
 *
 * A bank is the one asset here with **no source but the monitoring unit**. A genset
 * has its controller everywhere and an array has this app's derived rules
 * everywhere; twenty-four of the twenty-five banks have nothing watching them at
 * all, so this tab's queue is genuinely empty there, not merely quiet.
 *
 * That is the argument for a placeholder and it is the argument against one. An
 * empty table reading `Nothing standing` is the reassurance the source document
 * forbids in as many words — "an unpopulated smoke port and a smoke-free site are
 * the same `0`, and presenting that as reassurance is worse than showing nothing".
 * But *coming soon* makes the same claim by a different route: it says the feature
 * is unbuilt, when what is actually missing is a sensor, and it leaves the bank's own
 * metric strip printing three zeros with nothing on the page to qualify them.
 *
 * So the tab is real at every bank and `BankAlarms` says which of the two zeros this
 * one is: **nothing standing** where a unit is watching, and **nothing watching**
 * where none is. That is a sentence a placeholder could not carry, because a
 * placeholder is not allowed to be about the bank.
 */
const BankAlarmsRoute = () => {
  const {bankId} = useParams({from: '/_authenticated/battery_/$bankId'});

  return <BankAlarms key={bankId} bankId={bankId} />;
};

export const Route = createFileRoute('/_authenticated/battery_/$bankId/alarms')({
  component: BankAlarmsRoute,
});
