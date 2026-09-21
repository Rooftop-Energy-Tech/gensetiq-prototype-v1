# telcoIQ — prototype

A clickable prototype of **telcoIQ**, the telco-power product line, built from the
[RooftopIQ V2 Figma](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2463-6889)
— login, the gensets map and list ("Section 1"), the
[genset home page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2560-1834),
and the
[site page](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2478-7187).

## Brands: one build, five customers

The brand is **configuration, not a branch**. `VITE_BRAND` picks it, and each one
runs on its own port so you can have them open side by side:

```bash
bun run dev             # REDTONE      :3400  (the default)
bun run dev:sesb        # SESB         :3401
bun run dev:unbranded   # gensetIQ     :3402
bun run dev:celcomdigi  # CelcomDigi   :3403
bun run dev:telcoiq     # telcoIQ      :3404
```

| Brand | Estate | Rail | Tab |
| --- | --- | --- | --- |
| `redtone` | carrier — 25 towers, 29 sets | REDTONE near-black `#070707` | REDTONE Site Power |
| `celcomdigi` | carrier — 25 towers, 29 sets | CelcomDigi navy `#001871` | CelcomDigi Site Power |
| `sesb` | utility — 25 substations, 37 sets | SESB blue `#0F4586` | SESB Genset Monitoring |
| `gensetiq` | carrier | design-system near-black | gensetIQ |
| `telcoiq` | carrier | IQ near-black `#040710`, blue `#0369FF` | telcoIQ |

Everything a brand may change is in **`src/brands/`**, and
[`src/brands/types.ts`](src/brands/types.ts) is the file to read first — it states
the line between *whose app this is* (name, marks, four colours, which estate) and
*what the product is* (everything else). Adding a customer is a file in
`src/brands/catalog/`, an entry in `manifest.ts`, and no branch.

Settings carries a **brand picker** wherever more than one brand is in the build,
so comparing them is a click rather than a dev-server restart. Switching reloads
the page: a brand names a dataset, and the estate is built once at startup.

### A build only contains the brands it may show

The registry is **generated per build** by the `brands` plugin in `vite.config.ts`,
which emits static imports for those brands alone:

| Build | Carries | Picker |
| --- | --- | --- |
| dev | all five | yes |
| production, `gensetiq` | all five | yes |
| production, a customer's brand | that brand only | no |

This is the difference between hiding a control and not shipping the data. A
customer's deployment has no other customer's name, mark, logo asset or
twenty-five site names anywhere in it — not behind a flag, absent. The Settings
picker keys off `INCLUDED_BRAND_IDS.length > 1`, so what is shown and what is
shipped cannot drift apart.

Verify it on any build:

```bash
npm run build && grep -rl "Sabah Electricity" dist/assets/*.js   # expect no matches
```

### How this used to work, and why it doesn't now

`feat/fleet-cards-split-map`, `feat/sesb-demo` and `feat/celcomdigi-demo` are one
straight line of history, and two of those forks happened for no reason but a
different customer's colours and a different customer's sites. The costs compounded:

- every feature built after a fork existed only on that fork, so the **unbranded
  product was the one configuration nobody could show** — it had to be
  reconstructed for this refactor;
- `main` went stale, so each new branch started from someone's demo rather than
  from the product, and the branch names stopped describing their contents;
- the SESB estate was **stranded three months behind**: no hybrid plant, no solar
  generation series, no energy screen.

A branch is for work in progress. A brand is a thing that permanently exists and
has to keep working after the next feature lands — which makes it config.

### The SESB brand is not the SESB branch restored

Worth knowing before you show it. `feat/sesb-demo` had a two-entry power vocabulary
(`STANDBY` / `PRIME`) and a `/deployment` screen for hire sets on the move. The
current product replaced the first with four configurations and removed the second.

So the `sesb` brand is **SESB's places and machines under today's product**, not a
rebuild of their old demo. The mapping is in
[`src/brands/datasets/utility.ts`](src/brands/datasets/utility.ts): `STANDBY`
became `GRID_BACKUP` unchanged, and the five rural mini-grids — all `PRIME`, all
running trucked diesel — were given three solar hybrids, one diesel hybrid, and one
left on diesel prime so a conversion still has something to be compared against.
**Those five roles are a plausible estate, not a recorded one.** Don't quote them
back to SESB as their plan.

### The estate the default brand carries

CelcomDigi is a **permanent estate**. Twenty-five base stations across Malaysia,
each with a genset bolted to a plinth beside the tower it feeds, commissioned
years ago and going nowhere. That differs from the mobile-fleet build the app
started as, and the difference works through the whole app:

| | Mobile fleet (as built) | CelcomDigi (now) |
| --- | --- | --- |
| Rail leads with | Gensets, then Deployment | **Sites**, and it both counts and lists the estate |
| A genset's postings | a chain, four sites in sixty days | **one installation**, still open |
| `/deployment` screen | the dispatch feed, four views | **gone**, see `Sidebar.tsx` |
| The estate summary's second question | the dispatch position | **energy** — solar's share of what carried the load |
| Site load | 40–740 kW substations | **3–205 kW**, mostly 4–6 kW towers |
| Genset plant | 250–1,250 kVA | **15–60 kVA**, two 500/1,000 kVA at the switching centres |
| Site configurations | standby, prime | **grid-backed, diesel prime, diesel hybrid, solar hybrid** |

