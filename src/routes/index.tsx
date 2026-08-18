import {createFileRoute, redirect} from '@tanstack/react-router';

import {isSignedIn} from '@/modules/auth/session';

/**
 * `/` has no screen of its own — it exists only to send you to the one that does.
 *
 * That used to be a *particular genset's* page, which was the design's own entry
 * point and made sense while the app was a set of machine screens. It isn't one:
 * somebody signing in is asking about the estate, not about `BRF9540`, and landing
 * inside one machine meant every session started by navigating back out of it.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isSignedIn()) throw redirect({to: '/login'});
    throw redirect({to: '/overview'});
  },
});
