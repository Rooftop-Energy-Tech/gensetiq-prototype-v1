# gensetIQ — prototype

A clickable prototype of **gensetIQ**, Rooftop Energy's genset fleet monitoring
product, built from the
[RooftopIQ V2 Figma](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2463-6889).
It is a thinking tool for product and design: every figure is mock data, and
nothing here ships.

The estate it walks is a **mobile fleet**: gensets trucked to a yard for a job and
brought back. The pages are the fleet (Gensets), the jobs (Deployments), diesel
(Fuel: depot tanks and genset fills), Service, and Reporting (CSV
exports).

**[docs/how-it-works.md](docs/how-it-works.md) explains what the product is for
and the concepts it is built on** — genset, deployment, run, reading, alarm, fuel
reconciliation and the rest — and the rules between them. Read that before
changing behaviour; this file covers what is built and what is faked.

There is no backend. The fleet is mock data and "logging in" writes a flag to
localStorage — see [Caveats](#caveats). Any email and password gets you in.

## Running it

```bash
git clone git@github.com:Rooftop-Energy-Tech/gensetiq-prototype-v1.git
cd gensetiq-prototype-v1
bun install
bun run dev             # http://localhost:3400 — Express Mission, the default
bun run dev:unbranded   # http://localhost:3402 — gensetIQ, unbranded
```

| Script | What it does |
| --- | --- |
| `bun run dev` | dev server on :3400, brand `express-mission` |
| `bun run dev:unbranded` | dev server on :3402, brand `gensetiq` |
| `bun run build` | typecheck, then the `express-mission` build into `dist/` |
| `bun run build:unbranded` | typecheck, then the `gensetiq` build into `dist-unbranded/` |
| `bun run preview` | serve the last build on :3400 |
| `bun run typecheck` | `tsc --noEmit` |

There is no lint or test script. Needs [Bun](https://bun.sh); the lockfile is
`bun.lock`, so npm/pnpm will resolve different versions.

Port 3400: the other prototypes hold :3000, :3100, :3200 and :3300, and every one
pins `strictPort`, so they all run side by side.

## Brands: one build, two estates

The brand is **configuration, not a branch**. `VITE_BRAND` picks it; unset, it is
`express-mission` (`FALLBACK_BRAND` in `vite.config.ts`).

| Brand | Dataset | Estate | Rail | Tab |
| --- | --- | --- | --- | --- |
| `express-mission` | `utility` | 38 pencawang in Peninsular Malaysia, 38 gensets | `#0A2723` | Express Mission Genset Monitoring |
| `gensetiq` | `carrier` | 25 telco sites (Borneo and the peninsula), 30 gensets | `#040710` | gensetIQ |

Everything a brand may change is in **`src/brands/`**, and
[`src/brands/types.ts`](src/brands/types.ts) is the file to read first — it states
the line between *whose app this is* (name, marks, three colours, which estate)
and *what the product is* (everything else). Adding a customer is a file in
`src/brands/catalog/`, a dataset in `src/brands/datasets/`, and an entry in
`manifest.ts`.

Settings carries a **brand picker** wherever more than one brand is in the build.
Switching reloads the page: a brand names a dataset, and the estate is built once
at startup.

### A build only contains the brands it may show

The registry is **generated per build** by the `brands` plugin in
`vite.config.ts`, which emits static imports for those brands alone:

| Build | Carries | Picker |
| --- | --- | --- |
| dev | both | yes |
| production, `gensetiq` (unbranded) | both | yes |
| production, a customer's brand | that brand only | no |

This is the difference between hiding a control and not shipping the data. A
customer's build has no other customer's name, mark or site names in it — not
behind a flag, absent.

One known gap: `deployment/data/realJobs.ts` (BRF9540's measured jobs, with Express
Mission's real yard names) is imported directly rather than through a dataset, so it
is in every bundle. Since 2026-10-05 its jobs are only *shown* on the estate that has
the machine.

### Brand colours and the tab

**Three colours** are the customer's — `brand` (the login CTA and primary button),
`brand-text` (what stays legible on it) and `sidebar` (the rail) — declared per
brand in `src/brands/catalog/*.ts`. Every other token in `styles/colors.ts` is the
design system's, shared by every brand. The one hard constraint on a brand is that
its `sidebar` must be dark enough to carry white foregrounds.

The tab's title, description and favicon live in
[`src/brands/manifest.ts`](src/brands/manifest.ts), a Node-only module the plugin
reads to fill `index.html`. An unknown `VITE_BRAND` is a **hard error at build
time**, so a mistyped brand cannot be deployed. Each dataset is also checked on
load (`assertDatasetIntegrity`).

## The component gallery

**`/gallery`** — every shared component, every state, one page. Dev only: the route
404s in both builds.

```bash
bun run dev   # then http://localhost:3400/gallery
```

It covers the two shared tiers — the primitives in `src/components/ui`, and the
shared pieces in `src/components/global` — plus a full table of the colour palette.
Page-shaped components under `src/modules/*` are not in it: each already renders
against fixture data at its own URL.

What the running app cannot show you is **every state at once**: an alarm pill at
all three severities, a filter card active and inactive, a button in every variant.

- **The brand switcher**, top right, recolours the whole page through the token
  layer — the fastest way to find a hardcoded colour.
- **The token table**, at the foot, draws every token in `styles/colors.ts`
  light-over-dark with its Figma variable beside it.
- **A dark switch** adds the `dark` class. The app ships light-only, but
  `colors.ts` carries a complete dark palette.

The variant lists are tied to each component's `cva` union by a
`Record<Variant, true>`, so adding a variant fails `bun run typecheck` until the
gallery lists it.

## What's built

| Screen | Route | Notes |
| --- | --- | --- |
| Login | `/login` | Wordmark, email + password, teal CTA. Matches the Figma frame. |
| Gensets — list | `/gensets?view=list` | 30 gensets on the carrier estate and 38 on Express Mission's, sortable by attention (faults first): name, the Malaysian state it stands in, run state, alarm counts, fuel level, and — on the full-width list only — location and last updated. `sort=location` orders by state. 20 rows a page, `page=2` onward. |
| Gensets — map | `/gensets?view=map` | Real MapLibre map with live clustering. |
| Genset home | `/gensets/<id>` | The genset's own page, in four bands: the strip (tank, runway, service, alarm counts); the controls and the current run; the tank, `Generator conditions` (the marks while running, the two hour counters always) and `Generator output` (running only); then what the machine is. Every genset has one. |
| Genset analysis | `/gensets/<id>/analysis` | Two readings over one window on a dual-axis chart, with a hover crosshair. Built from the [Figma annotations](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2799-3338) — see [below](#the-analysis-tab). |
| Genset deployments | `/gensets/<id>/runs` | Labelled *Deployments* in the rail: the jobs the set has stood on, the runs inside them on a timeline, totals for the chosen window, the list, and a CSV export. The path stays `/runs` so old links work. Not a Figma frame — see [below](#the-runs-tab-is-not-in-the-design). |
| Genset service | `/gensets/<id>/service` | The most urgent schedule item and its hour and calendar counters; the **Schedule**, a list of items each on its own interval (hours, months or both), editable per genset with **Add item**; the service history with what each visit did; and **Log service**, which ticks the items done. Not a Figma frame. |
| Genset alarms | `/gensets/<id>/alarms` | Every alarm the set carries — its controller's, the site monitoring unit's rows filed against it, and the low-tank row — in a standing table with a cleared log under it. |
| Equipment / Settings | `/gensets/<id>/equipment`, `/gensets/<id>/settings` | Named in the design's rail but not drawn — labelled placeholders (`ComingSoon`) so the rail isn't dead. |
| Deployments — list | `/deployments?view=list` | The register: a row per **job**, the ones standing first, six columns with the headers as the ordering control. 20 jobs a page, `page=2` onward. Not a Figma frame. |
| Deployments — map | `/deployments?view=map` | One pin per job, green standing, brand-tinted booked, grey closed, sized by how much plant is on it. Not a Figma frame. |
| Deployments — timeline | `/deployments?view=gantt` | One lane per machine, one bar per job it is on, on a week-ticked one-month axis with today in the middle. The only view that draws depot time — see [how-it-works](docs/how-it-works.md#the-deployments-register). |
| New deployment | Button above the search on `/deployments` | A dialog: ID, customer, address with a pin, dates, gensets (nearest free first), contacts and a first note. Opens the new deployment's page on Create. |
| Deployment home | `/deployments/<id>` | The job: its window, its state, what it cost in hours, energy and litres, the ratio between the last two, and the machines on it. Not a Figma frame. |
| Deployment gensets | `/deployments/<id>/gensets` | **Where machines go on and come off.** The candidate list offers what is free for the window and names the job blocking anything that is not. |
| Deployment runs | `/deployments/<id>/runs` | The runs of its machines inside the window. No range picker: the window is the job. |
| Deployment alarms | `/deployments/<id>/alarms` | The site's own queue, filtered to this job's machines and window. |
| Deployment settings | `/deployments/<id>/settings` | The ID, the address with a pin you move by moving the map, the dates, the customer and site contacts, a notes log, and End or Delete (a planned deployment only). Read-only once completed. |
| Service — fleet | `/service` | Every genset's service standing in one list, worst first: status, next due, run hours and months against the interval, last service with its report, and **Log service** on each row (the genset Service tab's own dialog). Cards for Overdue / Due soon / In service filter it (a never-serviced set still lists, with its own status); `WXQ 4562` / `SA 4562 D` is seeded overdue so the state has an example, and since 2026-09-30 each estate has two more overdue and five more due soon (`serviceSeed.ts`); search, `State` and a `Status` dropdown (the cards' filter, as a menu) narrow it, with a `Filtered by:` chip row and `Clear all` under the toolbar while any is on. A **History** tab lists every logged service, newest first: number plate, date, technician, run hours at service and the report. Its headers sort like the Due table's (`hsort` / `hdir` in the URL; the Report column doesn't sort), and its phone rows follow the same order. It does not say where the service was done: its `State` and `Location` columns and the `State` filter came off on 2026-10-05, so only the search narrows it. From tablet width up, `Due` and `History` are rows in a second rail on the left (a genset page's `DetailSidebar`); the phone keeps the switch in the toolbar. Both tables show 20 rows a page (`page=2` onward). On the phone bottom nav. At phone width the Due list is a card per genset (status, next due, both interval bars, last service, full-width Log service) and History is two-line rows; both end clear of the floating nav. Not a Figma frame. |
| Fuel — depots | `/fuel` | Each depot's bulk tank checked against what it issued over the last 30 days; no period control at the top of `/fuel`. Each estate has its own depots: Express Mission's four in the peninsula, and the carrier's seven, four of them in Sabah and Sarawak. Opens on two summary cards: *Needs attention*, naming each depot with a verdict and linking to its page, and *Fuel balance*: all depots' supplier deliveries in and issues out for the 30 days, and what is left in them now. Each depot is reconciled against the gensets it supplied: every fill is charged to the depot nearest where the genset stood, so the card sets *Fuel Out* (the bulk tank's falls) against *Reached gensets* (the gensets' own level-sensor rises), and the gap is *Missing in transit*. Every card shows its full breakdown; clicking a card opens the depot's own page. Not a Figma frame — see [how-it-works](docs/how-it-works.md#the-fuel-page). |
| Fuel — one depot | `/fuel/depots/<id>` | One yard: name and street address; the tank, two cards tall and 30% wide with its litres under the drawing, beside the yard's fuel balance (in, out and left) stacked over missing in transit; *Fuel level* over time, with its own 24 hours / 7 days / 30 days / custom picker; *Tank refills* (supplier deliveries); then *Gensets fuelled*, the genset fills it supplied, each with where the set stood. Keeps the Fuel rail; crumb *Fuel / Depots / Klang depot*. The cards cover the last 30 days; the page has no period control of its own. Not a Figma frame. |
| Fuel — history | `/fuel?view=history` | Labelled *History* (*Genset fills* until 2026-10-05): every genset fill in the period, with its *Supplying depot*, under two overview cards (litres filled, and gensets waiting for fuel, which links to the Gensets page filtered to low fuel), searchable, filterable by depot (`&depot=<id>` in the URL, so a depot page's *See all* opens it filtered), with its own 24 hours / 7 days / 30 days / custom picker, and sortable by any column, twenty rows a page. An old `?view=deliveries` link redirects here. |
| `/deployment` | → `/deployments` | The singular path redirects, so links in decks and docs keep working. |
| Reporting | `/reporting` | Three CSV exports over a date range: runs, deployments and genset fills. The range ends now at the latest. Not a Figma frame. |
| Settings | `/settings` | The brand picker where the build carries more than one brand; a `ComingSoon` placeholder otherwise. |

Getting from the fleet into a genset: click its **name** in the list, or the `→`
in the preview panel's header. Clicking a row or a map pin still only *selects*
it into the panel — over the map that arrow is the only way in, since a pin has
nowhere to put a link.

The two lists and the two home pages also lay out for a phone — same routes, at a
narrower window. See [Phone width](#phone-width).

View state lives in the URL, so any state is linkable and the back button steps
through it:

```
/gensets?view=map&q=selangor&id=brf9540&panel=true
/gensets/brf9540/alarms?tag=coolant       # alarms tab, coolant readings showing
/gensets/brf9540/alarms?severity=critical # alarms tab, filtered to criticals
/gensets/brf9540/analysis?keys=coolant-temp,oil-pressure&window=7d
/gensets/brf9540/analysis?from=2026-07-20&to=2026-08-05
/gensets/brf9540/analysis?run=brf9540-run-3           # one run, end to end
/gensets/brf9540/runs?window=all                     # the whole log
/gensets/brf9540/runs?from=2026-07-01&to=2026-07-31   # the range an export covers
/deployments?state=active             # the register, only what is standing
/deployments?state=planned            # what is booked and has not started
/deployments?view=gantt&location=johor # Johor's jobs on the timeline
/deployments?job=standby               # standby jobs only (an estate with job types)
/deployments?q=wxq4562               # every job a plate has been on, spaces optional
/deployments/pe-001-job-0/gensets     # one job's machines, and the way to change them
/fuel?view=history                    # the History tab (every genset fill)
/fuel/depots/klang                    # one depot's own page
/reporting                            # the CSV exports
```

## Layout

```
src/
├── brands/            the brand system: types, manifest, catalog/ (marks, colours),
│                      datasets/ (each estate's sites and gensets)
├── components/
│   ├── global/        Sidebar, MobileNav, TopNav, SummaryCards, DetailSidebar,
│   │                  FilterSelect, TablePager and the other shared pieces
│   └── ui/            shadcn-style primitives (button, input, badge, tabs, dialog, …)
├── layouts/           AuthenticatedLayout — the 94px rail + canvas shell, or the
│                      floating bottom bar below `md`
├── lib/               format.ts (every figure on screen), geo/, map helpers, hooks
├── modules/
│   ├── auth/          localStorage stand-in for a session
│   ├── genset/        the fleet register and a genset's pages: home, analysis,
│   │                  deployments (runs), service, alarms
│   ├── deployment/    the jobs register, the new-deployment dialog, a job's pages
│   ├── fuel/          depot tanks and genset fills
│   ├── service/       the fleet's service standing and history
│   ├── reporting/     the CSV exports
│   ├── settings/      the brand picker
│   ├── gallery/       the dev-only component bench
│   └── site/          site data the other modules read (seeds, monitoring units,
│                      plant alarms); the site screens themselves were removed
├── routes/            file-based TanStack Router tree
└── styles/            colors.ts (token source of truth) + styles.css
```

`routes/_authenticated/gensets_.$gensetId.tsx` — the trailing underscore on
`gensets_` un-nests the detail route from `/gensets`. Without it TanStack treats
the fleet screen as its parent and renders the detail page inside it, and
`GensetsPage` has no `<Outlet />`, so nothing appears at all. `deployments_` and
`fuel_` do the same thing for the same reason.

## Phone width

The four phone destinations have a mobile layout — **Gensets, Deployments, Fuel and
Service** — and so does the genset home page. They are the same routes at a
narrower window, not a second set of `/m/…` ones, so a link works wherever it is
opened.

The line is Tailwind's `md` (768px), and nearly every decision either side of it is
a CSS class. Two are not, and they are in `lib/useIsCompact.ts`: the lists swap a
table for cards (rendering both and hiding one would put every row's links in the
accessibility tree twice) and the map's panel inset is a number rather than a class.

What changes below `md`:

- **the 94px rail becomes a floating bottom bar** — `components/global/MobileNav.tsx`,
  centred, with the page scrolling underneath it. Four destinations: Gensets,
  Deployments, Fuel and Service. Reporting and Settings are desktop-only, and a nav
  item landing on a screen laid out for 1,280px is worse than no item. Every route
  still resolves if a URL is typed or followed from a desktop link — what is
  withheld is *navigation* to a screen the app cannot show properly.
- **the registers become cards** — `GensetsCards.tsx`, `DeploymentsCards.tsx`, and
  the Service and Fuel lists. Not the table with columns dropped: the columns that
  would survive 390px are the ones that say least. The whole card navigates, since
  there is no preview panel at this width to select into.
- **the map and the preview panel are withheld**, and with them the view switcher
  and panel toggle. `?view=map` in a URL is left untouched — the same link opens
  the map on a desktop and the list on a phone.
- **the genset home page stacks.** Its reading order is already vertical, so each
  band's row becomes a column. `ControlPad` keeps its fixed geometry and scrolls
  sideways in its own strip, because it is a set of tap targets and shrinking those
  is a worse answer than swiping.

One pattern is worth knowing before editing these: where the desktop layout is a
wrapping row of a fixed item and a shrinkable one, **`flex-wrap` is the wrong
instruction at phone width.** Both items "fit" on one line once the shrinkable one
is allowed to shrink, and the result is a squeezed column with its contents
spilling under the fixed one. Those rows are `flex-col md:flex-row md:flex-wrap`
instead — see `GensetHome` band 1.

## Relationship to rooftopiq-frontend-v3

Separate app, deliberately: gensetIQ has its own login, its own mark, and its own
rail (Gensets, Deployments, Fuel, Service, Reporting). Nothing in
`rooftopiq-frontend-v3` was touched.

It shares that app's **design system**, though. `src/styles/colors.ts` is lifted
from it, and every value that exists in both is byte-identical — each one was
checked against the Figma variables on these frames (`bg-canvas #070e1d`,
`bg-element #151c28`, `bg-sidebar #040710`, `bg-overlay #121826`,
`bd-subtle #ffffff1a`). Two deliberate differences:

- **`brand` is the active brand's colour**, not Rooftop Energy's gold — teal
  `#21B0B0` on gensetIQ (the accent in the IQ mark), green `#045832` on Express
  Mission. `teal #14B8A6` is a second, greener teal the
  design uses for the sidebar avatar.
- **A `STATUS` group was added** for run states. Only `status-running #3B82F6` is
  pinned by the design; the rest follow the same Tailwind-500 family.
- **`FUEL` and `SEVERITY` groups were added** for the genset home page. Both are
  pinned to primitives the design exports directly: violet `#8B5CF6` / `#A78BFA`
  for the tank, and red `#EF4444` / amber `#F59E0B` / green `#22C55E` for alert
  severity. There is deliberately no `severity-neutral` — the design's neutral
  bell is `#F0F2F5`, which *is* `text-strong`, so neutral reuses `text-primary`
  rather than duplicating a variable.

Measured against the Figma frames, the shell matches: 94px rail, 44px top nav,
373×36 search, 70×36 view switcher, 393px detail panel, 40px header rows, 52px
body rows.

## Where this departs from the mock-up

All judgement calls worth knowing about.

### The fleet screens

1. **The detail panel reflows the list instead of covering it.** In Figma the
   panel floats over the table's right-hand columns, so "Location" is clipped and
   "Last updated" is hidden entirely. Here the table takes the remaining width
   and its columns are proportional rather than a flat 262px, which keeps
   `BRF9540 | Cummins 1000 kVA` from truncating in every row. Over the *map* the
   panel still floats, as designed.
2. **Map pins are coloured by run state.** The mock-up shows mostly dark pins and
   one blue — and blue is exactly the `RUNNING` colour from the badge — so this
   reads as extending what the design already started rather than inventing it.
   The selected pin gets a teal ring.
3. **The "Activity" section is not drawn.** An event feed filled it for a while
   (`ActivityFeed`, kept but unused); it went when the genset page dropped it.

### The genset home page

The band numbers below are from the page's earlier layout; today's four bands are
listed in `GensetHome.tsx`. The arguments still hold.

The layout, spacing and every component's construction follow the frame. The
**numbers** do not, and that is the significant departure.

1. **The figures are derived, not transcribed.** The frame's placeholders
   contradict each other in three places: 10 kW of load beside 24.2 L/hr of fuel
   (a factor of twenty out for the same machine), a run stamped 8:09 → 10:24
   labelled "12 hours", and a green "Optimum" verdict beside a "Critical 2" chip.
   No assignment of values satisfies all three, so `data/detail.ts` derives every
   figure from two givens — the tank state and run state in `fleet.ts` — plus one
   physical constant (0.28 L per kWh). The run's totals, the burn rate, the refuel
   date and the tank runway therefore move together and cannot disagree.

   The one thing kept from the frame is its *shape*: `BRF9540`'s load is pinned so
   its run lands on the design's "12 hours", and the runway formula is the one the
   frame's badge encodes — "39 hours to 30%" is exactly
   `(1623 − 0.3 × 2300) ÷ 24.2`.

2. **The condition verdict is derived from the alerts**, so it reads `Critical` on
   `BRF9540` where the frame says `Optimum` beside `Critical 2`. Those two cannot
   both be true. The chip counts are 2 critical, **4** warning, 3 neutral against
   the design's 2 / 5 / 3: once the alarm list became the register map's, the fifth
   warning stopped existing. The map has six `Warning` bits, one is `AL Common Wrn`
   (omitted — see 4), and the last is `AL Overload Wrn`, which would have to put
   this unit over its nameplate while its load is pinned at 205 kW so the run lands
   on the design's "12 hours". Nothing real satisfies both, and the count is the
   softer constraint.

3. **Alert readings violate their thresholds.** The frame shows "Starter battery
   voltage — 1 V" under an undervoltage warning; 1 V is not a reading a 24 V system
   can produce. Every active alert forces its reading to a value that actually
   trips it (21.8 V under `AL Battery Voltage`), because the number under an alert
   is what makes the alert checkable. Where two bits watch one reading, the more
   extreme value wins — `AL Battery Flat` cannot sit above a voltage that does not
   trip it.

4. **The alarms are the register map's, not invented ones.** The alarm list is the
   Modbus map's bits marked *To Include in Dashboard*, each carrying its register,
   bit and Type — and the page shows no others. An earlier revision of
   `data/detail.ts` filled the pool with plausible-sounding rules ("Slow to accept
   load", "Repeat cranking"); they are gone, because an alarm the panel cannot
   raise is one the dashboard must not show. Three consequences:

   - **26 of the map's 31 marked bits are here.** The five `AL Common *` roll-ups
     are omitted. They are not duplicates — each ORs over *every* protection in the
     controller, including the 21 alarm bits the map does **not** mark for display
     (`AL Fuel Level Sd`, the `AL AIN` sensor pairs, `AL Mains Fail`,
     `AL Maintenance 1–3`, fence and rental timers), so `AL Common Sd` can be true
     when nothing on this page is. That is worth showing, but only as *explained*
     vs *unexplained*, and computing that needs a column the map lacks: 19 bits are
     typed only `Alarm`, and whether `AL Overspeed` is a shutdown, a breaker-open
     or a stop is a per-protection panel setting. Out until then. This is a design
     prototype; it should not draw a control whose behaviour it cannot state.
   - Four rows in that column carry no Type — `AVR Up`, `AVR Down`, `Speed Up`,
     `Speed Down`. They are the controller's trim outputs, not alarms, and belong
     on the page as state rather than in an alarm list.
   - `Communications loss` is the one alarm with no register behind it, and cannot
     have one: the panel is the thing that went quiet, so it is the ingest layer
     noticing the silence. It carries `register: 0` to mark that.

   The map names the bits but not their **setpoints**, which are per-site
   commissioning values. Those limits are the one invented quantity left, set at
   the conventional points for a 415 V / 50 Hz / 1500 rpm set.

   An overload alarm sets the unit's **load**, rather than overwriting the power
   reading once everything is derived. Doing it the other way round would leave the
   gauge at 928 kW over a run costed at 205 kW's worth of diesel; setting the load
   carries through to the burn rate, the phase currents and the refuel runway
   together.

5. **The tags are grouped around the alarm map.** The first set was drawn against
   the invented pool and grouped the real one badly — `Generator output` held ten
   alarms, `SLA performance` and `Fuel system` held none. The ten now are
   `Speed & frequency`, `Generator voltage`, `Load & current`, `Coolant`,
   `Battery & charging`, `Lubrication`, `Starting`, `Fuel`, `Service` and
   `Panel & comms`, and every alarm reaches one. `Fuel` draws none from the map —
   `AL Fuel Level Wrn` and `AL Fuel Level Sd` are both unmarked, which is a question
   for the customer rather than a hole to paper over — but the chip is not empty:
   the fuel reconciliation and the tank level both file under it, and both are the
   app's own arithmetic, which their cards say where an alarm prints its register
   and bit.

6. **The repeated placeholders are named.** The frame repeats "Oil pressure" for
   two of four gauges, "Load" for both bar groups, and "Generator condition" for
   eight of eleven tag chips. Here the gauges are frequency, active power, oil
   pressure, coolant temperature and charge alternator voltage; the bar groups are
   line voltage and phase current; and the tags are nine distinct subsystems.

   The dials are the page's only instantaneous instrument, so each carries one
   reading from a different subsystem that can kill a running set — governor,
   load, lubrication, cooling, charging — and none repeats the bars beside them
   or the fuel panel above. Frequency rather than engine speed because on a
   four-pole 50 Hz set the two are one measurement and frequency is the half the
   load sees. The scale ends are a resolution decision, not decoration: `TickGauge`
   draws 39 ticks, so each dial is set to put its healthy value near mid-face and
   keep every alarm limit on the face. That is why frequency runs 45–55 rather
   than 0–60, coolant 40–120 rather than 0–120, and active power to 1.2 × rating
   rather than to rating — a dial ending at rated pegs full for both overload
   bits and cannot tell a set at its limit from one past it.

7. **The dials are SVG, not the exported bitmap.** Figma ships the gauge as two
   PNGs — a tick ring in `text-subtle` and the same ring in teal, clipped by a box
   whose width *is* the value. Reproducing that literally would mean one bitmap per
   value, so `TickGauge.tsx` redraws it: same 76-ticks-per-circle pitch (39 over the
   visible 180°) and the same 36.5 → 47.5 radial band in a 97px square.

8. **Band 2 empties when the engine stops**, replaced by one line of text. The
   frame only draws a running unit; every genset has a page here, and a row of
   dials pinned at zero reads as a broken page rather than a stopped engine.

9. **START and STOP are inert, and say so.** Mode switching works. The two
   commands are refused outside `MANUAL` and outside the state they'd change, and
   their tooltips state plainly that no controller is wired up — a button that
   appears to crank a diesel engine and silently does nothing is worse than one
   that admits it.

   Refused tiles carry `aria-disabled`, not `disabled`. A genuinely disabled control
   receives no pointer events in Chrome or Safari and cannot take focus, so its
   tooltip never opens — which meant the pad greyed out its commands and then
   explained nothing, the exact opposite of the intent above. The changeover on the
   site page refuses options the same way, for the same reason.

10. **The strip, the day and the details answer this estate's questions rather
    than the frame's.** The frame opens on `Generation today` beside `Fuel level`
    and closes the page's identity band with the machine's nameplate and its tank.
    On a grid-backed yard that is a fair pair of questions. On a tower a lorry has
    to reach it is not: nobody is deciding whether the engine works, they are
    deciding **whether somebody drives out there this week**, and that trip is a
    day and a four-figure sum.

    So the **strip is three**: the tank, its runway, and the service counter. The
    tank says how much is there, the runway says when that stops being true, and
    service says whether the same trip has a second job on it. All three survive a
    stopped engine, which is what a summary has to do — a set standing idle is
    exactly the one whose service goes quietly overdue.

    **The runway's unit follows the machine, not the house style.**
    `runtimeSpan` reads in hours below two days and days above it, so the frame's
    `39 hours` is still hours on a 2,450 L set at 24.2 L/hr, and a 400 L tank on a
    20 kVa machine reads `2.8 days`. Fixing the unit either way breaks one end: a
    1,000 L bulk tank on a small set is `247 hours`, a figure a reader has to
    divide before it means anything.

    **`Generation today` did not disappear, it moved** — into a second column on
    the run card, beside the run's own totals, with the day's hours, litres and
    starts. Four figures that are each useless alone: an engine that ran four hours
    across three starts for 61 kWh on 24 L is a legible morning, and any one of
    those numbers by itself is not. What the strip's version invited was a
    *share-of-site* reading, and this page cannot honestly give one — an engine's
    output may go into a battery and come back out tomorrow, so what fraction of
    today's site energy it carried is a question about the site's day, not the
    machine's. The solar pages are where a share belongs.

    The day is a **column and not a card**, and it was a card first. On a set with
    one run today — much the commonest case — the card beside the run printed the
    same four numbers, which reads as a rendering fault rather than as an
    arithmetic identity. As a column that identity is the point: the two agree when
    this run *is* today's work, and where they diverge the difference is on one row
    at one scale. `Starts` reading `1 · 0` is the case worth having: this run is a
    start, and it began before midnight, so yesterday owns it.

    **The details band is identity, and deliberately only that** — number plate,
    asset tag, make and model, rating. A set is bolted to its lorry, so its **number
    plate** (`PGW 9748`) is the lorry's too, and is what every list calls it. The
    asset tag (`CUM-672771`) is the serial, shown only here and in the header's info
    tooltip. `Tank capacity` left the band because the fuel panel one band up already
    states it as `Max capacity`, beside the level it is the denominator of; a figure
    printed twice on one page is one a reader has to check against itself. The
    rating stays because it is the denominator of every load figure above it.

    What the band does **not** carry is the instrumentation — controller model,
    register numbers, fuel-sensor scaling, whether a tank is one bulk vessel or a
    day tank fed from it. Every one of those is a real question about a real site
    and not one of them is settled; they belong to whoever wires the ingest up, and
    a details block that guessed would be this prototype asserting facts it has not
    got.

### Hovering a state is not in the design

The Figma draws the map as pins over a basemap and nothing else. Every register can
be narrowed by status, and the fleet register by state as well — but a filter answers
*show me only Sarawak*, and the map is where a reader asks how Sarawak compares with
the rest. Counting pins by eye across two landmasses is not asking.

So the map carries state borders at every zoom — neutral, and weighted so they hold
their own over empty sea and over Voyager at its busiest alike — and answers on
hover: the cursor inside a state washes that state in, draws its name and count once
at the centre of all that state's land, and fades every pin and cluster bubble
standing elsewhere.

**The label is a card in the brand colour** — the state's name large, its count
smaller under it, on a solid plate filled with `brand` and lettered in `brand-text`.
It was two lines of dark text with a halo, and over Voyager's roads and place names
the answer to the gesture read as one more map label. Brand-coloured *text* on a
light plate was the other option and fails on the product's own teal, which is about
2.5:1 on `bg-element`; the fill clears it on every brand. It is a DOM marker rather
than a symbol layer, so it takes the app's font and a shadow, and it ignores the
pointer so the hover underneath it does not flicker.

**The label is one point, not one per landmass.** Anything anchored to the polygons
lands once per *part* — Sabah is eight pieces, so a symbol layer wrote its name across
eight islands — so the label is placed from sixteen points instead, one per state, at
the area-weighted centre of every part. Penang is the case that shows what that means: 71%
mainland, 29% island, and its label sits between them rather than deep in Seberang
Perai. All sixteen fall on land, which `src/lib/geo/malaysiaStates.ts` says is
checked rather than assumed.

The borders were hidden until hovered at first, on the argument that a map of the
country already has a country on it. True, and beside the point: it left the reader
nothing to aim at, and a border that only appears once you have found it is not an
affordance. So the borders are furniture, doing the job the basemap's coastline does,
and the wash, the label and the dimmed fleet are the hover.

Four choices worth stating, because each had a cheaper wrong version:

- **It dims rather than filters.** The question is how one state compares with the
  rest, so the rest stays visible at 18%. Hiding it would answer a different question,
  and the toolbar already answers that one.
- **The wash and the border are one set of shapes.** The tint stops exactly at the
  line because they are the same geometry. Drawing the border from the basemap's own
  tiles instead is exact — it is what the reader can see — but those tiles carry no
  per-state identity, so nothing can be shaded *inside* one, and a wash from our
  polygons inside a border from theirs spilled across it. See below.
- **The hover adds no second line.** The border does not thicken or change colour
  under the cursor; the wash marks the state instead. One border, always the same
  weight, is one less thing moving.
- **The count follows the toolbar**, so `Offline` + Sarawak reads "offline sets in
  Sarawak". It is a count of what is drawn. This is the one figure on the screen that
  parts company with the summary cards above the table, which hold still on purpose.
- **A cluster is judged by its members, not its position.** It stays lit if any of
  what it swallowed is in the hovered state. The map opens at a zoom where the Klang
  Valley is one bubble over four states.

**The gensets and deployments maps open on the whole peninsula**, Perlis to Johor, when no filter or
search is on. It holds that frame until you scroll the list or change a filter.

**Clicking a state frames it.** The hover says how much is here; the click says show
me. A click on the basemap inside a state fits the viewport to the whole of that state
— islands included, centred, with the same padding the fleet is framed with. On the
gensets and deployments registers it also sets the `State` filter to that state, so
the list narrows to what stands there (`All states`, or Back, undoes it). A state with
nothing in it filters to an empty list, and the dropdown lists it at 0 while it is
picked. The map then keeps the state's frame instead of re-fitting to its pins, until
you scroll the list or change another filter. The sites map only frames. A click on a
pin or a bubble still does what it did; the state only answers when nothing on the
fleet was hit.

**The dropdowns' counts follow the other filters.** Pick Johor and `Status`, `Alarm`
and `Fuel level` count only Johor's sets; each dropdown counts over what the other
filters leave, so an option's number is what picking it shows. Zeros stay, greyed.
The summary cards above the table (`Status`, `Alarm`) still count the whole fleet, and
both are filters, named for the table columns they count. `Due for service` was a third
card until 2026-09-29; `?service=due` still filters from a link.

**Capacity is in the preview panel only.** The `Capacity` dropdown and the table's
`Capacity` column came off on 2026-09-29; the panel states each set's kVA rating. An
old link carrying `?capacity=1000` still filters, and its chip clears it. Beside the
map the list and the map take half the width each (60/40 until 2026-09-30), on Gensets and Deployments alike.

**Deployments has the same controls.** A plate search (spaces optional, and the job
reference too), `State` and `Status` dropdowns with the same faceted counts, the
`Filtered by:` chip row, and three cards: `Status`, `Deployments`, `Gensets out`. A job's state is read off its yard's position and uses the gensets
page's `?location=` param. The table spaces its seven columns (State beside the job) with equal gaps, and
scrolls sideways beside the map where they do not fit. Machines show as plates.

**A `Filtered by:` row appears under the toolbar while any filter is on** — one chip
per filter (search, State, Status, Alarm, Fuel level, the summary chip, Service due),
each with an ✕ to remove it, and `Clear all` to reset them together. It is gone when
nothing is filtering.

**Hovering a pin shows its plate and street address.** Every site seed carries a mock
`address` (real town and postcode, invented lot number), and a genset takes its site's.
The `Location` column, the preview panel and the genset page's header show it under the
town.

The box it fits to is measured on the drawn copy of the shapes, not the coarse one the
click is resolved against. The coarse copy drops islands under ~6 km², which would put
Terengganu's frame 22 km short of Redang and the Perhentians and Labuan's 7 km short
of its own east coast. The build script measures the box once on the fine copy and
carries it on both as each feature's `bbox`.

**The borders are drawn from our own shapes, and the basemap's are switched off.**
This took several goes and the reasoning is worth keeping, because the obvious answer
is the wrong one.

Drawing the basemap's own boundary layer is *exact* — it is the geometry the reader
can see, so it cannot be a pixel out. What it cannot do is have anything drawn inside
it. Voyager's boundary tiles carry only `admin_level` and `maritime`; there is no
per-state identity in them, so "Sarawak" cannot be selected out of that geometry. The
wash therefore has to come from our polygons — and our polygons disagree with the
basemap's boundary by **130 m on average and 850 m at worst**, measured by sampling
its tiles against this dataset *unsimplified*. Two OSM snapshots cut at different
times; no amount of detail closes it. The shading spilled across the line.

So both come from one set of shapes. Voyager's `boundary_state` — a pale pink dashed
hairline — is hidden, and so are its two country layers, `boundary_country_outline`
and `boundary_country_inner`, a pale band with a pink line on it. Ours sits over the
basemap's land, rivers, roads and buildings, and under its sea, bridges and labels
(2026-10-01; under the roads, a border vanished wherever it crossed a town). One border, a wash that
fits it, and nothing for either to disagree with. The cost of the country layers: they hold every country
border in the tiles, so borders between two *other* countries — Thailand–Myanmar —
go too. Every border of Malaysia is still drawn, from our shapes.

**A coast, a land border and a border between two states are one line.** They were
not, and the cause was geometry rather than style: the line strokes each state's
outline, so an edge two states share is stroked twice and a coast or a border with
another country is stroked once. Translucent, the shared edges came out at nearly
double the darkness and the coast read as a fainter kind of line. The stroke is now
opaque, in the colour the doubled one reached over the basemap's land, so drawing it
twice is the same as drawing it once — and every edge, islands included, has the
weight the internal borders had.

`findBasemapBoundaries` locates the basemap's layers structurally — a line layer over
a vector source whose filter compares `admin_level` to 2 or 4 — rather than trusting
the ids, since a basemap is versioned by somebody else. It exists only to turn those
layers off.

**The coast is the basemap's own (2026-09-30).** Our shapes were OSM in 2017 (today's
since 2026-10-01, below); the basemap is OSM today, generalised afresh at every zoom. Drawn from our shapes, the coast
cut across Penang's reclaimed land, missed Forest City and ran a hundred metres off the
Johor shore. So the coast is now traced at runtime off the ocean polygons in the tiles
on screen (`src/lib/geo/coastline.ts`) and cannot be a pixel off. Only Malaysia's shore
is kept: a stretch counts if our outline is within 3–5 km and nearer than any
neighbour's, which is what leaves Singapore's side of the Johor Strait, the Thai islands
off Langkawi and the Philippine Turtle Islands unlined.

The borders between states and the land borders still come from our shapes, cut out of
the outlines by the build and drawn once each. Where one meets the coast the build
carries it a kilometre out to sea, and the basemap's ocean, lifted above our borders,
roads and buildings but kept under its bridges and labels, trims it at the shore. Lakes and rivers stay under the
borders, because the Bernam, the Golok and a dozen other rivers are borders.

The hover wash follows the same shore. It is painted solid on the basemap's bare
ground, under its parks, roads and water, and a band along each state's coast
carries it up to 1.5 km out (less where Singapore or another state is near). The
basemap's water cuts it off at today's shore, so reclaimed land such as Gurney Wharf
and the Penaga strip is washed with the rest of Penang.

**Two copies, for two jobs.** They are OpenStreetMap as it stood on 2026-10-01: OSM's
state relations from Overpass, cut to OSM's land polygons (about half the relations run
out to sea, Sabah's nearly 200 km), with the land borders from relation 2108121's
non-maritime ways and the neighbours' coasts from the same land polygons. Land inside
Malaysia's national boundary that no state relation reaches (Pulau Aur, Pulau Jarak,
Layang-Layang, slivers along coasts) goes to the nearest state, and islands down to
250 m² are kept; without both, those shores went unlined. ODbL 1.0,
credited by the basemap's own OpenStreetMap attribution. Until 2026-10-01 they were
geoBoundaries `gbOpen` ADM1, OSM in 2017. Rebuild with `src/lib/geo/fetchOsmStates.py`
then `buildMalaysiaStates.mjs`; the first's header has the steps.

| file | detail | used for |
| --- | --- | --- |
| `public/malaysia-states.geo.json` | ~22 m, 1.3 MB | the hover wash, and telling Malaysia's shore from a neighbour's |
| `public/malaysia-state-borders.geo.json` | ~22 m, 381 kB | the borders between states and the land borders |
| `public/malaysia-state-shores.geo.json` | ~55 m, 496 kB | the wash's band out to today's shore |
| `public/malaysia-neighbours.geo.json` | ~22 m, 244 kB | the neighbours' outlines within 6 km, never drawn |
| `src/lib/geo/malaysiaStates.geo.json` | ~440 m, 94 kB | point-in-polygon, and the label anchors |

The fine one is **served, not bundled** — it would otherwise be the largest thing in
the JavaScript, MapLibre fetches a source by URL happily, and nothing needs it before
the map has painted. It is still a file in this repo, so a fresh clone with no network
still has its borders. The coarse one is bundled because what it answers is
synchronous — which state is this genset in, which state is the cursor in — and 440 m
cannot change either answer.

Still committed rather than fetched from a service, for the reason the basemap is
CARTO's: nothing here should be able to be down on the morning of a demo. A coastline
is a generalisation either way, so a site within ~5 km of a coast counts as standing
in the state it plainly stands in — fifteen sites needed that under Natural Earth, one
does under OSM, which is as good a measure of the two datasets as any.
`src/lib/geo/malaysiaStates.ts` holds the lookup and the reasoning;
`buildMalaysiaStates.mjs` beside it is the whole derivation.

All three maps carry it — gensets, sites and deployments — through one shared
`attachStateHover`, for the reason the three cluster bubbles are one
`clusterDonut`: three copies of this is the drift the map components already work
to avoid.

### Putting gensets on a job

The design has no such control, and the app had no way to express one: `Genset.siteId`
was seeded and permanent. It then became a `localStorage` override a site's Settings tab
could write, which placed a machine with **no window** behind it — and a window is the
thing a hire fleet is managed in. So the control moved to the job: a machine goes on a
deployment from `/deployments/<id>/gensets`, and `Genset.siteId` is **derived** from
whichever membership is active. A site offers one control now, and it starts a job.

Seven things worth knowing.

1. **A job going active moves its machines.** A site is a customer's *yard* —
   `fleet.ts` puts co-sited units within a hundred metres of each other because that is
   what sharing a site means. So a set takes on the site's placename and a spot in its
   yard, and its pin moves on the fleet map. That is forced rather than chosen:
   membership you could set without moving anything would let a Penang set belong to a
   Petaling Jaya site, and every figure that made a site *a place* would describe two
   places at once.

   **Collecting moves nothing.** The set leaves the job and is still standing in that
   yard until somebody comes for it, so the site is derived and the coordinates are
   last known. Inventing a depot coordinate would be a claim about the physical world
   this app has not earned. **A planned job moves nothing either**: the commitment is
   real and the lorry has not been called.

2. **A site's position and load are now seeded, not derived.** Both used to come from
   the members — placename from the first genset, coordinates from their mean — and
   both had to stop. A yard must know where it is *before* a set arrives or deploying
   one has nowhere to send it; removal makes empty sites reachable, and those used to
   compute to 0°, 0° and "Unknown"; and once deploying relocates a machine, deriving
   the site's position from it is a loop with no fixed point. Every seeded value is
   exactly what the old derivation produced, so nothing moved.

3. **`Genset.siteId` is nullable, and derived.** "A unit is always at exactly one site"
   was documented as a virtue and is the half of that invariant deliberately given up:
   it was true only because nothing could move a machine. Gensets genuinely exist before
   deployment and while away being serviced, and the alternative was forcing every
   removal to be a transfer to somewhere the set is not.

   The load-bearing half survives, and it moved from being a property of a map's shape
   to being **a rule the store enforces on every write**: a machine may not be on two
   jobs whose windows overlap, so it is at one site or none, never two. The refusal
   names the job in the way, because "already out" is not an answer a reader can act on.

4. **The site load is a site fact.** It was scaled off installed genset capacity — a
   convenience that quietly made the customer's consumption a function of the machinery
   parked outside. Detaching made that plainly wrong: strip a yard and it would appear
   to stop using electricity. It also let one load carry two numbers, with `mfg-015`
   reading 152 kW beside its own genset reporting 175 kW. Now `removing a genset does
   not change what the customer draws`, which is the only defensible behaviour, and the
   two figures agree. The intended direction is a metering *device* on the site
   reporting a consumption pattern, and this seed becomes its reading — that device was
   built and has since been cut back out; its design is in GEN-24.

5. **Summaries are memoised, not built once.** They used to be a module const, argued
   for on the grounds that one pass meant one clock reading. That reason survives
   untouched — `buildSummary` reads no clock — so they are now rebuilt on the deployed
   fleet's identity instead. It is cheap for one specific reason: **`detail.ts` and
   `history.ts` never look at where a machine is**, so relocating a set cannot
   invalidate a reading or a run.

6. **`SITE_SEED` moved to its own import-free file.** `deployment.ts` needs a yard's
   position to move a machine to it, and `sites.ts` reads the deployed fleet — so
   leaving the seed in `sites.ts` closes an import cycle. Pure data at the bottom of
   the graph breaks it.

7. **Nothing in `deployment/data/` computes at import time**, and that is not tidiness.
   The record's deal reads the fuel ladder, the ladder comes off a machine's detail, and
   a machine's detail used to read placement to answer *where is this machine* — a circle
   that is fine as imports and fatal as an execution order. It recursed until the stack
   gave out. `gensetById` moved to the placement module, `history.ts` and
   `fuelIntegrity.ts` read the **seeded** row through `seededGenset()`, and the deal
   happens on first access.

Left out deliberately: a machine **joining a job mid-window**. A shared window cannot
express a fourth set arriving in week three, and the escape hatch is a successor job.
If Express Mission's real jobs work that way, the two dates move onto the membership.
Creating and deleting *sites* is also absent — a different feature with its own
questions.

### Fuel leakage is not in the design

The design has no fuel leak alarm, and the app had no way to express one: `detail.ts`
derived the consumption rate from the electrical load and `history.ts` integrated the
tank level from that same rate, so the level sensor and the flow meter were literally
one curve drawn twice and could not disagree. The condition this alarm exists to catch
was unrepresentable. `history.ts` now carries a seeded loss alongside the burn, which
is the change everything else rests on.

Five things worth knowing. The concept itself is in
[how-it-works](docs/how-it-works.md#fuel-reconciliation).

1. **It is the app's arithmetic, not a controller bit.** `alert.type.ts` is emphatic
   that a `GensetAlert` is a bit in the Modbus register map. No panel raises this one,
   because no panel sees both instruments at once. So it has its own type and prints
   `Fuel reconciliation` where an alarm prints its register and bit — as a service
   alarm prints `Service schedule` (service items falling due are alarms since
   2026-10-05; see how-it-works, *Alert*).

2. **There is no screen for it — it runs on its defaults.** The check is on wherever
   both instruments are fitted, and off where they are not, at the threshold floor the
   instruments' own accuracy sets. A switch and a threshold field used to sit on the
   Settings tab; that tab is empty again, and getting them back is the main thing it
   is waiting for. This is the only threshold the *app* owns — every other limit on
   the machine is a commissioning value in the panel, which a screen has no business
   letting you retype — so it is the one setting a save would actually change. Two
   things to preserve when it is redrawn: on a set that cannot reconcile the control
   should be inoperable and name the instrument it wants rather than be absent, and it
   should default on, because the alternative fails silently — a customer who paid for
   flow meters and never found a switch gets nothing back for them, and no screen says
   so.

3. **The threshold is a percentage of tank capacity, floored at the probe's own
   accuracy.** Percent because it is the only form that carries across a fleet of
   600 L and 3,000 L tanks; floored because a line finer than the instrument can
   resolve is an alarm that is always on, and an alarm that is always on is one that
   gets closed. The litres it implies are shown beside it, since that is what
   somebody deciding whether to send a van actually reasons in.

4. **A leak moves the condition verdict.** So does an overdue service since it became
   an alarm (2026-10-05), but only to `Attention`. `Optimum` over a set losing eighty
   litres a night would cost the reader their trust in every other verdict. That ripples into the fleet sort, the
   site roll-up and both map layers, so the seeded leaks are placed away from
   `BRF9540` and `telco-001` — the two fixtures diffed against the Figma. `BRF9540`
   carries both instruments and reconciles cleanly, so the panel is demonstrable on
   the design's own unit without moving its pinned alarm counts.

5. **The page shows its working.** Nine rows, in the order the calculation is
   performed: what was there, what went in, what was burned, what should be left,
   what is left, and the two deductions that turn the difference into something worth
   alarming on. This verdict sends a person to a site, which is a more expensive
   action than any other alarm here provokes, so it is the one that most needs to be
   arguable rather than merely trusted.

**Not built:** plotting expected-versus-actual tank level on the analysis tab. That
picker draws from the controller's readings, and admitting a derived quantity to it
settles a larger question this change did not need to answer. It is the obvious next
step and the strongest argument for opening the picker up.

### The runs tab is not in the design

The Figma names `Runs` in the tab strip and draws nothing behind it, so the whole
page is an argument rather than an interpretation. It is built from what the model
already holds — a run is a start, a stop, energy and fuel, and `history.ts` has
sixty days of them — plus the one thing the arrow on the home page's run card
implies: a reader looking at one run's totals wants to know how it compares.

Three bands: a timeline strip, totals for the chosen window, then the log. The strip
leads because it is the only part that answers a question without arithmetic — how
often this machine runs, and how long since it last did.

The one rule worth knowing before reading the page: **listing and totalling are
different questions.** The list shows every run that was *turning* during the window,
including one that began before it opened; the totals claim only the runs that
started inside it and have finished. Rows the totals do not claim are listed with
their figures dimmed. The full reasoning is in
[how-it-works](docs/how-it-works.md#the-runs-tab).

**Export CSV** is the part with no design precedent at all. It writes the chosen
range to a file, client-side. Two facts are written into it that a spreadsheet has
no other way to carry: whether the range covered is the range that was asked for
(the log has a sixty-day horizon, and a request past it is clamped), and that an
open run is listed but excluded from the totals — otherwise the same export returns
different numbers half an hour apart.

Deliberately not built, and each for its own reason: **start and stop cause** (no
source for it — a `Genset` carries a current `startReason`, which is not a per-run
record), **efficiency figures**, **fuel discrepancy**, and a **branded PDF**, which
is a different deliverable from a data file and needs a template this repo has no
business inventing.

### The analysis tab

The Figma frame is the home page duplicated with three notes pasted over it:
`number/value multiselect`, `date range or select by deployment/ run`, and `graph`
in the middle of a full-width panel. That is a toolbar of two controls over one
large chart, and the layout follows it exactly. Everything below is a decision the
notes left open.

**Two readings at a time, on two axes.** Readings have incompatible units, so a
third series would either share a scale that fits neither or force everything onto
a percentage of its own range, at which point the numbers stop being numbers. Teal
takes the left axis, violet the right, and the colour is the only thing tying a
trace to its scale — the picker chips are the legend.

**The picker offers trends and nothing else.** `Engine hours` only climbs,
`Mains outages (30 d)` is already an aggregate over a window, and `Crank time` is
measured once per start. Each reading carries a `kind`, and only `instantaneous`
ones are offered — see `types/telemetry.type.ts`.

**A stopped engine is a gap, not a zero.** Oil pressure and phase current are
properties of a machine in motion; a parked set does not have a low one, it has
none. The trace breaks over those periods and the runs behind it are shaded, so
the break is explained rather than looking like missing data. This is also why
selecting a *run* is the most useful range: it is the only window over which every
reading on the machine is defined.

**Thresholds are drawn.** `AlertRule` now carries a numeric `limit` and a
comparator, and its prose (`< 24 V`) is derived from them rather than typed beside
them. The chart draws the limit on that series' own axis and marks where the trace
crossed it, which is the thing that makes this tab an argument rather than a
prettier gauge.

**The history is invented, but consistently.** There is no time-series API, so
`data/history.ts` generates one — and the generator is the interesting part, not
the chart. Every series is built *backwards* from the value `detail.ts` already
publishes and eased onto it at the right-hand edge, so the last point on the chart
and the reading on the home page are the same number. The run log's newest entry
**is** `detail.run`, not a copy. Fuel level is integrated from the burn rate over
a fixed grid rather than wobbled around a mean, so its slope is a real quantity.
Noise is a ladder of octaves from eight days down to seven minutes, each faded out
once the window's bucket is too coarse to resolve it — so zooming in reveals
detail instead of replacing the picture.

**Three ways to pick a window, sharing one precedence.** A preset
(`24 hours / 7 days / 30 days`) is anchored to now. A **custom range** is two
local calendar dates, `?from=2026-07-20&to=2026-08-05`, resolved to the start of
the first day and the end of the last — so a single-day pick is that whole day
rather than a zero-width window. A **run** is anchored to an event. Each control
clears the other two, so the contradiction is not normally reachable; the URL can
still express it, and `analysisRange()` resolves run over custom over preset in
one place rather than three components agreeing not to conflict.

The calendar is hand-built (`analysis/RangeCalendar.tsx`) for the same reason the
chart is — two months of buttons against a dependency that arrives with its own
theming to override. It clamps to `historyStart()`, the layer's own 60-day
horizon: selecting a February that would come back flat would read as "the machine
did nothing" rather than "we do not hold this".

**Selecting by deployment** is a `DeploymentPicker` beside the range control
(`?dep=`), since the deployment record arrived. Precedence when a URL carries more
than one: run, then deployment, then custom, then preset.

**One knock-on change to the home page.** Extending `engineOnly` to every reading
that exists only in motion means a stopped set now reports `0 V` line voltage and
`0.0 Hz` alongside its `0 kW`, where before only speed, power and oil pressure
were zeroed. Without it the chart would break the line for a parked set while the
home page showed it a healthy 405 V — the two screens have to agree about what a
stopped machine reports.

## Caveats

- **Auth is fake.** `modules/auth/session.ts` writes `{email}` to localStorage.
  It exists so the login screen has somewhere to go and there's a route guard to
  demonstrate. It is not a security boundary.
- **Data is mock.** `modules/genset/data/fleet.ts` reads whichever estate the brand
  names. The carrier estate is a **Sabah and Sarawak** build-out under two
  programmes (`Jendela SBH`, `Jendela SWK`), with four peninsular sites kept as the
  grid-backed baseline the Borneo ones are read against — so the map has clusters on
  both landmasses and the region chips are not two entries long. `BRF9540` is pinned to the
  exact values in the Figma so the panel can be diffed against the design.
  Timestamps are minutes-ago offsets resolved at load, so they never go stale.
  `data/detail.ts` derives the home page from those givens; per-unit variation is
  a hash of the genset's id, not `Math.random()`, so a unit looks identical on
  every render and every reload.
- **History is invented too.** `data/detail.ts` publishes one number per reading;
  `data/history.ts` generates the run log and the series behind the analysis tab
  from the same hash, working *backwards* from those numbers so the chart's
  right-hand edge and the home page always agree. It is not a recording — but it
  is internally consistent all the way down, which is what makes the screen worth
  reviewing.
- **Sites are mostly derived.** There are no site screens now; the site data stays
  because gensets, deployments and alarms read it. `modules/site/data/siteSeed.ts` holds the things
  a diesel engine cannot tell you — a site's name, the kind of load it carries, where
  the yard is, what the customer draws, which region it sits in and which rollout
  programme it was filed under. Everything else in `sites.ts` is summed or
  ranked from the gensets standing there: membership from the sets naming it, and
  capacity and fuel from them. Change a genset's `siteId` and every one of those
  figures follows — and so does which yard's alarm queue its controller's rows land in.

  Six of those givens were **editable** from the site's Settings tab (since removed) — name, latitude,
  longitude, region, programme and supply. The edits are differences still held in
  `data/siteOverrides.ts` and laid over the dataset by `siteSeeds()`, so the map moves
  its pin, the region chips re-count and the breadcrumb follows, and Reset restores the
  dataset's own row. The programme is a **grouping and nothing else** — no figure on
  any screen derives from it, and a site is allowed to be in none.

  The **intake reading** is the one derived figure with two halves. Whether the supply is
  live is derived: a yard's mains is dead exactly when some set there is out on an
  unfinished outage run, so `startReason` in `fleet.ts` is the only given behind it and
  the incomer cannot contradict a set's activity feed. What it *reads* is the site's own
  seeded load, which is why detaching a genset does not change the customer's
  consumption. Every site carries a reading, including any declared `PRIME`, where it
  goes undrawn — which is what lets the settings page preview the standby layout
  without inventing a figure.
- **Fuel loss is seeded, like everything else.** `genset/data/fuelInstruments.ts`
  holds a litres-per-hour loss rate per unit and, for one of them, the hour it
  started. `history.ts` integrates it into the tank ladder alongside the burn, which
  is what makes the level sensor and the flow meter two curves that *can* disagree —
  before it they were one derivation drawn twice, and a leak was assertable but not
  representable. The seed's flow-meter units name ids from an earlier fleet, so today
  only `BRF9540` carries one and the rest of the fleet is level-only (see the warning
  in `fuelInstruments.ts`).
- **Three stores are browser-local.** `site/data/siteConfig.ts` (the power role, keyed by
  site), `genset/data/deployment.ts` (which yard each set stands at, keyed by
  genset) and `genset/data/fuelInstruments.ts` (the leak alarm's switch and
  threshold, keyed by genset — the store stands, with no screen writing to it since
  Settings was emptied, so every set reads its default). They are the only things in either module that are neither seeded nor
  derived — choices made while the app runs. Both hold *overrides only*, so a fresh
  browser gets the designed fleet and clearing site data restores it. Neither is a
  settings API.
- **`BRF9540`'s Figma frames disagree.** The list frame puts it at 1,763 L of
  2,450 in Petaling Jaya; the home-page and site frames say 1,623 L of 2,300 in
  Senai, Johor. `fleet.ts` keeps the list frame's values, so both detail pages
  report 1,763 L | 72% of 2,450 in Petaling Jaya — consistent with the list and the
  map, which matters more than matching frames that contradict each other.
- **Basemap is CARTO Voyager**, chosen because it needs no account or token — the
  prototype runs on a fresh clone with nothing configured. `MAP_STYLE` is declared
  in each map — `GensetsMap`, `DeploymentsMap`, `PinMap` and the unused
  `SitesMap` — and all have to move together to switch to Mapbox or a self-hosted style.
- **No tests.** Prototype scope; `bun run typecheck` and `bun run build` pass.