### The four configurations

`SitePowerRole` in `site/types/site.type.ts` holds all four, and everything
downstream reads the three predicates beside it rather than comparing to a
string. The single-line diagram treats an array and a battery as **rows on the
bus like any other source**, so a solar hybrid with two sets is the same drawing
as a diesel-prime site with one, taller.

### The hybrid model

**`site/data/hybrid.ts`** is physics. Load → daily energy → array size →
generation → what the genset still owes → litres. Every link derives from the one
before it, and the fuel arithmetic reuses `sfcLitresPerKwh`, the same curve the
run log and the tank ladder cost their fuel with.

The report's **Overall** tab is that model as a table: what carried the load at
each off-grid site, how long its engine ran, and what it burned.

> **Removed, and coming back later.** There was a second module,
> `site/data/economics.ts`, that priced all of this — delivered diesel by region,
> capex, saving a year, payback, ROI, and a quotation for every site still on
> diesel — along with the counterfactual underneath it: the litres each site
> *would* have burned running on diesel alone. All of it has been taken out. What
> is left measures what happened and makes no claim about what it was worth.

Solar is reported as **what it generated**, and nothing else. `SolarYieldChart`
draws one series of bars — a bucket, and what the array made in it. Nothing is
drawn behind them and no figure on any solar screen states a comparison: this app
measures and does not judge.

> **Taken out, deliberately.** Every design-comparison feature the solar section
> used to carry — a second series on the charts, a cumulative shortfall view, a
> per-card deviation chart, a health rule, a register column and the energy
> model's own target fields. If something like it is wanted later it arrives as
> its own thing, on top of a measurement that stands up without it. Nothing left
> in the code or in this document assumes it.

The same generation is readable at three levels and all three read `hybrid.ts`,
so they cannot disagree: **one array** on its site's own page, where somebody sent
to look at a site finds it without knowing the rest exists; **the same array** on
its own page at `/solar/<id>`; and **its history** on that page's analysis tab.
One rule survives from the version that did compare: the **running bucket is
excluded** from every total and drawn hatched, since a month eleven days old has
made eleven days of energy and stands beside eleven whole ones.

### Two charts, two questions

`SolarTodayChart` is the intraday power curve: what the arrays are putting out
right now, against the array's **own recent normal**. That baseline answers "has
this thing changed", which is the only comparison a half-hourly curve can carry
honestly and the only one this app makes anywhere. The line stops at now rather
than running to zero across the afternoon.

`SolarYieldChart` is the period, per bucket — one bar, one series, no second
thing behind it. The bucket still running is hatched and counts towards nothing.

Fixing the intraday curve turned up a real inconsistency. The diagram's live
`SOLAR` node was `pvKwp × performanceRatio × shape`, a different model from the
one every other figure uses, and it disagreed by a factor of two and a half: a
29 kWp array read 22 kW on the diagram while the energy model had it making 70 kWh
across the whole day, which is a peak near 14. The curve is now the day's energy
spread over the day's shape, and the node reads off it, so the diagram, the daily
bar and the month's total are three readings of one quantity. A flat 0.55 standing
in for "today is partly done" went the same way: today's bar is the shape
integrated to now.

### The chart's period

`7D · 30D · 12M · Custom`, on the portfolio chart and on each site's own, taken
from the Raeo investor dashboard's `RangeTabs`: Custom is a tab rather than a
button beside the tabs, because the options are alternatives and belong in one
control. The strip is this app's own segmented track and the calendar behind
Custom is the analysis tab's `RangeCalendar`, so a reader who has set a window on
a genset already knows how to set one here.

**Every range draws the same thing**, at the grain `SOLAR_RANGE_GRAIN` gives it:
days below about ten weeks, months above. Nothing appears or disappears as the
reader moves between them, which is what lets the control be a plain segmented
track with no explanatory caption under it.

The daily series is derived from the monthly one rather than dealt beside it —
each day is a weight, normalised so the days sum back to their month's total to
within a kilowatt-hour of rounding. That is what lets a reader switch from 12M to
30D and still be looking at the figure on the tile above.

An array's own analysis tab keeps the window in the URL, so "look at the July
dip" is a link. The site page keeps it in local state: it
is one band on a page reached from a dozen places, and putting a chart control in
that page's address would make every link to a site carry a setting the sender
never chose.

### Nothing on either screen grows with the estate

This demo has four arrays and the carrier has thousands of sites, so both screens
are built to draw the same at either end. That ruled out the first version of the
solar band, which was one chart per array in a grid: at four it is a page, at
forty a wall of thumbnails nobody compares, at four hundred it does not render.
What is there instead is fixed by construction — the tiles are five, the
portfolio chart is one whatever it sums — and the array list has **two views**,
cards with a chart each and a table, opening in whichever suits the count with
the choice always available. Cards page in blocks of twelve; both views search.

The chart earns its place over a column of totals by saying *when*. An array
that has been flat all year is one thing; one that ran at a level until March and
has been a fifth below it since is a **step** — a fault with a date on it, and
somebody can go and look at what happened that month. Most solar sites on both
estates carry one, and `solarStep` is what the rest of the app reads: the count of
dark strings is computed from the depth of the step, the `Strings offline` row dates its
string alert from the month, and the analysis tab names it in the hand-off line.
One event, three readings of it.

