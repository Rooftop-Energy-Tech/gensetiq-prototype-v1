# How gensetIQ works

What the product is for, the handful of concepts it is built on, and how the
screens fit together. Read this before changing behaviour — most questions about
"should it do X" are answered by one of the rules below rather than by taste.

For what is *implemented* versus mocked, see the [README](../README.md).

---

## The job

A genset is a diesel generator on standby at a customer site. It sits idle until
the grid drops, runs until the grid comes back, and burns fuel while it does.
Someone has to know, across a fleet of them:

- which ones are turning right now, and how hard;
- how much diesel is left and when a tanker has to be sent;
- what each run cost — hours on the engine, litres burned, kWh delivered;
- what is about to break.

gensetIQ answers those four questions. Everything in the app is one of them.

---

## The model

Seven concepts. They are small, and the constraints between them are what keep
the screens honest.

### Genset

A physical machine: an asset tag, a model, a location, a tank, and a **run
state** — `RUNNING`, `IDLE`, `FAULT` or `OFFLINE`.

Run state and connectivity are **different questions** and the UI never merges
them. Run state is what the machine is *doing*; online is whether we are hearing
from it. `OFFLINE` means the controller has stopped reporting — we do not know
what the engine is doing, which is a worse position than knowing it is stopped.
A running genset whose modem has dropped is the most dangerous combination the
app can show, and one badge cannot say it.

→ `src/modules/genset/types/genset.type.ts`

### Site

A **place with a load**, and gensets are what stand on it. One or more sets, one
changeover, one thing being kept alive.

A genset is always at exactly one site, and the relationship is held on the
*genset* (`siteId`) rather than as a member list on the site. A site therefore
cannot claim a unit that doesn't exist, and a unit cannot go missing from the site
it stands at — both of which a hand-maintained list eventually gets wrong.

A site owns only what cannot be inferred from a diesel engine: its name, and what
kind of load it carries. Everything else it reports — draw, installed capacity,
fuel on site, condition — is **summed or ranked from its gensets, never stored**,
so a site cannot disagree with the machines on it.

What a site can say that no genset can is whether the load is actually **covered**:

| Coverage | Means |
| --- | --- |
| `Covered` | something here is feeding the load right now |
| `Standby` | nothing is running, and at least one set is fit to start |
| `Exposed` | no set here can pick the load up — every one faulted or unreachable |

`Exposed` is the reason the concept exists. It is invisible on any individual
genset's page — each set is merely stopped, which is what a standby set is meant
to be — and it is the state somebody gets called at night about.

Coverage is **not** the same as condition. A site can be `Covered` with a critical
alert on the very set that is carrying it, and `Exposed` with a clean alert list: a
yard of tidily stopped sets nobody can reach.

→ `src/modules/site/types/site.type.ts`

### Run

One start to one stop.

**A run is never created by a person.** The controller opens one the moment the
engine comes up and closes it the moment the engine stops. The run log therefore
*is* the machine's history: there is no way to have a run without the engine
having turned, and no way for the engine to turn outside a run.

Exactly one run per genset can be open, and `endedAt === null` is what marks it.
Anything asking "what is this genset doing right now" is asking about the open
run.

A run carries three totals, and they are the three numbers an operator asks for
first:

| | |
| --- | --- |
| **Time running** | hours on the engine — what the service interval counts |
| **Energy produced** | kWh delivered — what the site actually got |
| **Fuel consumed** | litres burned — what it cost |

These are *cumulative*, not instantaneous. They keep accumulating whether or not
anybody is watching, which is why they live on the run and not among the live
gauges.

→ `src/modules/genset/types/run.type.ts`

### Reading

A named quantity the controller reports: `Starter battery voltage`, `Oil
pressure`, `Phase current L3`.

A reading is not "a gauge" or "a row" — the page decides how to draw it. The four
with a designed sweep become dials; the three-channel sets (line voltages, phase
currents) become bar groups; the rest become rows under whichever tag references
them. Keeping that decision out of the data is what lets an alert point at a
reading without caring where on the page it is rendered.

→ `src/modules/genset/types/telemetry.type.ts`

### Alert

**An alert is a threshold on a reading.** Not an event, not a log line.

`Undervoltage` is the *name of a rule* that watches `battery-voltage` and fires
below 24 V. It has its own name, its own severity, and a reading behind it. Two
consequences follow, and both are load-bearing in the UI:

1. **The number that tripped it is always shown with it.** "Warning ·
   Undervoltage" is an adjective; "Warning · Undervoltage — Starter battery
   voltage 21.8 V, threshold < 24 V" is a claim you can check. An alert with no
   reading behind it would be unfalsifiable.
2. **Severity belongs to the rule, not the reading.** The same reading can carry
   a warning band and a critical band as two independent rules, neither needing
   to know about the other.

Three severities: `CRITICAL`, `WARNING`, `NEUTRAL`. Neutral is a *note* — a
service coming due — not a problem, which is why it has no colour of its own and
does not spoil the condition verdict.

→ `src/modules/genset/types/alert.type.ts`

### Tag

The operator's own filing system: a named list of reading keys.

