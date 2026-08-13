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
bun install
bun run dev     # http://localhost:3100
```

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
| Analysis / Runs / Alarms / Equipment / Settings | `/gensets/<id>/runs`, … | Named in the design's tab strip but not drawn — labelled placeholders so the strip isn't dead. |
| Sites — list | `/sites` | 17 sites, worst coverage first. Not a Figma frame — see [below](#the-sites-list-is-not-in-the-design). |
| Site home | `/sites/<id>` | Matches the Figma frame: the site's single-line diagram, then one row per genset with its run and its controls. All 17 sites have one. |
| Runs / Alarms / Contract / Settings | `/sites/<id>/contract`, … | Named in the design's tab strip but not drawn — same treatment. |
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
│   ├── genset/        types, mock data, fleet screens, and detail/ for the home page
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
   commands are disabled outside `MANUAL` and outside the state they'd change, and
   their tooltips state plainly that no controller is wired up — a button that
   appears to crank a diesel engine and silently does nothing is worse than one
   that admits it.

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

3. **The genset nodes are captioned and the load states its draw.** The frame
   draws two identical `GENSET` boxes with nothing to tell them apart, which is
   fine for a mock-up and useless the moment the page has to say *which* set is
   isolated. Each node is captioned with its asset tag and the load with the site's
   draw. Additive only: the boxes keep their designed 88 × 74 and the captions sit
   in the gap beneath them.

4. **The diagram card's empty left half became the site's verdict.** The frame's
   card is 1300px wide with a 423px diagram and nothing else in it, while the one
   question a site page exists to answer — *is this load covered* — is not on the
   page at all. That column now holds coverage, site draw against installed
   capacity, and fuel on site: three site-level facts, none of which any genset row
   below can state.

5. **Flow along a live conductor is animated.** The design's teal wires are static.
   Motion is the only cue here that colour doesn't duplicate, and it is switched off
   under `prefers-reduced-motion`. The switch geometry is redrawn rather than
   exported for the same reason the gauges are: Figma ships four variants of it, and
   a bitmap per state per genset count is not a component.

### The sites list is not in the design

The Figma names `Sites` in the sidebar, draws one site's page, and gives that page
a `Sites › Telco-001` breadcrumb — so a list is the thing that breadcrumb points
back at, and the designed page cannot be reached without it. It is built in the
fleet table's own language (sticky 40px header, 52px rows, hairline rules) rather
than as a new pattern.

Its columns are the site-level facts, in the order they get asked: where it is, is
it covered, is anything wrong, what is standing there, does it need a tanker. Site
draw is deliberately absent — it changes while you read the list, which makes it a
detail-page figure.

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
- **Sites are derived, not mocked.** `modules/site/data/sites.ts` seeds only a
  site's identity — its name and the kind of load it carries. Its membership comes
  from the gensets naming it, its placename and position from those gensets, and
  its draw, capacity, fuel and condition are summed or ranked from them. Change a
  genset's `siteId` in `fleet.ts` and every site figure follows.
- **`BRF9540`'s Figma frames disagree.** The list frame puts it at 1,763 L of
  2,450 in Petaling Jaya; the home-page and site frames say 1,623 L of 2,300 in
  Senai, Johor. `fleet.ts` keeps the list frame's values, so both detail pages
  report 1,763 L | 72% of 2,450 in Petaling Jaya — consistent with the list and the
  map, which matters more than matching frames that contradict each other.
- **Basemap is CARTO Voyager**, chosen because it needs no account or token — the
  prototype runs on a fresh clone with nothing configured. Swap `MAP_STYLE` in
  `components/GensetsMap.tsx` to move to Mapbox or a self-hosted style.
- **No tests.** Prototype scope; `bun run typecheck` and `bun run build` pass.