A step has to be worth a tenth of the output before it counts as one. Weather here
runs ±7% month to month, so a shallower drop is inside the noise, and without that
threshold every array on the estate acquires a fault with an address — which is
what happened the first time this was rewired off the seed instead of off a
comparison.

`sfcLitresPerKwh` changed on this branch, and it is the one change that reaches
back into the shared product. It was a straight line, with the full-load figure
worsened by 0.4% of itself per point of load given up, and it is now the standard
two-term fuel model, `litres/kWh = b + a / loadFraction`, with a no-load floor of
a fifth of the full-load rate. The old line was flat enough that a set idling at
15% looked only a quarter worse than a properly loaded one; it is roughly twice as
bad. That region is where this estate lives, and every argument for putting a
battery beside a 20 kVA genset carrying a 4 kW tower rests on it.

### The three reports, one destination

`Energy` and `Solar report` were two rail items and are now two tabs of
`/report`, alongside a third that did not exist. They were split apart on a real
argument — one page carrying two headline figures that move for unrelated reasons
is the reliable way to make a reader distrust both — and that argument is about
**one screen**, which the tab strip still honours. What it never justified was two
destinations. The rail is a list of places and both were the same place.

The consolidation also retires a qualifier. `Solar report` had to carry one
because a rail item reading `Solar` beside `Battery` and `Gensets` reads as the
plant register — which, now that `/solar` has a page per system under it, it
emphatically is. Inside a section where every tab is a report there is nothing to
disambiguate, so the tabs are **Overall**, **Solar** and **Genset** and the
register keeps the short name it always wanted.

Only the report's own files moved under `modules/report/`. `SolarRangeTabs`,
`data/series.ts` and `range.type.ts` stayed in `modules/solar/`, because the
register's own analysis tab and the site page read them too — they are shared
charting infrastructure rather than part of the report.

The tile the three tabs share is `report/components/ReportTile.tsx`. It was
written twice before the move; two near-identical copies is what a shared
component costs, but three, on tabs a reader moves between in one sitting, is a
drift the reader would see.

#### The Genset tab, and its two decisions

The estate reported on its plant twice and its engines nowhere: `Overall` counts
what the sites burned and `Solar` holds the arrays to their design, so the
gensets appeared only as a litre column inside somebody else's argument.
Everything a fleet is read *down* — hours, fuel rate at the loading actually
held, unaccounted litres, what is falling due — was legible one machine at a
time.

**Part load is priced, not just reported.** A set's fuel rate is a property of how
hard it is worked rather than of the machine, and `sfcLitresPerKwh` is steep in
exactly the region this estate lives in. So the fleet's litres are quoted against
what the same kilowatt-hours would have cost with every engine near 80% of
nameplate — where these sets are specified to sit, and not 100%, which leaves no
headroom for the step load a tower's rectifiers present and is therefore a figure
nobody designs to. The difference is the largest lever on the page and it does not
announce itself in a litre total.

**Unaccounted diesel is a rate, not a window total,** and it is the one figure on
the page not measured over the thirty days in the heading. The reconciliation
works a **day** at a time (`FUEL_INTEGRITY.windowHours`), and carrying a standing
loss across a month claims more diesel than the tank holds — a 20 kVA set losing
six litres an hour comes to over four thousand litres against a tank curve that
records no such deliveries. Two screens disagreeing about the same diesel is the
one failure this data layer exists to prevent, so the report quotes the rate and
lets the reader multiply it. For the same reason gains are reported beside losses
rather than netted against them — one tank filling itself on paper must not cancel
another being drained — and a set whose flow meter has gone silent reads "—"
instead of a clean bill of health nobody issued.

### The seam, stated

`history.ts` deals every genset a run log from a hash of its id and knows nothing
about arrays or banks, so a solar-hybrid site's genset has a history in which it
ran like any other machine while the energy screen says it barely ran at all. The
two models are **not** reconciled, and the rule until they are is that they never
appear on one screen: the report's **Overall** and **Solar** tabs and the site
pages read `hybrid.ts`, while its **Genset** tab, the run log and the tank chart
read `history.ts`. Three reports sharing a section does not weaken that — a tab
strip is a set of screens, not one screen in three bands.

### The site page's top band

Three columns: the figures, the circuit, and **the live quantity that decides
whether somebody acts today** — the intraday curve where there is an array, the
tanks where there is not. That third column is why the band exists in this shape.
It used to hold two columns and most of a desktop screen of nothing, and the
previous answer was to widen the gaps until the emptiness looked deliberate.

The diagram says what is connected to the bus and the curve says what is coming
down it, which is one question asked twice, so they share a band. The period
charts sit below it: a different question, and one nobody asks before they have
looked at the picture.

### Brand

**Four colours** are the customer's, and every other token in `styles/colors.ts` is
the design system's, shared by every brand: `brand` (the login CTA and primary
button), `brand-text` (what stays legible on it), `sidebar` (the rail), and
optionally `battery`. Each is declared per brand in
[`src/brands/identity.ts`](src/brands/identity.ts) with the variable name the
customer's own stylesheet uses, so the next person can check a value rather than
re-eyedrop it. `colors.ts` reads them through `BRAND.theme` and keeps a `divergent`
note on each, so the Figma drift check still reports them as intended overrides.

