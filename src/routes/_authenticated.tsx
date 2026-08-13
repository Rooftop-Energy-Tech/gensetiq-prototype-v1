import {createFileRoute, redirect} from '@tanstack/react-router';

import {AuthenticatedLayout} from '@/layouts/AuthenticatedLayout';
import {isSignedIn} from '@/modules/auth/session';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({location}) => {
    if (isSignedIn()) return;
    // Carry where we came from, so a deep link — say a shared map URL with a
    // genset already selected — survives the trip through login.
    throw redirect({to: '/login', search: {redirect: location.href}});
  },
  component: AuthenticatedLayout,
});