Tags are **not** the controller's taxonomy. Two crews running identical hardware
group it differently depending on what they get called out for, so a tag is a
list and nothing more. A reading can sit under several — oil pressure matters to
both `Lubrication` and `Generator condition` — which is the point of tags being
lists rather than a partition.

Selecting a tag narrows the alerts section from "everything this machine reports"
to "the handful of numbers I care about right now", and pulls in each reading's
alerts with it.

### Control mode

`AUTO` or `MANUAL`, and they are exclusive.

In `AUTO` the controller owns the decision: it starts on a mains failure and
stops when mains returns. A person reaching for START would be fighting it. So
**START and STOP only mean anything in `MANUAL`**, and within `MANUAL` only the
one that would change something is enabled — you cannot start a running set.

---

## The screens

```
/gensets?view=list ──┐
                     ├── click the genset's name ──→ /gensets/<id>  (home)
/gensets?view=map  ──┘        or the panel's →              │
                                                            ├── /analysis
                                                            ├── /runs
                                                            ├── /alarms
                                                            ├── /equipment
                                                            └── /settings
                                                                  ▲
/sites ── click the site's name ──→ /sites/<id>  (home)            │
                                        │                          │
                                        ├── /runs                  │
                                        ├── /alarms                │
                                        ├── /contract              │
                                        ├── /settings              │
                                        └── a genset's name ───────┘
```

### The fleet: list and map

Two views of the same 24 units, switched in the toolbar. Both support a preview
panel on the right.

Clicking a row or a pin **selects** the genset into that panel — a preview, not a
commitment. Getting *into* a genset is a separate, deliberate act: click its name
in the list, or the `→` in the panel header. Over the map the panel's arrow is
the only way in, because a pin has nowhere to put a link and clicking one has to
leave you on the map or the selection is useless.

The whole view state lives in the URL, so any state is linkable and Back steps
through it:

```
/gensets?view=map&q=selangor&id=brf9540&panel=true
```

### The genset home page

Where a click into a genset lands. Three bands, separated by rules, and **the
order is the order the questions get asked** — this is the one design decision
the whole page rests on.

**Band 1 — what is it doing, and how long for.**
Run state and load on the left; the current run's three totals in a card; the
tank, its runway and the refuel date on the right. Everything here is cumulative
or slow-moving: it is still true if you looked away for an hour.

The load badge is present *only* while the engine turns. A stopped genset has no
load, and "0 kW" would read as a genset running into an open breaker — a real and
quite different fault.

The fuel runway counts down to a **30% reserve**, not to empty. Empty is not a
number anybody plans against: a set that runs its tank dry picks up air in the
fuel system and needs bleeding before it will restart. `hours to 30%` and
`Refuel by` are the same quantity in two units — litres-above-reserve ÷ burn rate
— one for a shift and one for a schedule, so they cannot disagree.

A **stopped** set states its runway differently, and has to. The same arithmetic
is still the runtime it would get if you started it, but a *date* would claim the
tank is draining while the engine sits idle. So a stopped set shows runtime and
no date, and labels its rate as the one from its last run.

**Band 2 — what can I do, and what is it doing right now.**
The control pad, the single-line diagram it acts on (GENSET / LOAD / changeover),
and the live dials: engine speed, active power, oil pressure, coolant
temperature, plus the three line voltages and three phase currents as bar groups.

This band **empties when the engine stops**, which is why the controls sit before
the gauges rather than after: the controls are the part that still matters on a
stopped set. A row of dials pinned at zero says less than one line of text saying
the engine is stopped, and it invites the reader to wonder whether the page is
broken.

The phase bars are drawn from zero and grouped by quantity because the point is
the **comparison** — an imbalance across phases is a real fault (a dropped
conductor, an unbalanced load) and it shows up as three bars of different lengths
before anybody reads a number.

**Band 3 — what is wrong.**
A condition verdict on the left, two rows of filter chips, then the results.

The chips are a **single-select filter** with two kinds of entry, and the
asymmetry between them is deliberate:

| Chip | Question | Shows |
| --- | --- | --- |
| **Severity** (`Critical 2`) | what is wrong, worst first | matching alerts only |
| **Tag** (`Coolant`) | how is this subsystem doing | every reading under the tag — alerting ones promoted into cards, quiet ones as plain rows |

A severity is a property of *alerts*, so filtering by it cannot surface a healthy
reading. A tag is a property of *readings*, so filtering by it has to show the
ones that are fine as well — otherwise selecting `Coolant` on a healthy engine
returns an empty list and the reader cannot tell "nothing wrong" from "nothing
measured".

Single-select, not multi: two filters intersected produce a result nobody asked
for ("critical alerts, but only coolant ones"), and the chip row stops being
readable as a summary of the machine.

Tag chips are **coloured before anybody clicks them**, by the worst alert among
their readings. Green means "these numbers are all inside their thresholds",
which is the answer most of the time and worth being able to see without opening
anything.

The verdict — `Optimum` / `Attention` / `Critical` — is *derived* from the alerts,
never stored, so it cannot drift from them. Worst severity wins; neutral alerts
do not spoil it.

