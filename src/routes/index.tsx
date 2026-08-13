import {createFileRoute, redirect} from '@tanstack/react-router';

import {isSignedIn} from '@/modules/auth/session';
import {DEFAULT_GENSET_ID} from '@/modules/genset/data/fleet';
import {gensetSearch} from '@/modules/genset/types/view.type';

/**
 * `/` has no screen of its own in the design — it exists only to send you to the
 * one that does.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isSignedIn()) throw redirect({to: '/login'});
    throw redirect({to: '/gensets', search: gensetSearch({id: DEFAULT_GENSET_ID})});
  },
});