A customer does **not** get their own `bg-canvas`, and does not get to make chart
marks invisible: CelcomDigi's `#FFE000` measures 1.2:1 on the surface every chart
draws on, so `solar` is a deep amber that clears 3:1 and the brand yellow keeps
every job it was actually good at. The one hard constraint on adding a brand is
that its `sidebar` must be dark enough to carry white foregrounds — the rail does
not follow the app's light/dark polarity, because it carries the customer's mark.

The tab is the one place a brand appears outside React, so the title, description
and favicon live in [`src/brands/manifest.ts`](src/brands/manifest.ts) — a
Node-only module that nothing in `src/` imports. The plugin reads it to fill
`index.html`, and inlines the included brands' entries as literals into the
generated registry, so the map that names every customer never reaches the client.
`main.tsx` then reconciles the document to the running brand, because a build-time
title cannot know about a Settings choice made later.

An unknown `VITE_BRAND` is a **hard error at build time**, not a fallback — the
build produces no output at all, so it cannot be deployed by mistake. The failure
mode of a quiet default is one customer's branding over another customer's estate
in a live meeting. Each dataset is also checked on load
(`assertDatasetIntegrity`) — a genset standing at a site id that doesn't exist used
to be a compile error and is now a thrown one, because the per-brand `CustomerId`
union was exactly what stopped two estates coexisting in one build.

**[docs/how-it-works.md](docs/how-it-works.md) explains what the product is for
and the concepts it is built on** — genset, site, run, reading, alert, tag, control
mode, fuel reconciliation and the rest — and the rules between them. Read that before changing behaviour;
this file covers what is built and what is faked.