The selection lives in the URL, so a link can open a genset with its coolant
readings already showing:

```
/gensets/brf9540?tag=coolant
/gensets/brf9540?severity=critical
```

### The other five tabs

`Analysis`, `Runs`, `Alarms`, `Equipment`, `Settings` are named in the design's
tab strip and not drawn. Each is a real route with a labelled placeholder, so the
strip isn't five dead buttons. `Runs` is where the run card's `→` points — a
reader looking at one run's totals is one click from asking how it compares with
the last twenty.

### The sites list

Seventeen sites, **worst coverage first**, then by condition, then by name.

Coverage leads rather than condition because it is the more urgent question: a
site with a critical alert on a running set is still carrying its load, while a
site with nothing able to start is not, even with a clean alert list.

No view switcher and no preview panel, unlike the fleet screen. A site has no
second representation worth building — its position on a map *is* its gensets'
position, which `/gensets?view=map` already draws — and a preview panel would
duplicate the site page it links to almost line for line.

### The site home page

The diagram, then one row per genset. Two bands, and this order round.

**The single-line diagram** is the site's own content: every set, its isolator,
the bus they share, and the load at the end of it. It is the only thing on the
page that is a fact about the *yard* rather than about a machine in it, and it
establishes the topology the rows below then fill in.

An isolator carries two independent facts, and separating them is the whole point:

- **closed / open** — is this set *connected* to the site bus;
- **live / dead** — is it pushing power through it.

A set can be closed onto a dead bus, and that is the normal state of a healthy
standby installation: breaker made up, engine off, waiting. It is what lets the
controller pick up a mains failure in ten seconds instead of after somebody drives
out. The impossible combination is open *and* live, and `switchStateOf()` is the
one place that is guaranteed:

| Run state | Isolator | Why |
| --- | --- | --- |
| `RUNNING` | closed, live | feeding the load |
| `IDLE` | closed, dead | standby — made up and waiting |
| `FAULT` | open, dead | the controller isolated it as part of shutting down |
| `OFFLINE` | open, dead | we cannot hear from it, so it must be drawn as *not* contributing |

That last row is a safety decision, not a display one. Assuming a silent machine
is carrying load is the single error on this page that could get somebody hurt.

Flow along a live conductor is animated, and it is switched off under
`prefers-reduced-motion` — the conductor is already teal, glowing and terminated
in filled dots, so the motion is the one cue nothing else duplicates.

**The genset rows** each carry the asset, four badges, its current run and its
control pad — and they are the genset's **own components**, `CurrentRunCard` and
`ControlPad`, not site-flavoured copies. A control pad that behaved differently
depending on which page you pressed it from would be the worst kind of divergence
to ship: the rules about when `START` is live are safety rules, and they belong in
one component. The asset name links through to the genset's own page.

### The site's other four tabs

`Runs`, `Alarms`, `Contract`, `Settings` — named in the design's tab strip, not
drawn, same placeholder treatment. `Contract` is the one tab with no counterpart
on a genset, and it is the clearest signal in the design that a site is a
**commercial** object as well as an electrical one: a genset has runs and alarms,
but only a site has an SLA.

---

## Where things live

```
src/modules/genset/
├── types/
│   ├── genset.type.ts       Genset, run state
│   ├── run.type.ts          GensetRun — one start to one stop
│   ├── telemetry.type.ts    Reading, GaugeReading, PhaseGroup, ControlMode
│   ├── alert.type.ts        GensetAlert, GensetTag, condition
│   ├── view.type.ts         the fleet screen's URL state
│   └── detailView.type.ts   the alerts section's URL state
├── data/
│   ├── fleet.ts             24 mock units — the givens
│   └── detail.ts            everything derived from a given
└── components/
    ├── …                    the fleet screens
    └── detail/              the genset home page

src/modules/site/
├── types/
│   ├── site.type.ts         Site, coverage, isolator state
│   └── view.type.ts         the sites list's URL state
├── data/
│   └── sites.ts             17 sites — identity seeded, every figure derived
└── components/
    ├── SitesTable.tsx       the list
    ├── SiteDetailShell.tsx  header + tab strip
    ├── SiteHome.tsx         the designed page
    ├── SiteDiagram.tsx      the single-line diagram
    ├── SiteSummaryPanel.tsx coverage, draw, capacity, fuel
    └── SiteGensetRow.tsx    one row per set
```

`data/detail.ts` is worth reading if you are changing numbers. It is built on one
rule: **nothing is stated twice.** Every figure is either a given (tank level, run
state — from `fleet.ts`) or derived from a given through a stated relationship, so
the run's energy, its fuel burn, the consumption rate, the refuel date and the
tank runway all move together and none of them can contradict the others.
Per-unit variation is a hash of the genset's id, not `Math.random()`, so a unit
looks the same on every render and every reload.

`data/sites.ts` follows the same rule one level up. Only a site's *identity* is
seeded — its name and the kind of load it carries. Membership comes from the
gensets naming their site, its placename and position come from those gensets, and
its draw, capacity, fuel and condition are summed or ranked from them. There is no
stored site figure to drift.
