# gensetIQ — prototype

A clickable prototype of gensetIQ, built from the
[RooftopIQ V2 Figma](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2463-6889)
— login, the gensets map and list ("Section 1"), the
[genset home page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2560-1834),
and the
[site page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2478-7187).

**[docs/how-it-works.md](docs/how-it-works.md) explains what the product is for
and the seven concepts it is built on** — genset, site, run, reading, alert, tag,
control mode — and the rules between them. Read that before changing behaviour;
this file covers what is built and what is faked.

There is no backend. The fleet is mock data and "logging in" writes a flag to
localStorage — see [Caveats](#caveats).

```bash
git clone git@github.com:tristanlim0303/gensetiq-prototype-1.git
cd gensetiq-prototype-1
bun install
bun run dev     # http://localhost:3100
```

Needs [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`); the
lockfile is `bun.lock`, so npm/pnpm will resolve different versions.

Port 3100, not 3000: `rooftopiq-frontend-v3` pins 3000 with `strictPort`, so the
two run side by side.

Any email and password gets you in.

## What's built

| Screen | Route | Notes |
| --- | --- | --- |
| Login | `/login` | Wordmark, email + password, teal CTA. Matches the Figma frame. |
| Gensets — list | `/gensets?view=list` | 24 units, sortable by attention (faults first). |
| Gensets — map | `/gensets?view=map` | Real MapLibre map with live clustering. |
| Genset home | `/gensets/<id>` | The genset's own page: run + fuel, controls + live gauges, alerts. All 24 units have one. |
| Genset analysis | `/gensets/<id>/analysis` | Two readings over one window on a dual-axis chart, with a hover crosshair. Built from the [Figma annotations](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2799-3338) — see [below](#the-analysis-tab). |
| Runs / Alarms / Equipment / Settings | `/gensets/<id>/runs`, … | Named in the design's tab strip but not drawn — labelled placeholders so the strip isn't dead. |
| Sites — list | `/sites` | 17 sites, worst condition first. Not a Figma frame — see [below](#the-sites-list-is-not-in-the-design). |
| Site home | `/sites/<id>` | Matches the Figma frame: the site's single-line diagram, then one row per genset with its run and its controls. All 17 sites have one. |
| Site settings | `/sites/<id>/settings` | Whether the site is fed by mains with the gensets as backup, or by the gensets alone. Not a Figma frame — see [below](#the-power-role-is-not-in-the-design). |
| Runs / Alarms / Contract | `/sites/<id>/contract`, … | Named in the design's tab strip but not drawn — same treatment. |
| Deployment / Refuel / Settings | `/deployment`, … | Named in the sidebar but not designed — same treatment. |

Getting from the fleet into a genset: click its **name** in the list, or the `→`
in the preview panel's header. Clicking a row or a map pin still only *selects*
it into the panel — over the map that arrow is the only way in, since a pin has
nowhere to put a link.

View state lives in the URL, so any state is linkable and the back button steps
through it:

```
/gensets?view=map&q=selangor&id=brf9540&panel=true
/gensets/brf9540?tag=coolant          # home page, coolant readings showing
/gensets/brf9540?severity=critical    # home page, filtered to criticals
/gensets/brf9540/analysis?keys=coolant-temp,oil-pressure&window=7d
/gensets/brf9540/analysis?from=2026-07-20&to=2026-08-05
/gensets/brf9540/analysis?run=brf9540-run-3           # one run, end to end
/sites?q=senai                        # sites list, filtered
/sites/telco-001                      # the site page the Figma frame draws
```

A site page is reached from `/sites`, and each of its genset rows links back out to
that unit's own page — so the two sections meet in both directions.

## Layout

```
src/
├── components/
│   ├── global/        Sidebar, TopNav, NavButton, ComingSoon, NotFound
│   └── ui/            shadcn-style primitives (button, input, badge, tabs, …)
├── layouts/           AuthenticatedLayout — the 94px rail + canvas shell
├── modules/
│   ├── auth/          localStorage stand-in for a session
│   ├── genset/        types, mock data, fleet screens, and detail/ for the
│   │                  home page and detail/analysis/ for the chart
│   └── site/          the sites list, the site page, and the single-line diagram
├── routes/            file-based TanStack Router tree
└── styles/            colors.ts (token source of truth) + styles.css
```

`routes/_authenticated/gensets_.$gensetId.tsx` — the trailing underscore on
`gensets_` un-nests the detail route from `/gensets`. Without it TanStack treats
the fleet screen as its parent and renders the detail page inside it, and
`GensetsPage` has no `<Outlet />`, so nothing appears at all. `sites_.$siteId.tsx`
does the same thing for the same reason.

## Relationship to rooftopiq-frontend-v3

Separate app, deliberately: gensetIQ has its own login, its own mark, and a
completely different sidebar (Gensets / Deployment / Sites / Refuel). Nothing in
`rooftopiq-frontend-v3` was touched.

It shares that app's **design system**, though. `src/styles/colors.ts` is lifted
from it, and every value that exists in both is byte-identical — each one was
checked against the Figma variables on these frames (`bg-canvas #070e1d`,
`bg-element #151c28`, `bg-sidebar #040710`, `bg-overlay #121826`,
`bd-subtle #ffffff1a`). Two deliberate differences:

- **`brand` is teal `#21B0B0`**, not Rooftop Energy's gold — it's the accent in
  the IQ mark and the login CTA. `teal #14B8A6` is a second, greener teal the
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
   `BRF9540 | Cummins 1000 kVa` from truncating in every row. Over the *map* the
   panel still floats, as designed.
2. **Map pins are coloured by run state.** The mock-up shows mostly dark pins and
   one blue — and blue is exactly the `RUNNING` colour from the badge — so this
   reads as extending what the design already started rather than inventing it.
   The selected pin gets a teal ring.
3. **The "Activity" section is filled in.** The design shows the heading over
   empty space. Each unit has an event feed, built backwards from its current
   state so the story stays consistent (a faulted unit's newest event is the
   fault, not a start).

### The genset home page

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
   both be true. The chip counts themselves match the design exactly — 2 critical,
   5 warning, 3 neutral.

3. **Alert readings violate their thresholds.** The frame shows "Starter battery
   voltage — 1 V" under an undervoltage warning; 1 V is not a reading a 24 V system
   can produce. Every active alert forces its reading to a value that actually
   trips it (21.8 V here), because the number under an alert is what makes the
   alert checkable.

4. **The repeated placeholders are named.** The frame repeats "Oil pressure" for
   two of four gauges, "Load" for both bar groups, and "Generator condition" for
   eight of eleven tag chips. Here the gauges are engine speed, active power, oil
   pressure and coolant temperature; the bar groups are line voltage and phase
   current; and the tags are nine distinct subsystems.

5. **The dials are SVG, not the exported bitmap.** Figma ships the gauge as two
   PNGs — a tick ring in `text-subtle` and the same ring in teal, clipped by a box
   whose width *is* the value. Reproducing that literally would mean one bitmap per
   value, so `TickGauge.tsx` redraws it: same 76-ticks-per-circle pitch (39 over the
   visible 180°) and the same 36.5 → 47.5 radial band in a 97px square.

6. **Band 2 empties when the engine stops**, replaced by one line of text. The
   frame only draws a running unit; all 24 units have a page here, and a row of
   dials pinned at zero reads as a broken page rather than a stopped engine.

7. **START and STOP are inert, and say so.** Mode switching works. The two
   commands are refused outside `MANUAL` and outside the state they'd change, and
   their tooltips state plainly that no controller is wired up — a button that
   appears to crank a diesel engine and silently does nothing is worse than one
   that admits it.

   Refused tiles carry `aria-disabled`, not `disabled`. A genuinely disabled control
   receives no pointer events in Chrome or Safari and cannot take focus, so its
   tooltip never opens — which meant the pad greyed out its commands and then
   explained nothing, the exact opposite of the intent above. The changeover on the
   site page refuses options the same way, for the same reason.

### The site page

The frame is `node-id=2478-7187`, confusingly named "Sites list" — it is a site's
*own* page. Its layout, both bands and every component's construction follow it.
Five departures, in order of how much they matter.

1. **The fleet gained sites, and eight units moved.** The design implies sites
   exist and the app had no such concept, so `Genset.siteId` was added and
   `fleet.ts` now groups its 24 units into **17 sites, nine of them holding two**.
   Nine gensets share a yard with another, and a shared yard means a shared
   placename: `KLN3355` moved from Klang to Petaling Jaya, `KJG9048` from Kajang to
   Cyberjaya, `PCH4180` from Puchong to Shah Alam, `AMP8890` from Ampang to Cheras,
   `TPG1188` from Taiping to Ipoh, `BKM4409` from Bukit Mertajam to George Town,
   and `JHB5503` + `PSG8817` from Johor Bahru and Pasir Gudang to Senai.

   Every move stays inside its own region, so the map's twelve-in-the-Klang-Valley
   cluster still reads `12`, and `BRF9540` keeps the exact values the Figma pins it
   to. Co-sited units sit ~100 m apart rather than on identical coordinates, which
   is both true of a real yard and what keeps two pins from stacking on the map.

2. **`Telco-001` is in Petaling Jaya, not Senai.** The frame's header says
   `Telco-001 · Senai, Johor` and its two genset cards both read
   `BRF9540 | Cummins 1000 kVa` — and `BRF9540` is in Petaling Jaya on the list
   frame, which is the reading this prototype already committed to (see
   [Caveats](#caveats)). The cards were the more useful half to honour, so
   `telco-001` pairs `BRF9540` with the fleet's other `Cummins 1000 kVa` — two
   identical machines, as drawn, one running and one faulted, which also makes the
   page demonstrate both isolator states. The design's `Senai, Johor` is not lost;
   it is `data-013`.

3. **There is a changeover control, and the diagram is live.** The frame draws the
   *outcome* of a changeover — one isolator closed, one open — and no control that
   causes it. A `Load on` selector is the third column of the top band on multi-set
   sites, and transferring the load moves it in the drawing, in the site's draw
   figure and in each genset row's badge together.

   It is **modelled, not commanded**, the same line `START` and `STOP` hold: it does
   not start an engine. Only a set that is already turning can be handed the load,
   and each refused option says which refusal it is — stopped (start it first),
   faulted (isolated by its controller), or unreachable. On `telco-001` every option
   but the current one is refused, which is the honest answer for a running set
   beside a faulted one.

   Per the refined frame, only the duty set carries a run-state glyph, on a chip that
   takes the track's full 48px height; the rest are shorter, dimmed text. That costs
   something worth naming: a faulted option and a merely stopped one now look
   identical, where a red triangle used to separate them at a glance. The reason
   moves entirely into the tooltip — which is where the *specific* reason always
   lived, and is now the only place it lives.

   The consequence worth knowing: because one changeover means one connected set, a
   **site's draw is the duty set's output, not the sum of its running sets'** — and a
   running set whose load has been transferred away reads `off-load` rather than
   quoting the kW its own controller is still metering.

4. **Every node is captioned, in two lines.** The frame draws identical `GENSET`
   boxes with nothing to tell them apart — fine for a mock-up, useless the moment
   the page has to say *which* set is isolated. So each node names its asset and
   states what it is putting into the bus, and the `LOAD` node carries the site's
   draw at the point the power actually arrives. Only a connected, turning set gets
   a kW figure; the rest get a word, because `0 kW` is a measurement and the page
   has not measured anything at a machine it cannot reach. Additive only: the boxes
   keep their designed 88 × 74 and the captions sit in the 64px gap between them.

5. **The top band's empty left half became the site's figures.** The frame gave the
   band a 1300px width with a 399px diagram and nothing else in it. The first column
   now holds what is feeding the load, installed capacity and fuel on site:
   site-level facts, none of which any genset row below can state. It is figures
   only — there is no site-level status roll-up, by design.

6. **Nothing in the band or the rows is boxed.** The refined frame drops the strokes
   from the diagram card and from both genset rows, and separates the band from the
   rows with a single 1px `bd-subtle` rule — the same device the genset home page
   uses between its three bands. The rows' own contents keep their edges (the run
   card, the four control tiles), so removing the outer stroke takes away a frame
   around a frame rather than the only thing holding the row together.

7. **Flow along a live conductor is animated.** The design's teal wires are static.
   Motion is the only cue here that colour doesn't duplicate, and it is switched off
   under `prefers-reduced-motion`. The switch geometry is redrawn rather than
   exported for the same reason the gauges are: Figma ships four variants of it, and
   a bitmap per state per genset count is not a component.

### The power role is not in the design

The Figma draws a site as gensets, isolators, a bus and a load — and **no mains
supply**, at any site. That is a gap rather than a statement: the product is standby
power, so a page about backing something up that never draws the thing being backed
up is missing its subject, and every site is left looking as though nothing else feeds
it.

So a site declares how it is fed, on its Settings tab, and the diagram follows:

- **Backup to mains** (the default, and what the whole app assumed before this) — a
  `MAINS` source above the gensets, on its own transfer contactor, onto the same bus.
- **Main power source** — no incomer. The diagram is exactly what the frame draws.

Five things worth knowing, in order of how much they matter.

1. **It is a display choice, and only a display choice.** It selects a layout. The
   isolator rules, the changeover, the default duty set and every control pad are
   untouched by it, which is why there is no state to reset when it changes. A control
   that redrew a diagram *and* quietly changed which sets could take load would be two
   operations wearing one label, and the second would be a command this prototype has
   no business issuing.

   The honest cost of holding that line: a set's activity feed is the **machine's**
   history, so at a site declared `PRIME` it may still read "Engine started on utility
   outage". The role redraws the yard; it does not rewrite what the controllers did.

2. **Mains health is metered, not inferred.** The first version of this derived it from
   the gensets — "a set is running, so the grid must be down" — and that is wrong for
   the case that matters most: a set on a **test exercise** runs beside a perfectly
   healthy grid, and inferring a failure from it reports an outage at a site that never
   had one. So a genset carrying the load and a failed grid are two facts, and the
   diagram states both: `off-load` under a healthy mains that isn't carrying, `failed`
   under a dead one. `SPG2093` and `SRB6644` are pinned to `TEST` so the fleet actually
   contains the case — see `mfg-015`.

   That is also why `Genset.startReason` was added. The meter reading is *derived* from
   it rather than seeded beside it, because two independent givens could disagree, and
   the disagreement would land on exactly this case.

3. **`0 kW` is still never printed.** The mains gets the same treatment the gensets
   already had — a word, not a measurement, when it isn't carrying — and the `LOAD`
   node now reads `not served` only when *nothing* is feeding. On a standby site with
   the grid up, the site's draw is the meter's figure. Reading "0 of 2 feeding" over a
   site running perfectly well on the grid was alarm-shaped where no alarm existed, so
   the badge reads `On mains` / `On generator` there, and keeps `1 of 2 feeding` at a
   prime site, where counting the sets is the useful fact.

4. **Conductors are painted dead-first.** Every source elbows onto the bus riser and
   runs along it to the tap, so with three or more sources those segments overlap — and
   in document order a dead genset could paint a grey stub over the live mains riser
   above it, leaving a conductor that appears to go dead halfway to the load. Ordering
   by state rather than position makes that unrepresentable. Today's mock data cannot
   reach it; one seed change can.

5. **The setting lives in `localStorage`,** overrides only, keyed by site id. So a fresh
   browser renders the designed screens, clearing site data restores them, and a
   colleague opening the same site sees the default. It does not sync, and the page says
   so rather than implying a server.

### The sites list is not in the design

The Figma names `Sites` in the sidebar, draws one site's page, and gives that page
a `Sites › Telco-001` breadcrumb — so a list is the thing that breadcrumb points
back at, and the designed page cannot be reached without it. It is built in the
fleet table's own language (sticky 40px header, 52px rows, hairline rules) rather
than as a new pattern.

Its columns are the site-level facts, in the order they get asked: where it is, is
anything wrong, what is standing there, does it need a tanker. Site draw is
deliberately absent — it changes while you read the list, which makes it a
detail-page figure.

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

**The one thing the notes ask for that is not built.** There is no *deployment*
selector: a deployment is a period a genset was installed somewhere, and the model
has no such concept — `Genset` carries one `siteId` with no history, so there is
nothing to select, and a picker over a relationship the data cannot express would
filter nothing while looking authoritative.

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
- **Data is mock.** `modules/genset/data/fleet.ts` — 24 units, 12 of them in the
  Klang Valley so the map's cluster bubble is real. `BRF9540` is pinned to the
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
- **Sites are derived, not mocked.** `modules/site/data/sites.ts` seeds only a
  site's identity — its name and the kind of load it carries. Its membership comes
  from the gensets naming it, its placename and position from those gensets, and
  its draw, capacity, fuel and condition are summed or ranked from them. Change a
  genset's `siteId` in `fleet.ts` and every site figure follows.

  The **intake meter** follows the same rule: a yard's mains is dead exactly when some
  set there is out on an unfinished outage run, so `startReason` in `fleet.ts` is the
  only given behind it and the meter cannot contradict a set's activity feed. The
  magnitude is a hash of the site id against installed capacity. All 17 sites carry a
  reading, including any declared `PRIME`, where it simply goes undrawn — which is what
  lets the settings page preview the standby layout without inventing a figure.
- **The power role is browser-local.** `modules/site/data/siteConfig.ts` is the one
  thing in the site module that is neither seeded nor derived, so it cannot live in
  `sites.ts` — that file is built once at module load. It is `localStorage`, overrides
  only, and it is not a settings API.
- **`BRF9540`'s Figma frames disagree.** The list frame puts it at 1,763 L of
  2,450 in Petaling Jaya; the home-page and site frames say 1,623 L of 2,300 in
  Senai, Johor. `fleet.ts` keeps the list frame's values, so both detail pages
  report 1,763 L | 72% of 2,450 in Petaling Jaya — consistent with the list and the
  map, which matters more than matching frames that contradict each other.
- **Basemap is CARTO Voyager**, chosen because it needs no account or token — the
  prototype runs on a fresh clone with nothing configured. Swap `MAP_STYLE` in
  `components/GensetsMap.tsx` to move to Mapbox or a self-hosted style.
- **No tests.** Prototype scope; `bun run typecheck` and `bun run build` pass.
