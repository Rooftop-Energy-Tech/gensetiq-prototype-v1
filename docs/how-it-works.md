# How gensetIQ works

What the product is for, the handful of concepts it is built on, and how the
screens fit together. Read this before changing behaviour — most questions about
"should it do X" are answered by one of the rules below rather than by taste.

For what is *implemented* versus mocked, see the [README](../README.md).

---

## The job

A genset is a diesel generator at a customer site. Usually it is on **standby**: it
sits idle until the grid drops, runs until the grid comes back, and burns fuel while
it does. At some sites there is no grid to wait for and the gensets are the supply —
see [Power role](#power-role). Someone has to know, across a fleet of them:

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

Those four are the whole of what a genset reports about itself, and `OFFLINE` is
one of them rather than a second axis beside them. It means **the panel has
stopped reporting** — we do not know what the engine is doing, which is a worse
position than knowing it is stopped, and it is why an offline unit carries the
comms alarm and no other: a panel that isn't talking cannot also be telling you
its oil pressure.

There is deliberately **no separate "online" flag**. The app carried one until it
was removed, and it never held anything the run state didn't: it was derived as
`runState !== 'OFFLINE'`, and the badge it fed sat in the genset header reading
`Online` beside a hero reading `Idle`, inviting the reader to look for a
distinction the machine does not make.

→ `src/modules/genset/types/genset.type.ts`

### Site

A **place with a load**, and gensets are what stand on it. One or more sets, one
changeover, one thing being kept alive.

A genset is always at exactly one site, and the relationship is held on the
*genset* (`siteId`) rather than as a member list on the site. A site therefore
cannot claim a unit that doesn't exist, and a unit cannot go missing from the site
it stands at — both of which a hand-maintained list eventually gets wrong.

A site owns only what cannot be inferred from a diesel engine: its name, what kind
of load it carries, and **which of its sets is on the bus**. Everything else it
reports — draw, installed capacity, fuel on site, condition — is **summed or ranked
from its gensets, never stored**, so a site cannot disagree with the machines on it.

### Power role

How the yard is fed, and therefore **which circuit the site page draws**:

- `STANDBY` — there is a mains incomer and the gensets back it up. The load normally
  sits on the grid; a set picks it up when the grid drops.
- `PRIME` — there is no mains incomer. The gensets *are* the supply and carry the
  load continuously, and a second set there is a spare rather than a backup to
  something else.

**It is a display choice, and only a display choice.** It selects a layout — whether
the single-line diagram includes a mains source above the gensets — and nothing else
depends on it. `isolatorStateOf`, the changeover, `defaultDutyId` and every control
pad behave identically under both roles.

That boundary is deliberate rather than a shortcut. A control that redrew a diagram
*and* quietly changed which sets could take load would be two operations wearing one
label, and the second would be a command this prototype has no business issuing. One
visible consequence of holding the line: a set's activity feed is the **machine's**
history, so at a site declared `PRIME` it may still read "Engine started on utility
outage". The role redraws the yard; it does not rewrite what the controllers did.

Every site defaults to `STANDBY`, which is what the whole app assumed before this
existed — so a fresh browser renders exactly the screens the design was drawn
against. Changing it is the one thing a site's [Settings tab](#the-sites-other-four-tabs)
does, and the choice lives in `localStorage` because there is no backend to put it in.

### Mains supply

What the intake meter at a standby site reads: whether the supply is **live**, and
what is flowing through it.

A **measurement, not an inference** — and that distinction is the whole reason this
concept exists rather than being folded into the run states. An earlier version
derived mains health from the gensets ("a set is running, so the grid must be down"),
which is wrong for the case that matters most: a set out on a **test exercise** runs
beside a perfectly healthy grid, and inferring a failure from it reports an outage at
a site that never had one.

So a genset carrying the load and a failed grid are two facts, not one, and the page
states both. That is what separates these:

| Meter | Duty set | The page says |
| --- | --- | --- |
| live | not carrying | mains carries; the set sits closed on a dead bus — a healthy standby yard |
| live | `RUNNING` | the set carries; the mains reads **off-load** — a test run, not an incident |
| dead | `RUNNING` | the set carries; the mains reads **failed** — the grid dropped and the set picked it up |
| dead | not carrying | **not served** — the grid is down and nothing has picked the load up |

The **mains contactor** is derived, never selected: the changeover control picks
between *gensets*, and putting the grid in it would dress a utility supply up as
something an operator can switch on. `closed` and `live` are the same value for it —
unlike a genset isolator, which can sit closed on a dead bus — because a transfer
switch must never bridge the two sources. There is no closed-and-dead mains position
to draw.

A carrying set therefore *wins*, and the grid's health is reported beside it rather
than in place of it.

### Duty set

One site, one load, one changeover — so **exactly one set is connected at a time.**
The connected one is the *duty* set; the others are isolated.

This is what the design's frame draws the outcome of, one closed isolator beside one
open, and taking it as the rule rather than a coincidence is what makes a two-set
page mean anything: the second set is not idling *in parallel*, it is isolated, and
moving the load to it is a deliberate operation.

It follows that **a site's draw is the duty set's output, not the sum of its running
sets'**. A set that happens to be turning while isolated is off-load and contributes
nothing to what the customer is pulling; adding it in would report a figure no meter
at the site could ever read.

The load can only be handed to a set that is **already turning**. The three refusals
are real, not caution: a stopped set has to be *started* first (a `START` command,
and those are inert here), a faulted set is isolated by its own controller, and an
unreachable set cannot be commanded at all.

What a site can say that no genset can is **which of its sets is on the bus**, and
that is the only site-level verdict the app makes. There is no roll-up of its
gensets' states into a site status — no `Covered` / `Standby` / `Exposed`, no site
run state. A site reports its changeover, its summed figures (capacity, fuel) and
the worst condition among its sets; the states themselves stay on the machines
that have them, one row each.

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

Two things a reading knows about *itself*, because no page can work them out:

**What kind of quantity it is.** Most readings are `instantaneous` — a value the
controller has right now. `Engine hours` is `cumulative`, a counter that can only
climb. `Mains outages (30 d)` and `Crank time` are `windowed`: one is already an
aggregate, the other is measured once per start rather than continuously. Only the
first kind is a trend, and that is the *reading's* fact, not the chart's — which
is why the analysis tab can offer a picker that never produces a meaningless plot.

**Whether it exists with the engine off.** Phase current, oil pressure, alternator
frequency and generator output are properties of a machine in motion. A stopped set
does not have a low one; it has none. So `engineOnly` readings report zero in the
snapshot and are a **gap** in the history — never a line drawn down to zero and
back, which would show a shutdown that did not happen. Temperatures and levels are
deliberately not in that set: a probe on an engine that stopped ten minutes ago
still reads 70 °C.

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

**Selecting opens the panel**, whatever the toolbar's toggle was set to. Selection
has no other visible effect — it tints a row, it recolours a pin — so with the
panel closed a click is a dead end that reads as a broken control rather than a
deliberate one. The toggle therefore means "hide the preview until I next ask for
one", and it never sits between the row-click and the preview it is supposed to
produce.

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

### The analysis tab

The home page answers *what is this machine doing*. This one answers *what has it
been doing*, and the difference is not a matter of showing more numbers. A snapshot
is a verdict: 103 °C is either past the limit or it isn't. A trace is an argument —
it shows the coolant climbing steadily for two hours before the alarm, or jumping
in a minute, and those are different faults behind the same reading.

**Two readings, two axes, one window.** The cap is not a simplification. Readings
carry incompatible units, and the moment a third arrives either two of them share
a scale that fits neither, or everything is normalised to a percentage of its own
range and the numbers stop being numbers. Two is what a pair of labelled axes can
state truthfully. Colour is the only thing tying a trace to its scale, so the
picker's chips double as the legend.

**Three ways to name a window, because there are three different questions.** A
**preset** — 24 hours, 7 days, 30 days — is anchored to now, and the answer is a
shape. A **custom range** is anchored to dates the reader already had in mind,
usually because a ticket, an invoice or a site visit put them there; it is picked
in whole days, since that is the unit a person names and the unit a URL can carry
legibly. A **run** is anchored to an event, and it is the only stretch of time over
which *every* reading on the machine is defined, because a run is by definition the
engine turning. That is why the run list lives here as well as on the `Runs` tab:
it is this screen's sharpest selector, not a cross-reference.

Each control clears the other two, so only a hand-edited URL can ask for more than
one at once — and `analysisRange()` is the single place that gets settled, run
before custom before preset. A custom range reaching past the history layer's own
horizon is clamped rather than refused: the reader asked for March, and showing
the part that exists beats an error about a boundary they cannot see.

**Alerts appear as lines.** An alert is a threshold on a reading, so plotting the
reading draws the threshold with it, on that series' own axis, marked where the
trace crossed. The rule's limit is held as a number and its prose (`< 24 V`) is
derived from it — the dashed line and the caption on the home page's alert card are
one fact rendered twice, not two facts typed twice.

The selection lives in the URL, so the useful thing to send is not "open BRF9540"
but the chart itself:

```
/gensets/brf9540/analysis?keys=coolant-temp,oil-pressure&window=7d
/gensets/brf9540/analysis?from=2026-07-20&to=2026-08-05
/gensets/brf9540/analysis?run=brf9540-run-3
```

There is no *deployment* selector, though the design's annotation names one. A
deployment is a period a genset was installed somewhere; a `Genset` carries a
single `siteId` with no history, so there is nothing to select. A control over a
relationship the model cannot express would look authoritative and filter nothing.

→ `src/modules/genset/data/history.ts`

### The other four tabs

`Runs`, `Alarms`, `Equipment`, `Settings` are named in the design's tab strip and
not drawn. Each is a real route with a labelled placeholder, so the strip isn't
four dead buttons. `Runs` is where the run card's `→` points — a reader looking at
one run's totals is one click from asking how it compares with the last twenty, and
`history.ts` already holds that log.

### The sites list

Seventeen sites, **worst condition first**, then by name. Condition is the
genset module's own verdict, ranked worst-among-the-sets-standing-here; name
breaks the tie so the order is total and the list doesn't reshuffle between
renders.

The columns are the site-level facts in the order they get asked: where is it,
is anything wrong, what is standing there, does it need a tanker. Site draw is
deliberately not among them — it is instantaneous and changes while you read the
list, which makes it a detail-page figure.

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

At a `STANDBY` site the topmost source is the **mains**, on its own contactor, onto
the same bus. The design's frame has no such node — it draws gensets only, which
quietly makes every site look like it has nothing else feeding it — and a page about
*backup* power that never shows what is being backed up is missing its subject. It
costs no new geometry, which is the argument for putting it in the sources column
rather than opposite them: a transfer switch **is** a changeover between two sources
onto one bus, so the mains is a source row like any other. A `PRIME` site draws
exactly what this page drew before the role existed.

Every node is captioned in two lines — what it is, and what it is putting into the
bus. Only a connected, energised source gets a **kW figure**; the rest get a word
(`off-load`, `stopped`, `unavailable`, `failed`), because `0 kW` is a *measurement*,
and claiming to have measured zero at a machine that is faulted or unreachable is a
stronger statement than the page is entitled to make. The load's caption is the
site's draw, stated where the power actually arrives — and on a standby site with the
grid up, that draw is the **meter's** figure, not a genset's.

Conductors are painted **dead runs first, then live ones**. Not cosmetic: every source
elbows onto the bus riser and runs along it to the tap, so with three or more sources
those riser segments overlap. In document order a dead genset could paint a grey stub
over the live mains riser above it, leaving a conductor that appears to go dead
halfway to the load. Ordering by state makes that unrepresentable.

An isolator carries two independent facts, and separating them is the whole point:

- **closed / open** — is this set *connected* to the site bus;
- **live / dead** — is it pushing power through it.

A set can be closed onto a dead bus, and that is the normal state of a healthy
standby installation: breaker made up, engine off, waiting. It is what lets the
controller pick up a mains failure in ten seconds instead of after somebody drives
out. The impossible combination is open *and* live, and `isolatorStateOf()` is the
one place that is guaranteed:

| Duty? | Run state | Isolator | Why |
| --- | --- | --- | --- |
| duty | `RUNNING` | closed, live | this is the set feeding the load |
| duty | `IDLE` | closed, dead | standby — made up and waiting |
| duty | `FAULT` | open, dead | the controller isolated it as part of shutting down |
| duty | `OFFLINE` | open, dead | we cannot hear from it, so it must be drawn as *not* contributing |
| not duty | anything | open, dead | isolated by the changeover; off-load even if turning |

That fourth row is a safety decision, not a display one. Assuming a silent machine
is carrying load is the single error on this page that could get somebody hurt.

The **mains contactor** does not appear in that table because it does not obey it —
it has no closed-and-dead position at all. See [Mains supply](#mains-supply).

**The changeover control** is the band's third column, to the right of the diagram,
on sites with more than one set — a single-set site has no changeover, and a
one-option control would imply an operation that does not exist. Picking a set hands
it the load and isolates the others; the diagram, the site's draw and the `off-load`
badge in each genset row all move together. Options that cannot take the load are
refused *and say which refusal it is*. On the site the design draws — one running set
beside a faulted one — every option but the current one is refused, which is the
honest answer: there is nothing to transfer to.

Only the duty set carries a glyph, on a chip the full height of the track; the others
are shorter, dimmed text. So the *specific* refusal — faulted, unreachable, stopped —
is legible only from the tooltip, which is the trade the design makes for a track
that reads as one live choice rather than four equal buttons.

Transferring is **modelled, not commanded**, the same line `START` and `STOP` hold.
It moves the load in the drawing because that is what a changeover does and it is
worth being able to see; it does not start an engine or pretend a breaker moved in
Johor.

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

`Runs`, `Alarms` and `Contract` are named in the design's tab strip, not drawn, same
placeholder treatment. `Contract` is the one tab with no counterpart on a genset, and
it is the clearest signal in the design that a site is a **commercial** object as well
as an electrical one: a genset has runs and alarms, but only a site has an SLA.

**`Settings` is built, and it does exactly one thing:** it sets the site's
[power role](#power-role). Two options, each stating both what it asserts about the
yard and what it changes on the page, over a **live preview** — the site's own diagram
at the selected role, using its real duty set and real meter reading. The choice above
is about a picture, so the picture is the argument for it.

The tab's old placeholder promised three things: which gensets are installed, how the
changeover is configured, and who gets called out. Two have no data behind them and the
third is already a live control on the Home tab, so they are absent rather than stubbed
— a heading over an empty div is worse than a page that does one thing.

It applies on click, with **no Save button**. There is no backend to save to; a Save
button would imply a round-trip, a server-side record and a rollback that do not exist.
The honest version is a control that visibly takes effect and a line of text saying it
went into this browser only.

---

## Where things live

```
src/modules/genset/
├── types/
│   ├── genset.type.ts       Genset, run state
│   ├── run.type.ts          GensetRun — one start to one stop
│   ├── telemetry.type.ts    Reading, GaugeReading, PhaseGroup, ControlMode
│   ├── alert.type.ts        GensetAlert, GensetTag, condition
│   ├── series.type.ts       Sample, ReadingSeries — a reading over time
│   ├── view.type.ts         the fleet screen's URL state
│   ├── detailView.type.ts   the alerts section's URL state
│   └── analysisView.type.ts the analysis tab's URL state
├── data/
│   ├── fleet.ts             24 mock units — the givens
│   ├── spread.ts            the one hash every mock number is seeded from
│   ├── detail.ts            everything derived from a given
│   └── history.ts           the run log and the reading series, built backwards
└── components/
    ├── …                    the fleet screens
    └── detail/              the genset home page
        └── analysis/        the analysis tab: picker, range, calendar, chart

src/modules/site/
├── types/
│   ├── site.type.ts         Site, power role, mains supply, switch states
│   └── view.type.ts         the sites list's URL state
├── data/
│   ├── sites.ts             17 sites — identity seeded, every figure derived
│   └── siteConfig.ts        the power role, per site, in localStorage
└── components/
    ├── SitesTable.tsx       the list
    ├── SiteDetailShell.tsx  header + tab strip
    ├── SiteHome.tsx         the designed page; owns the duty selection
    ├── SiteDiagram.tsx      the single-line diagram
    ├── SiteChangeover.tsx   which set is on the bus
    ├── SiteSummaryPanel.tsx what's feeding, capacity, fuel
    ├── SiteGensetRow.tsx    one row per set
    └── SiteSettings.tsx     the power role, with a live preview of it
```

`data/siteConfig.ts` is the one thing in the site module that is **neither seeded nor
derived** — it is a choice a reader makes while the app is running, so it cannot live
in `sites.ts`, which is built once at module load. It stores *overrides only*, keyed by
site id, so a fresh browser renders the designed screens and clearing site data restores
them.

`data/detail.ts` is worth reading if you are changing numbers. It is built on one
rule: **nothing is stated twice.** Every figure is either a given (tank level, run
state — from `fleet.ts`) or derived from a given through a stated relationship, so
the run's energy, its fuel burn, the consumption rate, the refuel date and the
tank runway all move together and none of them can contradict the others.
Per-unit variation is a hash of the genset's id, not `Math.random()`, so a unit
looks the same on every render and every reload.

`data/history.ts` applies that rule to time, and it is where the analysis tab's
credibility actually lives. Nothing there is a recording; it is a *consistent*
invention. Every series is generated backwards from the value `detail.ts` already
publishes and eased onto it at the right-hand edge, so the chart's last point and
the home page's gauge are the same number. The run log's newest entry **is**
`detail.run` — the same object, so there is nothing for it to drift from — and
every earlier run costs its fuel through the same `LITRES_PER_KWH` the home page
uses, so any row in the log can be checked with a calculator. Fuel level is
integrated from the burn rate rather than wobbled around a mean, because the slope
of a tank is a quantity somebody reads off the chart to plan a tanker.

`data/sites.ts` follows the same rule one level up. Only a site's *identity* is
seeded — its name and the kind of load it carries. Membership comes from the
gensets naming their site, its placename and position come from those gensets, and
its draw, capacity, fuel and condition are summed or ranked from them. There is no
stored site figure to drift.