There is no backend. The fleet is mock data and "logging in" writes a flag to
localStorage — see [Caveats](#caveats).

```bash
git clone git@github.com:Rooftop-Energy-Tech/telcoiq-design.git
cd telcoiq-design
bun install
bun run dev          # http://localhost:3400 — REDTONE, the default brand
bun run dev:telcoiq  # http://localhost:3404 — telcoIQ
```

Needs [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`); the
lockfile is `bun.lock`, so npm/pnpm will resolve different versions.

Port 3400, not 3000: this repo was forked from `gensetiq-frontend`, which keeps
:3100, and `rooftopiq-frontend-v3`, the mobile prototype and the tagging
prototype hold :3000, :3200 and :3300. Every one of them pins `strictPort`, so
each prototype owns a hundred and they all run side by side.

Any email and password gets you in.

## The component gallery

**`/gallery`** — every shared component, every state, one page. Dev only: the
route 404s in the `dist-*` builds, which are the ones that go in front of
customers.

```bash
bun run dev:telcoiq   # then http://localhost:3404/gallery
```

It covers the two shared tiers — the eight Radix primitives in
`src/components/ui`, and the shared pieces in `src/components/global` — plus a
full table of the colour palette. The ~140 page-shaped components under
`src/modules/*` are deliberately **not** in it: every one of them already renders
against real fixture data at its own URL in the table below, which is a better
bench than anything the gallery could stage.

What the running app cannot show you is **every state at once**, and that is what
the gallery is for: a battery glyph at five charge levels, an alarm pill at all
three severities, a filter card active and inactive, a button in seven variants.

Two things on it are not component benches at all, and are the reason it beats a
Storybook here:

- **The brand switcher**, top right. Five brands recolour the whole app through
  the token layer; on this page you watch every component change at once, which
  is the fastest way to find a hardcoded colour.
- **The token table**, at the foot. `src/styles/colors.ts` is the real design
  system — brands recolour through it, `figmaMap()` maps it onto Figma variables,
  and an org skill diffs it against the live file — and it had no viewer. Every
  token is drawn light-over-dark with its Figma variable beside it, over a
  checkerboard so the translucent ones read as translucent.

There is also a **dark switch**. `main.tsx` ships this build light-only and never
adds the `dark` class, but `colors.ts` carries a complete dark palette and
`colorThemeCss()` already emits the `.dark` block. The switch adds the class, so
a palette that has never been exercised can at least be looked at.

The variant lists are tied to each component's `cva` union by a
`Record<Variant, true>`, so adding a variant to `button.tsx` fails
`bun run typecheck` until the gallery lists it. A bench that has quietly fallen
behind the code is worse than no bench, because a reader trusts it.

## What's built

| Screen | Route | Notes |
| --- | --- | --- |
| Login | `/login` | Wordmark, email + password, teal CTA. Matches the Figma frame. |
| Gensets — list | `/gensets?view=list` | 24 units, sortable by attention (faults first): name, run state, alarm counts, fuel level, and — on the full-width list only — location and telemetry age. |
| Gensets — map | `/gensets?view=map` | Real MapLibre map with live clustering. |
| Genset home | `/gensets/<id>` | The genset's own page: tank + runway + service, controls + live gauges, this run beside today, what it is, alerts. All 24 units have one. |
| Genset analysis | `/gensets/<id>/analysis` | Two readings over one window on a dual-axis chart, with a hover crosshair. Built from the [Figma annotations](https://www.figma.com/design/rq8SndEmYOrjkEbCcbJU3P/RooftopIQ-V2?node-id=2799-3338) — see [below](#the-analysis-tab). |
| Genset runs | `/gensets/<id>/runs` | The run log: a timeline strip, totals for the chosen window, the list, and a CSV export. Not a Figma frame — see [below](#the-runs-tab-is-not-in-the-design). |
| Alarms / Equipment / Settings | `/gensets/<id>/alarms`, … | Named in the design's tab strip but not drawn — labelled placeholders so the strip isn't dead. Settings says what would belong on it: the [fuel leakage alarm](#fuel-leakage-is-not-in-the-design)'s switch and threshold, tags, notification routing. |
| Sites — list | `/sites?view=list` | 17 sites, worst standing alarm first, with the alarm pill as a column. Not a Figma frame — see [below](#the-sites-screens-are-not-in-the-design). |
| Sites — map | `/sites?view=map` | One pin per yard, coloured by the site's status bucket and sized by how many sets stand there. Not a Figma frame — see [below](#the-sites-screens-are-not-in-the-design). |
| Site home | `/sites/<id>` | Matches the Figma frame: the site's single-line diagram, then one row per genset with its run and its controls. All 17 sites have one. |
| Site settings | `/sites/<id>/settings` | How the site is fed and which gensets stand on it. Not a Figma frame; see [power role](#the-power-role-is-not-in-the-design) and [gensets](#attaching-and-detaching-gensets). |
| Site runs | `/sites/<id>/runs` | The same log across every set standing here — one strip lane and one table column per machine. |
| Alarms / Contract | `/sites/<id>/contract`, … | Named in the design's tab strip but not drawn — same treatment. |
| Deployment — list | `/deployment?view=list` | The dispatch feed: a row per posting, ongoing first, seven columns with the headers as the ordering control. Not a Figma frame. |
| Deployment — map | `/deployment?view=map` | One pin per **posting**, open in green and closed in grey, so a yard that has held four sets is four pins. Not a Figma frame. |
| Deployment — timeline | `/deployment?view=gantt` | One lane per machine, one bar per posting, on a week-ticked axis. The only view that draws depot time — see [how-it-works](docs/how-it-works.md#the-dispatch-feed). |
| Report — Overall | `/report` | What carried the load at every off-grid site over thirty days, how long its engine ran, and what it burned. Not a Figma frame — added on this branch, see [above](#this-branch-the-celcomdigi-white-label). |
| Report — Solar | `/report/solar` | The portfolio's generation, and every array in it as cards or a table. Not a Figma frame — same. |
| Report — Genset | `/report/genset` | The engines over the same thirty days: hours, what each set burns per kilowatt-hour at the loading it holds, what part load costs the fleet in litres, diesel unaccounted for, and what is falling due. Not a Figma frame — same. |
| Solar — register | `/solar` | A row per **solar system**, the way `/gensets` is a row per machine: state, output, capacity and its alarm counts. Worst first. |
| System home | `/solar/<id>` | The system's own page in the four bands: the strip, what the array is putting out now a junction box at a time, generation over time, and what the system is. Every solar site has one. |
| System analysis | `/solar/<id>/analysis` | Generation over a chosen window, a bar per bucket, with the window in the URL. |
| System devices | `/solar/<id>/equipment` | The array: its capacity, its modules and their rating, how many strings it is wired in and how many of those are dark. A description, not a list — see [below](#a-row-is-a-system-and-there-is-nothing-under-it). |
| System alarms | `/solar/<id>/alarms` | Every alarm the array carries, from both sources, in one standing table with a cleared log under it. |
| System service / settings | `/solar/<id>/service`, … | The tabs in the strip that are not drawn yet — labelled placeholders, same treatment as a genset's. |

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
/sites?q=senai                        # sites list, filtered
/sites?view=map&id=port-016&panel=true # one yard on the map, its preview open
/deployment?state=ongoing             # the dispatch feed, only what is out
/deployment?view=gantt&customer=east  # one division's postings on the timeline
/sites/telco-001                      # the site page the Figma frame draws
/sites/telco-001/runs?window=7d       # every set here, one log
/solar?q=kedah                        # the solar register, filtered
/solar/kdh-0431                       # one system's own page
/solar/kdh-0431/analysis?range=custom&from=2026-03-01&to=2026-06-30
/solar/mg-012/equipment                          # what that system is built from
```

A site page is reached from `/sites`, and each of its genset rows links back out to
that unit's own page — so the two sections meet in both directions. Its solar band
does the same for the other kind of plant, and the generation report's cards and
rows now open the array rather than the place it stands.

### A solar system has its own pages now

`/solar` was a `SectionTabs` scaffold — a subtitle counting the estate and six
empty tabs — and the scaffold's own note said where it was going: *"`/gensets` is
a register: a list of machines, and the tabs live one level down on each
machine."* It went there. The register took `/solar`, the six tabs moved onto
`/solar/<id>`, and the placeholder bodies went with them. `/battery` is untouched
and still a scaffold: it has no plant model to build a register out of, which is
the gap it was put in the rail to name.

#### A row is a system, and there is nothing under it

The register's row was briefly an **array**, then for a while there was a level
below it — an **inverter**, with its own page, its own dials, a control pad and a
bar per string on its MPPT inputs. Both are gone, and the second one for a reason
that outranks any argument about units: **these are telco sites.** A tower runs a
−48 V DC bus and its loads are DC, so the array feeds the bus directly. There is
no AC stage anywhere on the site, so there is no inverter in the cabinet, and a
page describing one was describing a box that is not there.

So the model is **system → string**, and a system is the only level that reports:

| | Solar system |
| --- | --- |
| Unit of | reporting, alarms, maintenance |
| Named by | the customer — "a 1.3 MW system" |
| Carries | kWp, modules, strings, commissioning date, its generation |
| Survives | its own plant being replaced |

Strings survived the boxes, and they are the reason the model still has anything
to say about a fault. A string is modules in series — a physical run on the roof
with a combiner at the end of it — and it is a fact about the array whatever it
terminates in. `string-out` is still the health rule that fires on a dated step in
the generation series, and it is still the most useful thing this module says.

**What went with the inverter, said plainly, because it is a real loss:**

- **Per-box state.** A plant used to be able to be four-fifths visible — one box
  silent, nine reporting, and the register printed `9 of 10 reporting`. There is
  one comms link to a site now, so a system is heard or it is not.
- **The strings as a drawing.** Dark strings were concentrated on one box and
  shown as bars on a shared scale, which made a fault *have an address*. What is
  left is a count: `1 of 4 strings has stopped delivering`.
- **The `insulation-low` rule.** Resistance to earth, below which a box refuses to
  start in the morning, was an inverter's own earth-leakage interlock. Nothing on
  a telco site measures it, and a rule this app cannot derive is one it must not
  print. Solar health went from five rules to three.

An array as its own level is still not coming back. It earns a place in a model
for one job, and it is *attribution* rather than measurement: a sub-array is a
plane with one tilt and one azimuth, and naming it is how a shortfall gets pinned
to a piece of roof rather than left as a figure about the whole system. Every site
on both estates is one plane, so there is nothing to attribute and the level would
only ever hold one child. When a customer turns up with an east and a west roof
the thing to add is a `plane` under the system — not an `array`, which is too
overloaded a word to reintroduce.

#### The system page

**Four bands**, the same four in the same order as a site's, a genset's and a
bank's — which is the whole point. An operator moving between a tower's genset,
its array and its bank finds the same things in the same places, and the pages
differ only in what they are *about*.

1. **The strip** — solar capacity, generation today, and the alarm counts.
2. **The junction boxes** — what the array is putting out right now, broken out a
   box at a time: strings, panels, how many are delivering, and the box's share of
   the kilowatts. Where nobody has surveyed the roof there is no box breakdown to
   draw, and the band falls back to one dial scaled to the array's **kWp**, which is
   the only ceiling there is. It was scaled to the inverters' combined AC rating, on
   the argument that a dial which can never fill reads as a plant permanently
   underperforming; with no boxes there is no AC rating, and the honest full scale is
   the glass. A clear noon lands near half way up, because that is what an array
   does. Beside the total, when the sun is down, a `Dark · first light 07:00` badge —
   without which a band of zeroes at nine in the evening is pixel-for-pixel a plant
   that has tripped.
3. **The chart** — generation, `Day / Month / Year / Lifetime`, one series.
4. **The details** — three nameplate facts: system capacity in kWp, the module
   count and rating, and the commissioning date. It was four; `Installed capacity`
   was the AC figure and it went with the boxes, along with the question it
   existed to answer. Nothing live is in this band, which is why it sits under the
   chart rather than over it — the order all four detail pages keep.

**What is wrong** was a fifth band and is now the first thing on the array's
`Alarms` tab, over the standing and cleared tables: a rule and what has been done
about it belong on one screen, and the band was spending the home page's last
screen restating the alarm counts the strip gives at the top.

Strings and the last module wash are deliberately not in band 4: `Devices` and
`Service` each own one, and restating them here would make it a second index of
the page rather than a description of the system.

Nothing on these pages invents a quantity `hybrid.ts` already has an opinion
about. Capacity, today's energy, the twelve months and the step-down all come
from there, so the system page, the site page and the generation report are three
readings of one model. What is added is the plant an energy model has no opinion
about — how the array is wired into strings, how many modules that is, and when it
was commissioned — and every one of those is dealt from the site's id, so the
screens that show them cannot disagree.

#### The strings are read off the shortfall

The part worth checking. An underperforming system gets a *step*: output drops in
one month and stays down. A step of that shape has one obvious cause on a PV
plant — strings have gone — and the arithmetic agrees, so the number of dark
strings is **computed from the size of the step**. That is what keeps the count,
the month the `Strings offline` row prints and the drop a reader can see in the chart three
readings of one event rather than three claims that happen to agree.

Never the whole array. Every string dark is a dead plant, a different fault with a
different fix, and the model cannot tell the two apart, so the page does not claim
to.

The dark strings used to be **concentrated on one inverter** rather than spread
evenly, which was both the realistic failure (a combiner fuse, a blown MPPT input,
one wet junction box) and the far more useful drawing: two boxes reading `11 of
11` beside a third reading `7 of 11` is a fault with an address, where ten boxes
each a little short is weather. With no boxes there is nowhere to concentrate them,
so what is left is the count and the date.

#### Two figures deliberately absent, for one reason

There is no **performance ratio**. A PR is the day's energy over what the
nameplate would have made in the irradiance that actually fell, and this app has
no irradiance — only a regional monthly average. Worse, `siteEnergy` caps
generation at what the site can absorb and these systems are sized to two-thirds
of a tower's annual energy, so a good part of a clear midday is spilled by
construction and any PR computed here would read low for a reason that is not a
fault. `kWh/kWp` states what the roof produced per unit of glass and asserts
nothing beyond it.

And there is no **`CURTAILED` state**, because that same spill is a thirty-day
energy cap the model does not resolve to a moment — the bank is held between 0.42
and 0.88 by construction, so there is no instant at which the app can say the
system is being held back right now. Both are the same gap, and both are the
first thing to add when the model grows a dump load.

#### What a silence costs, and what it does not

`hybrid.ts` will produce a day's generation for a plant nobody can hear — it
models a site's plant and knows nothing about telemetry, the same seam the run
log and the tank chart sit either side of. So the pages refuse to publish it: a
silent system reads `Offline`, today's energy and the figures derived from it
become em dashes, the intraday curve keeps only its typical-day baseline, and the
alert is critical.

The refusal used to be **scoped to the box**, and that was the whole reason the
model had a box: one quiet inverter in ten left the system `Generating`, the
register printing `9 of 10 reporting`, and a *warning* naming the box and the kWp
nobody could see. There is one comms link to a telco site, so that middle state is
gone — a plant is heard or it is not.

What survives either way is what this app worked out for itself over months that
are already closed. A silence is held at **at least a day**: six hours is a missed
poll, not an offline plant, and past a day there is nothing of today left to
publish anyway.

The state has to be *reachable* to be worth building, and moving the key from box
to site nearly deleted it — one chance in eight over three or four solar systems
comes up empty most of the time, and it did on both estates. So `isSilent`'s salt
is **chosen rather than arbitrary**: under `site/silent` exactly one system on each
estate is quiet, and neither is the largest, because a 1,333 kWp showpiece that is
permanently offline is a different kind of unhelpful. That is the same thing
`solarPerformance` does when it spreads 0.76–1.06 so the estate has healthy arrays
and tired ones.

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
  Sites, plus the report's **Solar** tab — linked as `/report/solar` rather than
  `/report`, since the tab strip is hidden at this width and a phone sent to the
  section would land on the one report it cannot read. The Overall and Genset
  tabs and Settings are desktop-only here, and a nav item landing on a screen laid out
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
  asked in sequence, so each band's row becomes a column. The alerts band on the genset
  and the health band on the array used to turn the same way — their 113px condition
  rails would have taken a third of a phone screen — and both were removed on
  2026-09-14, leaving the standing and cleared tables as the whole of each `Alarms`
  tab.
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

Separate app, deliberately: telcoIQ has its own login, its own mark, and a
completely different sidebar (Gensets / Deployment / Sites / Refuel; this branch
ships Sites / Solar / Battery / Gensets). Nothing in
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

    **The details band is identity, and deliberately only that** — name, make and
    model, rating, and a lorry plate on the sets that have one (most are bolted to
    a plinth and the row is simply absent, rather than a dash pretending at missing
    data). `Tank capacity` left the band because the fuel panel one band up already
    states it as `Max capacity`, beside the level it is the denominator of; a figure
    printed twice on one page is one a reader has to check against itself. The
    rating stays because it is the denominator of every load figure above it.

    What the band does **not** carry is the instrumentation — controller model,
    register numbers, fuel-sensor scaling, whether a tank is one bulk vessel or a
    day tank fed from it. Every one of those is a real question about a real site
    and not one of them is settled; they belong to whoever wires the ingest up, and
    a details block that guessed would be this prototype asserting facts it has not
    got.

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

2. **Mains health is measured, not inferred.** The first version of this derived it from
   the gensets — "a set is running, so the grid must be down" — and that is wrong for
   the case that matters most: a set on a **test exercise** runs beside a perfectly
   healthy grid, and inferring a failure from it reports an outage at a site that never
   had one. So a genset carrying the load and a failed grid are two facts, and the
   diagram states both: `off-load` under a healthy mains that isn't carrying, `failed`
   under a dead one. `SPG2093` and `SRB6644` are pinned to `TEST` so the fleet actually
   contains the case — see `mfg-015`.

   That is also why `Genset.startReason` was added. The incomer's reading is *derived*
   from it rather than seeded beside it, because two independent givens could disagree,
   and the disagreement would land on exactly this case.

3. **`0 kW` is still never printed.** The mains gets the same treatment the gensets
   already had — a word, not a measurement, when it isn't carrying — and the `LOAD`
   node now reads `not served` only when *nothing* is feeding. On a standby site with
   the grid up, the site's draw is the incomer's figure. Reading "0 of 2 feeding" over a
   site running perfectly well on the grid was alarm-shaped where no alarm existed, so
   the badge names the source everywhere: `On mains`, `On generator`, `Genset carrying`
   at a hybrid, `Not served` when nothing has the load. It briefly counted sets at a
   prime site — `1 of 2 feeding` — which answered how the plant is arranged rather than
   what is carrying it, and made one column speak in two grammars. How many sets are
   fitted and turning belongs to the genset screens.

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

Left out deliberately: the **Deployment** route, whose placeholder already reads
"moving gensets between sites" and which is the proper fleet-wide home for a depot
view. Detached sets stay reachable from any site's attach picker in the meantime.
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
   that a `GensetAlert` is a bit in the Modbus register map and that invented alarms
   are not allowed, "however plausible they read". No panel raises this one, because
   no panel sees both instruments at once. So it follows the `ServiceNotice` pattern
   the service change established: its own type, its own card, printing
   `Fuel reconciliation` where an alarm prints its register and bit.

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
site's own status bucket and sized by how much plant is standing there. Neither
screen is derivable by eye from the other.

The pins painted by the site's **condition verdict** until 2026-09-14, with a
`colorBy` prop choosing between that and the buckets. The verdict came off the whole
app (see below) and the prop went with it. Status is the right survivor rather than a
fallback: it is the vocabulary of the `Status` card sitting directly above this map
and of the chip that filters it, so clicking `Alarms raised` now narrows the list and
leaves the red pins standing. The *ranking* moved to the list beside it, which is
ordered by the alarm queue.

Both views carry the fleet screen's preview panel, and for its reason: a pin has
nowhere to put a link, so a clicked site has to open something that carries the way
in. The panel is a preview rather than a copy of the site page — what is feeding
the yard, what is standing against it, capacity and fuel, and the sets standing
there worst first, each a link to its own page. Its alarm row is a link too, so the
panel has two ways out of itself: the arrow opens the site, the pill opens what is
wrong with it. Site draw stays off it for the same reason it is off the list.

Adding the map gave a site row a second thing it could do, so the list adopted the
fleet table's split: **the row selects into the panel, the name navigates.** It was
one link when selecting meant nothing.

### The site condition verdict was removed

A site used to report a **condition** of its own — `Critical`, `Attention`,
`Optimum` — ranked from the gensets standing on it, and it was the sites list's
second column, the preview panel's first row, the phone card's first badge, the pin
colour and the ranking for all of them. Tristan removed it on **2026-09-14** and the
**alarm pill** took every one of those places: `Critical · Warning · Neutral`, the
same three figures every metric strip and device card in the app already drew, and a
link to the queue itself.

Two things were wrong with the verdict:

1. **It compressed a list nobody was shown.** `Attention` told a reader something was
   wrong and made them open the site to find out what — the same click the pill costs,
   except the pill says *how many* and *how bad* before it is clicked.
2. **It was a second opinion.** It ranked the **gensets' alarms only**, and a site is
   watched by more than its engines: the monitoring unit reports on the plant, the
   cabinet and the bank, and this app derives its own rules over the array. A yard with
   eleven standing rows and no genset among them read `Optimum` in the list while its
   own Alarms tab listed all eleven — the same undercount the site's metric strip was
   fixed for one screen up, and `SiteMetricStrip` states the rule: a summary that
   disagrees with the page it summarises is worse than no summary.

The counts come from `useEstateAlarmCounts` in `modules/site/data/siteAlarmQueue.ts` —
one pass over the estate off the same union `useSiteAlarmQueue` gives a single site. So
a row's pill, that site's own strip and its Alarms tab are three renderings of one
queue, and clearing a row on the tab drops the count and re-ranks the list on the way
back.

The **genset's** condition verdict is untouched. It still heads a machine's alerts
section, still colours its row on `/gensets`, and `GensetCondition` is still what a
leak moves. What went is the site-level roll-up of it.

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
- **Sites are mostly derived.** `modules/site/data/siteSeed.ts` holds the things
  a diesel engine cannot tell you — a site's name, the kind of load it carries, where
  the yard is, what the customer draws, which region it sits in and which rollout
  programme it was filed under. Everything else in `sites.ts` is summed or
  ranked from the gensets standing there: membership from the sets naming it, and
  capacity and fuel from them. Change a genset's `siteId` and every one of those
  figures follows — and so does which yard's alarm queue its controller's rows land in.

  Six of those givens are **editable** from the site's Settings tab — name, latitude,
  longitude, region, programme and supply. The edits are differences held in
  `data/siteOverrides.ts` and laid over the dataset by `siteSeeds()`, so the map moves
  its pin, the region chips re-count and the breadcrumb follows, and Reset restores the
  dataset's own row. The programme is a **grouping and nothing else** — no figure on
  any screen derives from it, and a site is allowed to be in none.

  The **intake reading** is the one derived figure with two halves. Whether the supply is
  live is derived: a yard's mains is dead exactly when some set there is out on an
  unfinished outage run, so `startReason` in `fleet.ts` is the only given behind it and
  the incomer cannot contradict a set's activity feed. What it *reads* is the site's own
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
  in each map (`genset/components/GensetsMap.tsx`, `site/components/SitesMap.tsx`)
  and both have to move together to switch to Mapbox or a self-hosted style.
- **No tests.** Prototype scope; `bun run typecheck` and `bun run build` pass.
