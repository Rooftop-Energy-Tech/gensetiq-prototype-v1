import {amount, stampDate} from '@/lib/format';
import {DetailBand} from '@/components/global/DetailBand';
import type {SolarSystem} from '../../types/system.type';

/**
 * `Devices` — what this system is built from.
 *
 * ## What this replaced
 *
 * A table of inverters, one row a box, each a link to a page of that box's dials:
 * output, DC bus voltage, string current, heatsink temperature, insulation
 * resistance, a control pad, and bars for every string on its MPPT inputs. It was
 * the deepest screen in the module and it is gone, because these are telco sites
 * — a tower runs a −48 V DC bus and its loads are DC, so the array feeds the bus
 * and there is no AC stage anywhere on the site for an inverter to make.
 *
 * What is under a solar system on a telco site is glass, cable and a combiner:
 * passive, unmetered, and incapable of reporting anything. So this section is a
 * **description rather than a list**, and it says so by having no rows to click.
 *
 * ## Why the section survived its subject
 *
 * Because the array is still the answer to "what is out there", and that question
 * is what a reader opens `Devices` for. The old route's own doc comment named the
 * gap this now fills: *"What is still missing from this section: the glass."* The
 * boxes went and the glass arrived, which is closer to what the rail's word meant
 * all along.
 *
 * ## The run from a panel to the cabinet
 *
 * Where the array has been surveyed, the rows carry the whole chain rather than a
 * bare string count: two 540 W panels in series make a string, four strings land in a
 * junction box, and the boxes combine into a `PVDU80A` on the way to the cabinet's
 * conversion units. `ArrayWiring` draws it out and `systems.ts` says which sites have
 * it and which do not.
 *
 * The three wiring rows are drawn **only where `wiring` is set** — the four sites with
 * a monitoring unit, which today is every site that has an array at all. Where it is
 * not, the band is what it always was, because the alternative is asserting the screws
 * on a roof nobody has been to.
 *
 * ## What is still missing
 *
 * The modules' make, and the tilt and azimuth they sit at. That last pair is the
 * seed of the only entity this model deliberately left out: a tilt and an azimuth
 * define a *plane*, and a plane is what lets a shortfall be pinned to a piece of
 * roof. Every site on both estates is one plane, so there is nothing to attribute
 * and the level would only ever hold one child. The day a customer arrives with an
 * east and a west roof, this is where the second one shows up.
 */
export const ArrayEquipment = ({system}: {system: SolarSystem}) => (
  <section aria-label="Array" className="flex flex-col gap-3">
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm font-medium text-primary">The array</h2>
      <p className="text-xs text-tertiary">
        Modules, the run from a panel to the cabinet, and how many of those runs are
        dark. Nothing here reports — an array is glass and cable, and every figure on
        this page is the asset register or this app's own arithmetic over the generation
        series.
      </p>
    </div>

    <DetailBand
      ariaLabel="Array details"
      rows={[
        {label: 'System capacity', value: amount(system.kwp, 'kWp')},
        {
          label: 'Modules',
          value: `${system.modules.toLocaleString('en-MY')} × ${system.moduleWatts} W`,
        },
        {
          // With what one is made of, where that is known. `26 × 2 panels` answers
          // the question the bare count raises — a string of what? — and it is the
          // figure that reconciles the modules row above it: 26 × 2 is 52.
          label: 'Strings',
          value:
            system.wiring === null
              ? system.strings.toLocaleString('en-MY')
              : `${system.strings.toLocaleString('en-MY')} × ${system.wiring.panelsPerString} panels`,
        },
        ...(system.wiring === null
          ? []
          : [
              {
                label: 'Junction boxes',
                value: `${system.wiring.junctionBoxes} × ${system.wiring.stringsPerBox} strings`,
              },
              {label: 'Boxes feed', value: system.wiring.feedsInto},
            ]),
        {
          /* An em dash rather than `0`, the rule every reading in this app follows:
             a system with nothing dark has no count to give, and a zero in a column
             of counts reads as a measurement that came back empty. */
          label: 'Strings not delivering',
          value:
            system.downStrings === 0
              ? '—'
              : `${system.downStrings} of ${system.strings.toLocaleString('en-MY')}`,
        },
        {label: 'Commissioned', value: stampDate(system.commissionedAt)},
      ]}
    />
  </section>
);
