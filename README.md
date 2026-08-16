# gensetIQ — prototype

A clickable prototype of gensetIQ, built from the
[RooftopIQ V2 Figma](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2463-6889)
— login, the gensets map and list ("Section 1"), the
[genset home page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2560-1834),
and the
[site page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2478-7187).

**[docs/how-it-works.md](docs/how-it-works.md) explains what the product is for
and the concepts it is built on** — genset, site, run, reading, alert, tag, control
mode, fuel reconciliation and the rest — and the rules between them. Read that before changing behaviour;
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
| Genset runs | `/gensets/<id>/runs` | The run log: a timeline strip, totals for the chosen window, the list, and a CSV export. Not a Figma frame — see [below](#the-runs-tab-is-not-in-the-design). |
| Genset settings | `/gensets/<id>/settings` | The fuel leakage alarm — what this set is instrumented with, whether the check is on, where its line sits, and the arithmetic behind the verdict. Not a Figma frame — see [below](#fuel-leakage-is-not-in-the-design). |
| Alarms / Equipment | `/gensets/<id>/alarms`, … | Named in the design's tab strip but not drawn — labelled placeholders so the strip isn't dead. |
| Sites — list | `/sites?view=list` | 17 sites, worst condition first. Not a Figma frame — see [below](#the-sites-screens-are-not-in-the-design). |
| Sites — map | `/sites?view=map` | One pin per yard, coloured by the site's condition and sized by how many sets stand there. Not a Figma frame — see [below](#the-sites-screens-are-not-in-the-design). |
| Site home | `/sites/<id>` | Matches the Figma frame: the site's single-line diagram, then one row per genset with its run and its controls. All 17 sites have one. |
| Site settings | `/sites/<id>/settings` | How the site is fed, which gensets stand on it, and which meters measure it. Not a Figma frame; see [power role](#the-power-role-is-not-in-the-design), [gensets](#attaching-and-detaching-gensets) and [metering](#metering-is-a-device-not-a-number). |
| Meters | `/meters` | The metering estate — 16 devices, where each is fitted and what it reads. Not a Figma frame — see [below](#metering-is-a-device-not-a-number). |
| Site runs | `/sites/<id>/runs` | The same log across every set standing here — one strip lane and one table column per machine. |
| Alarms / Contract | `/sites/<id>/contract`, … | Named in the design's tab strip but not drawn — same treatment. |
| Deployment / Refuel / Settings | `/deployment`, … | Named in the sidebar but not designed — same treatment. |

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
/gensets/brf9540?tag=coolant          # home page, coolant readings showing
/gensets/brf9540?severity=critical    # home page, filtered to criticals
/gensets/brf9540/analysis?keys=coolant-temp,oil-pressure&window=7d
/gensets/brf9540/analysis?from=2026-07-20&to=2026-08-05
/gensets/brf9540/analysis?run=brf9540-run-3           # one run, end to end
/gensets/brf9540/runs?window=all                     # the whole log
/gensets/brf9540/runs?from=2026-07-01&to=2026-07-31   # the range an export covers
/sites?q=senai                        # sites list, filtered
/sites?view=map&id=port-016&panel=true # one yard on the map, its preview open
/sites/telco-001                      # the site page the Figma frame draws
/sites/telco-001/runs?window=7d       # every set here, one log
```

A site page is reached from `/sites`, and each of its genset rows links back out to
that unit's own page — so the two sections meet in both directions.

## Layout

```
src/
├── components/
│   ├── global/        Sidebar, MobileNav, TopNav, NavButton, ComingSoon, NotFound
│   └── ui/            shadcn-style primitives (button, input, badge, tabs, …)
├── layouts/           AuthenticatedLayout — the 94px rail + canvas shell, or the
│                      floating bottom bar below `md`
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

## Phone width

Four screens have a mobile layout: **the fleet list, the sites list, and the two
home pages.** They are the same routes at a narrower window, not a second set of
`/m/…` ones — so a link works wherever it is opened, and the designed desktop
frames are untouched by it.

The line is Tailwind's `md` (768px), and nearly every decision either side of it is
a CSS class. Two are not, and they are in `lib/useIsCompact.ts`: the lists swap a
table for cards (rendering both and hiding one would put every row's links in the
accessibility tree twice) and the map's panel inset is a number rather than a class.

What changes below `md`:

- **the 94px rail becomes a floating bottom bar** — `components/global/MobileNav.tsx`,
  centred, with the page scrolling underneath it. Two destinations, Gensets and
  Sites, because those are the two with mobile layouts. Deployment, Meters, Refuel
  and Settings are desktop-only here, and a nav item landing on a screen laid out
  for 1,280px is worse than no item. The same rule hides the genset's and site's
  tab strips, where only `Home` is built for a phone. Every route still resolves if
  a URL is typed or followed from a desktop link — what is withheld is *navigation*
  to a screen the app cannot show properly.
- **the two lists become cards** — `GensetsCards.tsx`, `SitesCards.tsx`. Not the
  table with columns dropped: the columns that would survive 390px are the ones
  that say least, and "1,763L (72%)" and "Petaling Jaya" are why anybody scrolls.
  The whole card navigates, since there is no preview panel at this width to select
  into and a card that highlighted itself and did nothing else is a dead end.
- **the map and the preview panel are withheld**, and with them the view switcher
  and panel toggle. `?view=map` in a URL is left untouched — the same link opens
  the map on a desktop and the list on a phone.
- **the home pages stack.** Both needed no rewrite, because their reading order is
  already vertical: the genset's three bands and the site's diagram-then-rows are
  asked in sequence, so each band's row becomes a column. The alerts band turns too
  — its 113px condition rail would take a third of the screen, so the verdict reads
  across the top instead.
- **the two fixed-geometry drawings never reflow**, because their conductors land on
  the boxes at measured coordinates and a reflow leaves a wire ending in mid-air.
  They answer the narrow screen differently, and the difference is which failure is
  cheaper. `SiteDiagram` (398px) **scales itself** to whatever width it is handed:
  it measures its own box and shrinks the whole canvas as one piece, so every wire
  still lands and only the type gets smaller (0.9 at 390px). `PowerFlowDiagram` +
  `ControlPad` (484px) **scrolls sideways** in its own strip, because the control
  pad is a set of tap targets and shrinking those is a worse answer than swiping.

One pattern is worth knowing before editing these: where the desktop layout is a
wrapping row of a fixed item and a shrinkable one, **`flex-wrap` is the wrong
instruction at phone width.** Both items "fit" on one line once the shrinkable one
is allowed to shrink, and the result is a squeezed column with its contents
spilling under the fixed one. Those rows are `flex-col md:flex-row md:flex-wrap`
instead — see `GensetHome` band 1, `SiteHome`'s top band and `SiteGensetRow`.

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
   `Panel & comms`, and every alarm reaches one. `Fuel` keeps its chip with no
   alarms behind it — three healthy readings is a real answer to "how is the fuel
   system doing", and the map's own `AL Fuel Level Sd` going unmarked is a question
   for the customer rather than a hole to paper over.

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
   frame only draws a running unit; all 24 units have a page here, and a row of
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

### Attaching and detaching gensets

The design has no such control, and the app had no way to express one: `Genset.siteId`
was seeded and permanent. The Settings tab's own placeholder promised "which gensets
are installed here", so this is the other half of that page.

Six things worth knowing.

1. **Attaching moves the machine.** A site is a customer's *yard* — `fleet.ts` puts
   co-sited units within a hundred metres of each other because that is what sharing a
   site means. So a set takes on the site's placename and a spot in its yard, and its
   pin moves on the fleet map. That is forced rather than chosen: membership you could
   set without moving anything would let a Penang set belong to a Petaling Jaya site,
   and every figure that made a site *a place* would describe two places at once. The
   picker says so — *"Attaching moves the set to Kota Bharu, Kelantan."*

   **Detaching moves nothing.** The set goes to the depot but is still standing in that
   yard until somebody collects it. Inventing a depot coordinate would be a claim about
   the physical world this app has not earned.

2. **A site's position and load are now seeded, not derived.** Both used to come from
   the members — placename from the first genset, coordinates from their mean — and
   both had to stop. A yard must know where it is *before* a set arrives or deploying
   one has nowhere to send it; removal makes empty sites reachable, and those used to
   compute to 0°, 0° and "Unknown"; and once deploying relocates a machine, deriving
   the site's position from it is a loop with no fixed point. Every seeded value is
   exactly what the old derivation produced, so nothing moved.

3. **`Genset.siteId` is nullable now,** and "a unit is always at exactly one site" —
   previously documented as a virtue — is the half of that invariant deliberately given
   up. It was true only because nothing could move a machine. Gensets genuinely exist
   before deployment and while away being serviced, and the alternative was forcing
   every removal to be a transfer to somewhere the set is not. The load-bearing half
   survives: membership is still held on the genset, so a set is at one site or none,
   never two.

4. **The site load is a site fact.** It was scaled off installed genset capacity — a
   convenience that quietly made the customer's consumption a function of the machinery
   parked outside. Detaching made that plainly wrong: strip a yard and it would appear
   to stop using electricity. It also let one load carry two numbers, with `mfg-015`
   metering 152 kW beside its own genset reporting 175 kW. Now `removing a genset does
   not change what the customer draws`, which is the only defensible behaviour, and the
   two figures agree. The intended direction is a metering *device* on the site
   reporting a consumption pattern; this seed becomes its reading.

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

Left out deliberately: the **Deployment** route, whose placeholder already reads
"moving gensets between sites" and which is the proper fleet-wide home for a depot
view. Detached sets stay reachable from any site's attach picker in the meantime.
Creating and deleting *sites* is also absent — a different feature with its own
questions.

### Metering is a device, not a number

The design has no meters, and the app used to quote a grid figure at **every** site —
instrumentation most of them have never had. A power meter is now a device with a
serial, a model, and a fitting: a site *and* the circuit it is wired to, carried as one
object so a half-fitted meter cannot be written down.

Five things worth knowing.

1. **Two circuits, and they measure different things.** `MAINS` is what the site
   imports from the grid, and it goes to nothing the moment a genset picks up the load.
   `LOAD` is what the customer consumes, and it never does. A site metered on the mains
   alone is blind during exactly the events this product watches. That is a real trade
   customers make, so the app models the point rather than flattening both into "the
   meter".

2. **No meter, no figure — and the page says which kind of nothing.** `unmetered` is
   nobody having fitted a device; `no reading` is one fitted and gone quiet. Different
   problems, different people to call, so `MeterFeed` carries the reason rather than
   being a bare `number | null`. Eight of seventeen sites have no metering at all, so
   the unmetered case is the one a reader meets first. `retail-014` shows `unmetered` on
   both nodes and `telco-017` shows `no reading` under an `unmetered` mains — those two
   are placed deliberately, because they are the only sites where the grid is actually
   carrying and therefore the only ones where a missing meter is visible on a diagram.

3. **Presence and consumption are separate instruments.** Whether the grid is *live* is
   still known everywhere, because it comes from the transfer switch's voltage sensing —
   that is how it decides to transfer. Only the kW needs a meter. Conflating them would
   have made every unmetered site read as a site with no grid, and an early version of
   `siteFeed` did exactly that.

4. **Fitting a meter does not change what a site draws.** `siteSeed.ts` holds the
   physical load; the meter only decides whether the app can state it. Which is also why
   the load figure has a fallback chain — load meter, then whatever is carrying (a
   genset's controller, or the mains meter while the grid carries), then nothing. The
   load meter comes first because it is the only source that survives a changeover:
   transfer between two sets whose controllers report different outputs and the *load*
   has not moved.

5. **`0 kW` is allowed here, and `—` is not the same thing.** A fitted mains meter
   reading zero import while a genset carries is a working device reporting a true
   measurement. A meter in stores reads `—`, because a box on a shelf has measured
   nothing. That is the distinction the whole module turns on.

The **Meters** sidebar tab lists the estate with a coverage count rather than an
inventory count — `13 of 15 fitted`, and how many are silent. There is no meter detail
page; a row links to its site's Settings tab, which is where the fitting is changed.

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
   that a `GensetAlert` is a bit in the Modbus register map and that invented alarms
   are not allowed, "however plausible they read". No panel raises this one, because
   no panel sees both instruments at once. So it follows the `ServiceNotice` pattern
   the service change established: its own type, its own card, printing
   `Fuel reconciliation` where an alarm prints its register and bit.

2. **The switch is on the Settings tab and it defaults on.** The tab's placeholder
   already promised "alert thresholds, tags, who gets notified", and this is the only
   threshold the *app* owns — every other limit on the machine is a commissioning
   value in the panel, which a screen has no business letting you retype. On a set
   that cannot reconcile the switch is inoperable and names the instrument it wants,
   rather than simply being absent: somebody who goes looking for the feature should
   find out why this machine does not have it, not conclude the feature does not
   exist. It defaults on wherever both instruments are fitted, because the
   alternative fails silently — a customer who paid for flow meters and never found a
   switch gets nothing back for them, and no screen says so.

3. **The threshold is a percentage of tank capacity, floored at the probe's own
   accuracy.** Percent because it is the only form that carries across a fleet of
   600 L and 3,000 L tanks; floored because a line finer than the instrument can
   resolve is an alarm that is always on, and an alarm that is always on is one that
   gets closed. The litres it implies are shown beside it, since that is what
   somebody deciding whether to send a van actually reasons in.

4. **A leak moves the condition verdict.** Unlike the overdue-service notice, which
   does not. A chore nobody has done is not the same as a machine spilling its
   consumable, and `Optimum` over a set losing eighty litres a night would cost the
   reader their trust in every other verdict. That ripples into the fleet sort, the
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

### The sites screens are not in the design

The Figma names `Sites` in the sidebar, draws one site's page, and gives that page
a `Sites › Telco-001` breadcrumb — so a list is the thing that breadcrumb points
back at, and the designed page cannot be reached without it. It is built in the
fleet table's own language (sticky 40px header, 52px rows, hairline rules) rather
than as a new pattern.

Its columns are the site-level facts, in the order they get asked: where it is, is
anything wrong, what is standing there, does it need a tanker. Site draw is
deliberately absent — it changes while you read the list, which makes it a
detail-page figure.

**The map is the same list on the ground.** It was argued against for a while, on
the grounds that a site's position is its gensets' position and `/gensets?view=map`
already draws that. True of the coordinates, wrong about the question. The fleet
map answers *where are my machines*, so a yard with three sets is three pins and a
customer site reads as a cluster of hardware; this one answers *where are my
customers, and which of them is in trouble* — one pin per site, coloured by the
site's own condition and sized by how much plant is standing there. Neither screen
is derivable by eye from the other.

Both views carry the fleet screen's preview panel, and for its reason: a pin has
nowhere to put a link, so a clicked site has to open something that carries the way
in. The panel is a preview rather than a copy of the site page — what is feeding
the yard, its condition, capacity and fuel, and the sets standing there worst
first, each a link to its own page. Site draw stays off it for the same reason it
is off the list.

Adding the map gave a site row a second thing it could do, so the list adopted the
fleet table's split: **the row selects into the panel, the name navigates.** It was
one link when selecting meant nothing.

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
- **Sites are mostly derived.** `modules/site/data/siteSeed.ts` holds the four things
  a diesel engine cannot tell you — a site's name, the kind of load it carries, where
  the yard is and what the customer draws. Everything else in `sites.ts` is summed or
  ranked from the gensets standing there: membership from the sets naming it, capacity,
  fuel and condition from them. Change a genset's `siteId` and every one of those
  figures follows.

  The **intake meter** is the one derived figure with two halves. Whether the supply is
  live is derived: a yard's mains is dead exactly when some set there is out on an
  unfinished outage run, so `startReason` in `fleet.ts` is the only given behind it and
  the meter cannot contradict a set's activity feed. What it *reads* is the site's own
  seeded load, which is why detaching a genset does not change the customer's
  consumption. All 17 sites carry a reading, including any declared `PRIME`, where it
  goes undrawn — which is what lets the settings page preview the standby layout
  without inventing a figure.
- **Fuel loss is seeded, like everything else.** `genset/data/fuelInstruments.ts`
  holds a litres-per-hour loss rate per unit and, for one of them, the hour it
  started. `history.ts` integrates it into the tank ladder alongside the burn, which
  is what makes the level sensor and the flow meter two curves that *can* disagree —
  before it they were one derivation drawn twice, and a leak was assertable but not
  representable. Ten of the twenty-four units carry a flow meter, which is what puts
  most of the fleet in the honest `unavailable` state.
- **Three stores are browser-local.** `site/data/siteConfig.ts` (the power role, keyed by
  site), `genset/data/deployment.ts` (which yard each set stands at, keyed by
  genset) and `genset/data/fuelInstruments.ts` (the leak alarm's switch and
  threshold, keyed by genset). They are the only things in either module that are neither seeded nor
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
  in each map (`genset/components/GensetsMap.tsx`, `site/components/SitesMap.tsx`)
  and both have to move together to switch to Mapbox or a self-hosted style.
- **No tests.** Prototype scope; `bun run typecheck` and `bun run build` pass.
