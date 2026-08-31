import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {SolarRegister} from '@/modules/solar/components/register/SolarRegister';
import {solarRegisterSearchSchema} from '@/modules/solar/types/register.type';
import type {SolarRegisterSearch} from '@/modules/solar/types/register.type';

/**
 * `/solar` — the array register.
 *
 * ## What used to be here
 *
 * A `SectionTabs` scaffold: a title, a subtitle counting the estate's plant, and
 * six empty tabs. It was standing in for two different pages at once, and
 * `SectionTabs` said as much — *"`/gensets` is a register: a list of machines, and
 * the tabs live one level down on each machine. These two are scaffolds for pages
 * that have not been designed yet… standing the strip up first means each page
 * can be planned in the place it will actually live."*
 *
 * That place now exists. The register took this route, the six tabs moved to
 * `solar_.$systemId.tsx`, and the `ComingSoon` bodies went with them, narrowed
 * from the estate to one system — which is what each of them was describing.
 *
 * A row here is a **solar system**: everything PV at one site, taken together.
 * Briefly it was an "array", and that was the wrong unit — an array is the half
 * of a PV system with no electronics, so nothing reads from it. See
 * `system.type.ts`. `/battery` is untouched and still a scaffold: it has no plant model
 * to build a register out of, which is the gap it was put in the rail to name.
 *
 * ## Why there is no view switch
 *
 * The generation report has cards and a table because it draws a chart per array.
 * A register is a table of facts, and a second view of it would be a control with
 * no question behind it. Scale is handled by the search box and the sort, the way
 * `/gensets` handles it.
 */
const SolarRegisterRoute = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  return (
    <SolarRegister
      search={search}
      onSearchChange={(next: SolarRegisterSearch) => {
        // `replace`, so typing in the box does not push a history entry per
        // keystroke — the rule `/gensets` follows for its own search field.
        void navigate({search: () => next, replace: true});
      }}
    />
  );
};

export const Route = createFileRoute('/_authenticated/solar')({
  validateSearch: (search: Record<string, unknown>): SolarRegisterSearch =>
    solarRegisterSearchSchema.parse(search),
  staticData: {crumb: 'Solar'},
  component: SolarRegisterRoute,
});
