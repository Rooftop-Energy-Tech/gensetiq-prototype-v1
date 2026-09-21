import {createFileRoute, redirect} from '@tanstack/react-router';

import {isSignedIn} from '@/modules/auth/session';
import {gensetSearch} from '@/modules/genset/types/view.type';

/**
 * `/` has no screen of its own — it exists only to send you to the one that does.
 *
 * That used to be a *particular genset's* page, which was the design's own entry
 * point and made sense while the app was a set of machine screens. It isn't one:
 * somebody signing in is asking about the estate, not about `BRF9540`, and landing
 * inside one machine meant every session started by navigating back out of it.
 *
 * Then it was `/overview`, which counted the estate without listing it — and which
 * has since been folded into the registers, where the same tallies sit in a card
 * strip over the rows they are counting.
 *
 * Then `/sites`, while the estate was read as a set of permanent installations. On
 * a fleet whose plant moves it isn't one: the machine is the fact and the yard is
 * where it is standing this week, so this lands on the fleet register — the rail's
 * first destination, and the screen every other question here starts from.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isSignedIn()) throw redirect({to: '/login'});
    // `gensetSearch()` rather than a bare `to`: the register's params are
    // validated, and a redirect type-checks against the *parsed* shape rather than
    // the URL's. This lands on the screen's own default view.
    throw redirect({to: '/gensets', search: gensetSearch()});
  },
});
