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

13 concepts. They are small, and the constraints between them are what keep
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

A genset is at one site or none, and the relationship is held on the *genset*
(`siteId`) rather than as a member list on the site. A site therefore cannot claim a
unit that doesn't exist and no unit can be at two sites at once — both of which a
hand-maintained list eventually gets wrong. See [Deployment](#deployment) for what
changes it, and why "or none" is now part of the sentence.

A site owns four things that cannot be inferred from a diesel engine: its name, what
kind of load it carries, **where the yard is**, and **what the customer draws**. Its
changeover — which of its sets is on the bus — is the fifth, and the only one that is
a live selection rather than a given. Everything else it reports — installed capacity,
fuel on site, condition — is **summed or ranked from its gensets, never stored**, so a
site cannot disagree with the machines standing on it.

Position and load used to be derived from the members too, and both had to stop when
gensets became movable. A site has to know where it is *before* a set arrives, or
deploying one has nowhere to send it; and a customer's consumption is not a function
of the machinery parked outside, or stripping a site of its gensets would make it
appear to stop using electricity. → `src/modules/site/data/siteSeed.ts`

### Deployment

Which site a genset stands at, and the act of changing it.

A site is a **yard**, not a folder — `fleet.ts` puts co-sited units within a hundred
metres of each other because that is what sharing a site means. So attaching a set is
a lorry, not a checkbox: **the machine moves.** It takes the site's placename and a
spot in its yard, and its pin moves on the fleet map.

That is forced, not chosen. Membership you could set freely without moving anything
would let a Penang set belong to a Petaling Jaya site, and every figure that made a
site *a place* would then be describing two places at once.

**Detaching moves nothing.** The set leaves the installation and goes to the **depot**
— `siteId: null` — but it is still standing in that yard until somebody collects it.
Inventing a depot coordinate to move it to would be a claim about the physical world
the app has not earned.

The depot is why `siteId` is nullable, and giving up "always at exactly one site" was
the price of being able to remove a set at all. Gensets genuinely exist before they
are deployed and while they are away being serviced; the alternative was making every
removal a transfer to somewhere the machine is not. What survives is the half that was
doing the work: membership is still held on the genset, so a set is at one site or
none, never two.

Every figure a site reports is summed from its members, so all of them move when this
does — capacity, fuel, condition, the diagram's source count, the duty default, and the
site's rank in the list. That rebuild is cheap for one specific reason: **`detail.ts`
and `history.ts` never look at where a machine is.** They key off genset id, so
relocating a set cannot invalidate a single reading or run.

→ `src/modules/genset/data/deployment.ts`

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

### Power meter

**A meter is a device, not a number.** That is the whole of this concept, and the
reason it exists as one: the site page used to state a grid figure at every site
unconditionally, as though measurement were free. It is not. Metering is a box
somebody fits to a circuit, and most sites have never had one.

A meter has a serial, a model, and a **fitting** — a site *and* the circuit it is
wired to, carried as one object so "at a site but wired to nothing" cannot be written
down. Unfitted, it is in stores.

Two circuits are worth metering, and they are genuinely different measurements rather
than two names for one:

| Circuit | Measures | Goes blind when |
| --- | --- | --- |
| `MAINS` | what the site **imports from the grid** | a genset picks up the load |
| `LOAD` | what the customer **consumes**, whoever supplies it | never |

A site metered on the mains alone is blind during exactly the events this product
exists to watch. That is a real trade a customer makes when they fit one and not the
other, so the app models the point rather than flattening both into "the meter".

A circuit with no meter reports **no figure**, and the page says which of two reasons:

- **`unmetered`** — nobody fitted a device. Somebody has to buy one.
- **`no reading`** — one is fitted and has gone quiet. Somebody has to go and look.

Those need different actions from different people, which is why a bare `number | null`
was not enough and `MeterFeed` carries the reason.

**Fitting a meter does not change what a site draws.** The load exists whether or not
anybody measures it — `siteSeed.ts` holds the physical quantity — so a meter only
changes whether the app can *tell you*. That separation is what stops metering from
looking like a lever on consumption.

One consequence worth stating: the load figure has a fallback chain, because *who is
supplying the load* and *how much it draws* are answered by different instruments. A
load meter is preferred, then whatever is carrying — a genset's own controller, or the
mains meter while the grid carries — then nothing. The load meter comes first because
it is the only source that stays true across a changeover: transfer between two sets
whose controllers report different outputs and the load has not changed.

→ `src/modules/meter/types/meter.type.ts`

### Mains supply

What the intake meter at a standby site reads: whether the supply is **live**, and
what is flowing through it.

A **measurement, not an inference** — and that distinction is the whole reason this
concept exists rather than being folded into the run states. An earlier version
derived mains health from the gensets ("a set is running, so the grid must be down"),
which is wrong for the case that matters most: a set out on a **test exercise** runs
beside a perfectly healthy grid, and inferring a failure from it reports an outage at
a site that never had one.

Whether the supply is **live** is known at every site, meter or no meter — it comes
from the transfer switch, which senses voltage on the incomer because that is how it
decides to transfer at all. **How much is flowing** is a separate instrument entirely;
see [Power meter](#power-meter). Conflating the two would make an unmetered site look
like a site with no grid.

What a meter reads when the grid is carrying is the **site's own load**, seeded in
`siteSeed.ts`. That is a fact about the customer, not about the plant: a hospital
draws what a hospital draws. It was briefly scaled off installed genset capacity,
which was a convenience that quietly made consumption a function of the machinery —
and being able to detach a set made it plainly wrong, since stripping a yard would
have made the customer appear to stop using electricity. It also let one load carry
two numbers: `mfg-015` metered 152 kW while its own genset reported carrying 175 kW.

The device that reads it is now modelled — see [Power meter](#power-meter). The seed
remains the physical quantity; the meter is what makes it visible. A consumption
pattern over time, rather than one instantaneous figure, is the next step and needs
nothing above `SiteSummary` to change.

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

**An alert is a bit in the controller's alarm map, and the set of them is
closed.** It is the register map's alarm bits marked *To Include in Dashboard* —
26 of them across registers 1299, 1300, 1301, 1304 and 1390 — and nothing else.
Each alert names its register and bit, so any row on the page traces back to the
sheet it came from. There are no invented alarms, however plausible they read.

Most of those bits are a threshold on a reading. `AL Battery Voltage` is the
controller's *name for a rule* that watches `battery-voltage` and fires below
24 V. Two consequences follow, and both are load-bearing in the UI:

1. **The number that tripped it is shown with it.** "Alarm · AL Battery Voltage"
   is an adjective; "Alarm · AL Battery Voltage — Starter battery voltage 21.8 V,
   threshold < 24 V" is a claim you can check.
2. **Severity belongs to the rule, not the reading.** The same reading carries a
   warning band inside a shutdown band as two independent rules — which is how a
   panel is actually configured — neither needing to know about the other.

Two bits have no reading, and `readingKey` is `null` for those: `Sd Override` is a
statement about the panel's configuration, and `DPF status` is an aftertreatment
flag. Their cards show the name and the rule in prose and no value. Forcing a
reading onto them would mean inventing a measurement to justify a flag.

**The map's 31 marked bits are 26 here.** The five `AL Common *` roll-ups are left
out on purpose, and the reason is the interesting part. Each is an OR over *every*
protection in the controller, and the map has 21 alarm bits that are **not** marked
for the dashboard (`AL Fuel Level Sd`, the `AL AIN` sensor pairs, `AL Mains Fail`,
`AL Maintenance 1–3`, the fence and rental timers). So `AL Common Sd` can be true
when nothing on this page is — and that is the case it would earn its place in: the
only signal that something the dashboard does not show has stopped the engine.

Shown as one more card it says nothing ("Any shutdown protection active", next to
`AL Oil Press Sd`). Shown properly it would separate *explained* from *unexplained*
and only shout about the second — but that needs a column the map does not have
yet, since 19 bits are typed only `Alarm` and whether `AL Overspeed` is a shutdown,
a breaker-open or a stop is a per-protection panel setting. Until that arrives, or
until an operator asks for the catch-all, it is out. A prototype should not draw a
control whose behaviour it cannot state.

Every alert carries **two** classifications, and they answer different questions:

| | values | what it is for |
| :-- | :-- | :-- |
| `type` | `Shutdown Alarm`, `Alarm`, `Warning`, `Info` | the map's own protection class — what the panel will *do* |
| `severity` | `CRITICAL`, `WARNING`, `NEUTRAL` | how loudly the page shouts — the three chips the design has |

`type` maps onto `severity` in one place, `SEVERITY_OF_ALARM_TYPE`. Both alarm
classes are critical, because a set that has shut down and a set that has dropped
its breaker are both a call-out — but the card's badge shows the `type`, since
`Shutdown Alarm` and `Alarm` are not the same instruction to whoever is driving
out there. Neutral is a *note* — a DPF regeneration coming due — not a problem,
which is why it has no colour of its own and does not spoil the condition verdict.

**What the map does not give is the setpoints.** It names each bit, not the value
it fires at, which is a per-site commissioning number. The limits in
`data/detail.ts` are therefore the one invented quantity left, set at the
conventional points for a 415 V / 50 Hz / 1500 rpm set.

→ `src/modules/genset/types/alert.type.ts`

### Tag

The operator's own filing system: a named list of reading keys.

Tags are **not** the controller's taxonomy. Two crews running identical hardware
group it differently depending on what they get called out for, so a tag is a
list and nothing more. A reading can sit under several — starter battery voltage
matters to both `Battery & charging` and `Starting` — which is the point of tags
being lists rather than a partition.

Selecting a tag narrows the alerts section from "everything this machine reports"
to "the handful of numbers I care about right now", and pulls in each reading's
alarms with it.

The ten tags are **grouped around the alarm map**, which is a change from the first
version. That one was drawn against an invented alarm pool and grouped the real one
badly: `Generator output` ended up holding ten alarms while `SLA performance` and
`Fuel system` held none, so half the chip row could not answer the question a chip
is for.

| Tag | Alarms |
| --- | :-: |
| Speed & frequency | 7 |
| Generator voltage | 4 |
| Load & current | 4 |
| Coolant | 3 |
| Battery & charging | 3 |
| Starting | 3 |
| Lubrication | 2 |
| Panel & comms | 2 |
| Service | 1 |
| Fuel | 0 |

Speed and frequency share a tag on purpose: on a four-pole set at 50 Hz, 1500 rpm
*is* 50 Hz, so underspeed and underfrequency are one event read by two instruments,
and filing them apart sends somebody chasing two faults.

`Fuel` carries no alarms and stays. A tag answers "how is this subsystem doing",
and three healthy readings with nothing wrong is a complete answer. It is also a
question worth asking of the map: the controller *has* `AL Fuel Level Wrn` and
`AL Fuel Level Sd`, and neither is marked for the dashboard.

A tag is mostly reading keys, because that is the useful direction — name the
numbers and the alarms watching them follow. `alarmIds` is the escape hatch for the
two alarms with no reading (`Sd Override`, `DPF status`), which would otherwise
belong to no tag; a filing system with rows that cannot be filed is not one.

### Fuel reconciliation

**Two instruments, and the disagreement between them.** A genset can carry a tank
**level sensor** — how much diesel is in there — and a fuel **flow meter** — how
fast diesel is going to the engine. Neither on its own can see fuel going missing:
the tank sensor watches the level fall and cannot say whether the engine burned it,
and the meter watches the burn and cannot say what is left. Subtract one from the
other and what remains is fuel that **left the tank without passing the injectors**,
which is a leak or a siphon.

Over a rolling 24-hour window:

```
expected level = level 24 h ago + refuels − metered burn
unaccounted    = expected − measured
```

Four rules make it usable.

**The window is wall-clock, not run hours.** A stopped set meters nothing, so every
litre its tank loses is unaccounted for by definition — which makes a parked machine
the most sensitive configuration the detector has, and overnight siphoning the
easiest thing it catches. A run-hours window would be symmetric with the service
schedule and blind in exactly that case: a standby set running four hours a month
would take half a year to fill one window, and would never look at the seven hundred
hours it spent sitting in a yard with a full tank.

**Instrument tolerance is deducted before anything is called a shortfall.** A probe
rated ±1% of full scale is worth ±24 L on a 2,450 L tank whether it is brimmed or
nearly dry, and a meter rated ±0.5% of *reading* earns a tolerance that shrinks as
the set idles. Both come off first; what is left is the **confirmed shortfall**, and
only that is compared against the operator's line.

**The operator sets one number, as a percentage of tank capacity.** Percent because
it is the only form that carries across a fleet — `2%` is the same instruction on a
600 L tank and a 3,000 L one, where `45 L` is tight on the first and meaningless on
the second. It cannot be set below the probe's own accuracy percentage: a line drawn
finer than the instrument can resolve is not a threshold, it is an alarm that is
always on. Every other quantity — the window, the 30-minute blanking after a
delivery or an engine transition, the coverage floor, the 3× escalation — is a
constant of the detector, because those are facts about how a tank behaves rather
than about what a customer is willing to lose.

**The absence of the check is a state, not a silence.** Most sets have never had a
flow meter fitted, so the ordinary answer is that nothing can be said — and a genset
that was never checked must not read as one that was checked and found sound. Seven
states, and only one of them is `ok`:

| | |
| --- | --- |
| `unavailable` | An instrument is not fitted, or is fitted and silent |
| `off` | Capable, and an operator has switched the alarm off |
| `suspended` | Watching, but the window is unusable — settling, or not yet covered |
| `ok` | Reconciled inside the threshold |
| `warning` | Confirmed shortfall past the threshold |
| `critical` | Past 3× the threshold, or standing across two consecutive windows |
| `surplus` | The tank holds **more** than it should |

`surplus` is deliberately not a leak. A tank gaining fuel is an unrecorded delivery
or a failing instrument, the data cannot separate the two, so the app names both and
picks neither — then re-anchors, or one delivery nobody wrote down would poison every
window after it.

**It is the app's arithmetic, and it must never become a register bit.** No
controller raises this: a panel watches its own tank and its own injectors and never
puts the two together. So it is typed separately from `GensetAlert`, carries no
register or bit, and prints `Fuel reconciliation` on its card where an alarm prints
its coordinates. Note it is also *not* the map's `AL Fuel Level Wrn`, which fires
when a tank is **low** — a full tank losing eighty litres a night trips that one
never.

**A leak moves the condition verdict; an overdue service does not.** The asymmetry
is deliberate. A service falling due is a chore nobody has done yet; a tank losing
fuel onto the ground is a live fault, and a genset doing that while its page reads
`Optimum` would cost the reader their trust in every other verdict on the screen.

→ `src/modules/genset/types/fuelIntegrity.type.ts`,
`src/modules/genset/data/fuelIntegrity.ts`

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
/sites?view=list ──┐  click the site's name,                       │
                   ├─────────────→ /sites/<id>  (home)             │
/sites?view=map  ──┘  or the panel's →                             │
                                        │                          │
                                        ├── /runs                  │
                                        ├── /alarms                │
                                        ├── /contract              │
                                        ├── /settings ◀────────────┼── /meters
                                        └── a genset's name ───────┘   (a meter's site)
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

**Alerts appear as lines.** Most alarm bits are a threshold on a reading, so
plotting the reading draws the threshold with it, on that series' own axis, marked
where the trace crossed. The rule's limit is held as a number and its prose
(`< 24 V`) is derived from it — the dashed line and the caption on the home page's
alert card are one fact rendered twice, not two facts typed twice. The two bits with
no reading behind them draw nothing here, which is correct: there is no axis to put
them on.

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

### The runs tab

Where the run card's `→` points, and the question it answers is the one that arrow
implies: *how does this run compare with the last twenty?* So the page leads with
the comparison and puts the list last.

**Three bands, in the order the questions arrive.**

**The strip** — runs as bars, gaps as space. The most useful thing on the page and
it carries no number at all. A fleet mixes duty profiles, and a set that runs
continuously, one that follows a load and one that has started three times since
June are three different machines to look after. A table of timestamps *states* that
difference; the strip draws it, and the reader has it before reading a row. It is
also how *when did it last run* gets answered without arithmetic — for a backup set,
readiness is the gap between the last bar and the right edge.

A site's strip has **one lane per set**, and the stack is the point: two sets
alternating read as interleaved lanes, and a vertical slice with no bar in any lane
is a stretch where the site had nothing running. That gap is the site tab's reason
to exist, and it is invisible on either machine's own page.

**The totals** — completed runs, time running, energy, fuel, for the chosen window.

**The log** — one row per run, newest first, the open one at the head. The start
stamp links to `/analysis?run=<id>`, which closes a loop that until now ran only the
other way, from that tab's run picker to here.

#### Listing and totalling are two different questions

Answering both with one rule was the first version's mistake, and it is worth
recording because the bug it caused looked like correct behaviour.

**The list shows every run that was turning during the window.** It asks *what was
this machine doing between these dates*, and a run that began earlier and was still
turning inside the window is the most emphatic possible answer. Selecting on start
date alone made a set that had been running without a break for three days report
**no runs in the last 24 hours** — and because the strip, the totals and the table
all shared that rule, they agreed with each other perfectly while all three were
wrong. An open run makes it obvious, since every window ending at `now` contains
one, but the flaw was never special to open runs: a closed run that started
twenty-five hours ago and stopped an hour ago vanished from a day's view the same
way.

Bars are therefore **clipped, not dropped** — a run already turning when the window
opened runs off the left edge, and that clipping is itself the information.

**The totals claim only the runs the window owns: finished, and begun inside it.**
The listing rule is generous because showing a reader something true costs nothing.
This one is strict because it feeds a figure somebody bills against, and the two
kinds of row it excludes are excluded for different reasons:

| Excluded | Why |
| --- | --- |
| **Still turning** | Its figures are still climbing, so summing them makes the same export return different numbers half an hour apart — on a billing document, two documents that disagree. |
| **Carried in** from before the window | It delivered some of its energy on the far side of the boundary. Pro-rating would invent a number, since output is not uniform across a run — the entire premise of the analysis tab. Counting it whole would credit this window with fuel burned before it opened. |

So a run belongs to the period it *began* in, the way a transaction belongs to its
date: arbitrary at the boundary, but a stated rule a reader can check rather than a
computation they must trust. Both kinds of excluded row are **listed with their
figures dimmed**, and the CSV gives them their own `Status` — `In progress` and
`Carried in` beside `Completed` — so that filtering the sheet to `Completed` and
summing the column lands on exactly the number the header states. A file that
disagrees with itself in the one way a spreadsheet makes easy to hit is worse than
one that omits the rows.

**The span is always stated.** Without it "204,300 kWh" reads as a lifetime total,
and this log goes back sixty days while the machine has been in service far longer.

#### The range, and the file

Four presets and a calendar. The presets are the analysis tab's own vocabulary,
imported rather than retyped — the two tabs sit one click apart and a `7d` meaning
different spans on each would be the app disagreeing with itself. `All` is this
tab's addition and earns its place: a backup set runs three times a year, so every
bounded preset is empty for it.

There is no *by run* selector, though the analysis tab has one. This page **is** the
list of runs; narrowing it to one would be a filter whose result is the row you
clicked.

**Export CSV** writes the chosen range to a file, client-side — every figure is
already on screen, so round-tripping to a server to have them read back would only
add a way for the download and the page to disagree.

Leaving the app changes what "correct" means. On screen a caption carries a caveat
and the reader has the rest of the page; in a spreadsheet the file *is* the context.
So two things a reader could not otherwise reconstruct are written into it:

| | |
| --- | --- |
| **The range covered may not be the range asked for** | The log has a horizon, and a request reaching past it is clamped. A file headed "12 May – 16 Aug" holding eight weeks of rows misrepresents itself, so the clamp survives as a stated fact rather than a silently narrowed pair of dates. |
| **An open run is not billable** | Listed, excluded, and the file says which. |

Timestamps are local with an explicit offset, never `toISOString()` — UTC moves a
06:00 start in Malaysia to the previous calendar day, which where the period
boundary is the billable fact is a run invoiced to the wrong month. Printed ends are
the last instant *included*: both ranges are held half-open, which is right for
arithmetic and wrong to print, and "requested to 2026-08-17" for a range drawn to
the 16th is an off-by-one on the field a reader checks first. Units live in the
column headers and the cells hold raw numbers — `1,260 kWh` is a string that breaks
its own column and cannot be summed, which defeats the format.

The whole selection lives in the URL, which matters more here than on the analysis
tab: the range in the link is the range in the file.

```
/gensets/brf9540/runs?window=all
/gensets/brf9540/runs?from=2026-07-01&to=2026-07-31
/sites/telco-001/runs?window=7d
```

**Not here, deliberately:** start and stop cause (no source for it yet — the
`startReason` on a `Genset` is the *machine's* current reason, not a per-run
record), efficiency figures, and fuel discrepancy.

→ `src/modules/genset/types/runsView.type.ts`, `src/modules/genset/data/runsCsv.ts`

### The other three tabs

`Alarms`, `Equipment` and `Settings` are named in the design's tab strip and not
drawn. Each is a real route with a labelled placeholder, so the strip isn't three
dead buttons.

### The meters list

Sixteen devices, in the sites table's language — the same shape of question about a
different object, and a third table pattern would be a third thing to learn for
nothing.

Its columns are the questions a meter gets asked, in order: *which device*, *is it
working*, *where is it*, *what is it wired to*, *what does it say*. Site and circuit
are separate columns rather than one "fitted at" string, because a reader scanning for
gaps is scanning one of them at a time — "which sites have nothing" or "how many mains
circuits are covered".

The count above the table is about **coverage**, not inventory: `13 of 15 fitted`, and
how many have gone quiet. How many meters exist is not a question anybody has.

A meter in stores reads `—`, not `0 kW`: a box on a shelf has taken no measurement. A
fitted one can legitimately read `0 kW`, and often does — a mains incomer carries
nothing while a genset has the load, and the device is working correctly when it says
so. That is the distinction the whole module turns on: zero is a measurement, absence
is not.

There is no meter detail page. A row links to its **site's Settings tab**, which is
where the fitting is actually changed — a list showing a placement with no route to
editing it would be a dead end.

### The sites: list and map

Seventeen sites, **worst condition first**, then by name. Condition is the
genset module's own verdict, ranked worst-among-the-sets-standing-here; name
breaks the tie so the order is total and the list doesn't reshuffle between
renders.

The columns are the site-level facts in the order they get asked: where is it,
is anything wrong, what is standing there, does it need a tanker. Site draw is
deliberately not among them — it is instantaneous and changes while you read the
list, which makes it a detail-page figure.

**The map is the same seventeen on the ground.** One pin per yard — coloured by the
site's own condition, and sized by how many sets stand there, because "one set or
three" is the difference between a site that loses its supply when a machine faults
and one that does not.

It was argued against for a long time, on the grounds that a site's position *is*
its gensets' position and `/gensets?view=map` already draws it. That is true of the
coordinates and wrong about the question. The fleet map answers *where are my
machines*, so a yard with three sets is three pins and a customer site reads as a
cluster of hardware; this one answers *where are my customers, and which of them is
in trouble*. Neither is derivable by eye from the other.

Both views carry a **preview panel**, and the map is why it exists: a pin has
nowhere to put a link, so clicking one has to open something that carries the way
in. The panel is a preview rather than a second copy of the site page — what is
feeding the yard, its condition, installed capacity, fuel on site, and the sets
standing there worst first, each linking to its own page. Site draw stays off it for
the same reason it is off the list.

That also settled how a row behaves. It used to be one link, because selecting a
site meant nothing; now the list follows the fleet table's split — **the row selects
into the panel, the name navigates** — since a row that behaved differently
depending on which view was showing would read as broken. Selecting opens the panel
whatever the toolbar's toggle said, for the reason the fleet screen gives.

The whole view state lives in the URL, the same as the fleet's:

```
/sites?view=map&id=port-016&panel=true
```

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

**`Runs` is built** — the genset module's own panel, not a site-flavoured copy. The
rules that make it trustworthy are the same rules at both levels, and a second
implementation of them is a second set to keep in step. What differs is a lane per
set on the strip and an asset column in the table, which are the same fact: a site's
log has more than one machine in it. See [the runs tab](#the-runs-tab).

Two things are true only of the site version.

**Its energy figure is what the sets *produced*, not what the site *received*.**
Only one set is connected to the bus at a time, so a second set turning while
isolated is off-load and delivered nothing to the load. Summing both is right for
"what did this plant do" and wrong for "what did the customer get". The page cannot
resolve that — it does not know, historically, which set was duty — so it says which
of the two it is reporting rather than picking one silently, and the caveat travels
into the CSV, where it matters more for having no surrounding page to infer it from.

**It lists the runs of the sets standing here *now*.** A run is a fact about a
machine, and a machine's site can change — so a set that arrived last week brings its
whole history with it, including runs it performed in another yard. Fixing that needs
a time-bounded record of where a machine was; a [`Deployment`](#deployment) is
current placement, not a history of it. Until that exists this is the honest limit of
a site-level log.

`Alarms` and `Contract` are named in the design's tab strip, not drawn, same
placeholder treatment. `Contract` is the one tab with no counterpart on a genset, and
it is the clearest signal in the design that a site is a **commercial** object as well
as an electrical one: a genset has runs and alarms, but only a site has an SLA.

**`Settings` is built, and it configures the three things a site *is*** — how it is
fed, what stands on it, and what measures it.

**Power configuration** sets the [power role](#power-role). Two options, each stating
both what it asserts about the yard and what it changes on the page.

**Gensets installed** lists the site's machines with a Detach on each, and a picker to
attach more. The picker offers the **depot** first, then sets at other yards labelled
`Move from Hosp-006` — because restricting it to the depot would make every transfer a
two-step errand across two pages, via an intermediate state nobody asked for, while
naming the source site makes it impossible to take a set off another yard without
reading that you are doing it. It states the physical consequence too — *"Attaching
moves the set to Kota Bharu, Kelantan"* — since [deploying moves the
machine](#deployment) and a picker that hid that would be concealing the biggest thing
it does.

**Metering** is a slot per circuit — mains incomer and site load — each either holding
a device or empty, because that is the shape of the switchboard rather than of a list.
A flat list of "meters at this site" would leave the reader to work out which circuits
were covered by reading down it, and would say nothing about the ones that aren't,
which is the more important half. An empty slot is a fact with an owner and a price,
so it is drawn rather than left as a blank.

Under all three is a **live preview**: the site's own diagram at the selected role,
current membership and current metering. Attach a set and it appears in the drawing;
fit a meter and a figure replaces `unmetered`. The choices above are about a picture,
so the picture is the argument for them.

The tab's old placeholder promised a third thing — who gets called out — which has no
data behind it and is absent rather than stubbed. A heading over an empty div is worse
than a page that does what it can.

Everything applies on click, with **no Save button**. There is no backend to save to; a
Save button would imply a round-trip, a server-side record and a rollback that do not
exist. The honest version is a control that visibly takes effect and a line of text
saying it went into this browser only.

A site with **no gensets** is now reachable, and the two roles answer it differently. A
standby yard still draws `MAINS → LOAD` — on the grid, no plant installed, which is
true and worth seeing. A prime yard has no incomer and no machines, so there is nothing
to draw and the page says so; the alternative is a load box with a conductor arriving
from nowhere.

### Phone width

Four of these screens lay out for a phone: the **two lists** and the **two home
pages**. They are the same routes at a narrower window rather than a parallel set of
mobile ones, so a link works wherever it is opened and the designed desktop frames
are untouched.

The line is Tailwind's `md`, 768px. Almost every decision either side of it is a CSS
class; the two that cannot be are in `lib/useIsCompact.ts`, where the *tree* differs
rather than its layout — a table swapped for cards (rendering both and hiding one
would put every row's links in the accessibility tree twice), and the map's panel
inset, which is a number.

**The nav becomes a floating bottom bar with two destinations**, Gensets and Sites,
because those are the two with mobile layouts. The same rule hides the genset's and
the site's tab strips, where only `Home` is built for a phone. Every route still
resolves if a URL is typed or followed from a desktop link — what is withheld is
*navigation* to a screen the app cannot show properly, which is the honest form of
"not built yet".

**The lists become cards, and the whole card navigates.** Not the table with columns
dropped: the columns that survive 390px are the ones that say least on their own, and
the fuel figure and the placename are why anybody scrolls. There is no preview panel
at this width to select into, so the table's select-versus-navigate split has nothing
to be a split between — and a card that highlighted itself and did nothing else would
be the dead-end control the fleet screen's toggle rule exists to avoid.

**The home pages needed no rewrite, because their reading order is already
vertical.** The genset's three bands and the site's diagram-then-rows are asked in
sequence, so a phone gets the same page in the same order with each band's row broken
into a column. The alerts band turns as well: its condition rail is 113px, a third of
a 390px screen, so on a phone the verdict reads across the top of the band instead of
down its left edge.

The exception is the two **fixed-geometry drawings**. Neither reflows — their
conductors land on the boxes at measured coordinates, and a reflow leaves a wire
ending in mid-air — but they answer a narrow screen differently, and the difference is
which failure costs less:

- **`SiteDiagram` (398px) scales.** It measures the box it is handed and shrinks the
  whole canvas as one piece, so every coordinate survives and the only casualty is
  type size — 0.9 at 390px, which is a 9.5px caption. Scrolling was the earlier answer
  and it was worse: the load node, the thing the whole drawing points at, started off
  screen.
- **`PowerFlowDiagram` + `ControlPad` (484px) scrolls sideways** in its own strip. The
  right-hand half is four tap targets, and shrinking a control below a thumb is a
  worse answer than asking for a swipe.

One trap is worth knowing before editing any of it. Where the desktop layout is a
wrapping row holding a fixed item beside a shrinkable one, **`flex-wrap` is the wrong
instruction at phone width**: both items "fit" on one line once the shrinkable one may
shrink, and the result is a squeezed column with its contents spilling under the fixed
one — a 100px run card under a 220px control pad. Those rows are `flex-col
md:flex-row md:flex-wrap` instead.

---

## Where things live

```
src/modules/genset/
├── types/
│   ├── genset.type.ts       Genset, run state
│   ├── run.type.ts          GensetRun — one start to one stop
│   ├── telemetry.type.ts    Reading, GaugeReading, PhaseGroup, ControlMode
│   ├── alert.type.ts        GensetAlert, GensetTag, condition
│   ├── fuelIntegrity.type.ts the two fuel instruments, and the leak arithmetic
│   ├── series.type.ts       Sample, ReadingSeries — a reading over time
│   ├── view.type.ts         the fleet screen's URL state
│   ├── detailView.type.ts   the alerts section's URL state
│   ├── analysisView.type.ts the analysis tab's URL state
│   └── runsView.type.ts     the runs tab's URL state, window rules and totals
├── data/
│   ├── fleet.ts             24 mock units — the givens
│   ├── deployment.ts        which site each set stands at; the fleet, deployed
│   ├── spread.ts            the one hash every mock number is seeded from
│   ├── detail.ts            everything derived from a given
│   ├── history.ts           the run log and the reading series, built backwards
│   ├── fuelInstruments.ts   which sets carry what, and the leak alarm's settings
│   ├── fuelIntegrity.ts     the reconciliation, and the condition it can move
│   └── runsCsv.ts           the run log as a file somebody bills against
└── components/
    ├── …                    the fleet screens, incl. GensetsCards for phone width
    ├── detail/              the genset home page
    │   └── analysis/        the analysis tab: picker, range, calendar, chart
    └── runs/                the runs tab — strip, totals, log; shared with sites

src/modules/site/
├── types/
│   ├── site.type.ts         Site, power role, mains supply, switch states
│   └── view.type.ts         the sites screens' URL state — view, search, selection
├── data/
│   ├── siteSeed.ts          17 sites — name, kind, where the yard is, what it draws
│   ├── sites.ts             everything else, summed from the sets standing there
│   ├── siteRuns.ts          every set's runs, merged into one time-ordered log
│   └── siteConfig.ts        the power role, per site, in localStorage
└── components/
    ├── SitesToolbar.tsx     search, the list/map switcher, the panel toggle
    ├── SitesTable.tsx       the list
    ├── SitesCards.tsx       the list at phone width — one card per yard
    ├── SitesMap.tsx         the map — a pin per yard, coloured by condition
    ├── SiteDetailPanel.tsx  the preview beside the list and over the map
    ├── SiteDetailShell.tsx  header + tab strip
    ├── SiteHome.tsx         the designed page; owns the duty selection
    ├── SiteDiagram.tsx      the single-line diagram
    ├── SiteChangeover.tsx   which set is on the bus
    ├── SiteSummaryPanel.tsx what's feeding, capacity, fuel
    ├── SiteGensetRow.tsx    one row per set
    ├── SiteGensets.tsx      attach and detach the site's machines
    ├── SiteMetering.tsx     which meter is on which circuit
    ├── SiteRuns.tsx         the Runs tab — the genset panel, over every set here
    └── SiteSettings.tsx     the Settings tab — role, gensets, metering, preview

src/modules/meter/
├── types/
│   ├── meter.type.ts        PowerMeter, the two circuits, MeterFeed
│   └── view.type.ts         the meters list's URL state
├── data/
│   └── meters.ts            16 devices — the estate, and where each is fitted
└── components/
    └── MetersTable.tsx      the list
```

`modules/meter` depends on `site/data/siteSeed.ts` and **never** on `sites.ts`, because
the dependency runs the other way: a site summary reads its meters to build its
figures. Same reason the seed file has no imports at all.

`data/siteSeed.ts` has **no imports**, and that is structural rather than tidiness.
`sites.ts` needs it and so does `genset/data/deployment.ts` — which needs to know where
a yard is, so attaching a set can move the machine there — and `sites.ts` reads the
fleet, which reads deployment. Leaving the seed inside `sites.ts` closes that loop; pure
data at the bottom of the graph breaks it.

`data/siteConfig.ts` and `genset/data/deployment.ts` are the two things **neither
seeded nor derived** — choices a reader makes while the app is running. Both store
*overrides only*, so a fresh browser renders the designed screens and clearing site
data restores them. Site summaries are memoised on the deployed fleet's identity rather
than built once at module load, which they used to be: the original reason for building
once was that one pass meant one clock reading, and that survives intact because
`buildSummary` reads no clock at all.

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
