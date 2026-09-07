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
 * `system.type.ts`.
 *
 * ## Why there is a view switch after all
 *
 * This note used to argue there should not be: *"a register is a table of facts, and
 * a second view of it would be a control with no question behind it."* It was right
 * about a card view and did not consider the map — which is not a second view of the
 * table but the one fact a table cannot state. See `SolarRegister` for the whole
 * argument and for what the screen is now.
 */
const SolarRegisterRoute = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const handleSearchChange = (next: Partial<SolarRegisterSearch>) => {
    void navigate({
      search: (prev) => ({...prev, ...next}),
      // Typing in the search box would otherwise push one history entry per
      // keystroke. Every other change — switching view, picking a system — is a
      // deliberate move worth a Back. The fleet route's rule.
      replace: 'q' in next,
    });
  };

  return <SolarRegister search={search} onSearchChange={handleSearchChange} />;
};

export const Route = createFileRoute('/_authenticated/solar')({
  validateSearch: (search: Record<string, unknown>): SolarRegisterSearch =>
    solarRegisterSearchSchema.parse(search),
  staticData: {crumb: 'Solar'},
  component: SolarRegisterRoute,
});
