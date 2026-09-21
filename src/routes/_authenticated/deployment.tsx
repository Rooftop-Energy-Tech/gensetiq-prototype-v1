import {createFileRoute, redirect} from '@tanstack/react-router';

/**
 * `/deployment` forwards to `/deployments`.
 *
 * The register was singular while a row was one machine's posting, and it is plural
 * now that a row is a job the way `/sites` and `/gensets` are lists of things. The
 * old path is kept rather than dropped because it is quoted in
 * `docs/how-it-works.md`, in the README's route table and in the screen inventory in
 * the vault, and a dead link in a deck is a worse outcome than one route file that
 * forwards.
 *
 * The search params travel with it, so a shared `?view=gantt&state=ongoing` still
 * opens the timeline. `ongoing` is not a state any more, and the schema's own
 * `.catch()` drops it back to the unfiltered register rather than throwing.
 */
export const Route = createFileRoute('/_authenticated/deployment')({
  beforeLoad: ({search}) => {
    throw redirect({to: '/deployments', search: search as never, replace: true});
  },
});
