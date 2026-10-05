# How gensetIQ works

What the product is for, the concepts it is built on, and how the screens fit
together. Read this before changing behaviour — most questions about "should it do
X" are answered by one of the rules below rather than by taste.

For what is *implemented* versus mocked, and for how the brands and the build are
wired, see the [README](../README.md).

> **This file grew out of telcoIQ's.** Until 2026-09-22 the product also had site,
> solar and battery screens, a hybrid energy model and a cabinet. They are gone; the
> sections describing them were removed on 2026-10-05. Where a remaining paragraph
> mentions a site page, it is history.

---

## The job

A **genset** is a diesel generator on a lorry. On Express Mission's estate it is
**trucked to a yard for a job** — usually a substation (a *pencawang elektrik*) whose
supply is being worked on — runs there for days or weeks, and is brought back. The
job is a **deployment**.

Someone has to know, across a few dozen machines:

- what is **out**, where, and since when — and what each job cost in hours, energy
  and litres;
- which machines are **at risk** right now, and which need a person sent;
- how much diesel is left, where it came from, and whether any went missing between
  the depot, the fuel truck and the genset;
- what each machine has been doing, and when it is next due for service.

gensetIQ answers those questions. The pages are Gensets, Deployments, Fuel, Service
and Reporting.

---

## The estate, and whose app this is

The product is one build, and the customer is **configuration**. `VITE_BRAND` picks
it; `src/brands/` holds everything a brand may change.

A brand owns *whose app this is* — the name on the door, the mark on the rail, three
colours, and which estate the demo walks through. It does **not** own the product
model: the vocabulary is the product's; which sites use which entry is the dataset's.

**Identity and dataset are separate axes.** A brand *names* a dataset rather than
containing one. The unbranded build shows the carrier estate under product colours.

| Brand | Estate | Sites | Sets |
| --- | --- | --: | --: |
| `express-mission` (the default) | utility — pencawang in Peninsular Malaysia | 38 | 38 |
| `gensetiq` | carrier — a tower network, under product colours | 25 | 30 |

A build carries only the brands it is allowed to show: the registry is generated per
build, so a customer's deployment has no other customer's name, mark or site names
anywhere in it — not behind a flag, absent. The Settings picker keys off the same
list, so the gate and the bundle cannot drift apart.

Two groupings come with an estate, and they are **different axes** rather than two
names for one:

- A **region** (a carrier's network regions; on Express Mission's estate, the
  state) is where the site *is*. Geography settles it and an operator gets no say.
- A **programme** is a line the operator draws for their own reasons — a funding
  round, a refurbishment campaign. It is a grouping and *only* a grouping: no figure,
  no default, no behaviour derives from it.

Unassigned is a first-class answer, not a gap — twenty-eight of Express Mission's
thirty-eight sites are in no programme, because they are not *work*, they are the
network.

A region owns **sites**, and a genset takes its region from the site it stands at.
An id seeded onto each machine would be a second copy of a fact the site already
states, and detaching a set would leave a machine in the workshop still claiming a
region. The consequence is deliberate: a set fitted nowhere has no region.

→ `src/brands/types.ts`, `src/brands/datasets/`, `src/modules/site/data/customers.ts`,
`src/modules/site/data/programs.ts`

---

## The model

The concepts below are small, and the constraints between them are what keep the
screens honest.

### Site

A **place with a load**: a yard a genset can be sent to. One or more sets, one
changeover, one thing being kept alive. There are no site screens now; sites are the
data the deployments, gensets and alarms read.

Whether this is the top of the model depends on the estate, and on this one it is
not. Where a genset is bolted to a plinth beside the tower it feeds and nobody asks
where a set has been sent, the site *is* the asset and the rail leads with it. Where
the plant is hired out and trucked between jobs — which is the estate this build
carries — the machine is the fact and the yard is where it happens to be standing
this week. The rail leads with Gensets accordingly; see [the screens](#the-screens).

A genset is at one site or none, and the relationship is held on the *genset*
(`siteId`) rather than as a member list on the site. A site therefore cannot claim a
unit that doesn't exist and no unit can be at two sites at once — both of which a
hand-maintained list eventually gets wrong. See [Deployment](#deployment) for what
changes it, and why "or none" is part of the sentence.

Six things about a site are **givens** — statements somebody made about the place,
which somebody can make differently: its name, what kind of asset it is, where the
yard is, its region, its programme, and **how it is fed**. What the customer draws
is a seventh, seeded and not editable, because it is a measurement. Everything else
a site reports — installed capacity, fuel on site, status — is
**summed, ranked or derived, never stored**, so a site cannot disagree with the
machines standing on it.

Position and load used to be derived from the members, and both had to stop when
gensets became movable. A site has to know where it is *before* a set arrives, or
deploying one has nowhere to send it; and a customer's consumption is not a function
of the machinery parked outside, or stripping a site of its gensets would make it
appear to stop using electricity.

**What kind of asset it is** is not decoration. A switching centre and a rural
coverage site with identical plant are not equally covered by one working genset —
one of them carries traffic for a whole state. It also sets the scale a reader
should expect the load in: a macro base station is 4–6 kW and a switching centre is
a few hundred, so "is 205 kW a lot here" has no answer without it.

→ `src/modules/site/types/site.type.ts`, `src/modules/site/data/siteSeed.ts`

### Power role

**How the yard is fed**:

| Role | The bus carries |
| --- | --- |
| `GRID_BACKUP` | a mains incomer, gensets behind it |
| `DIESEL_PRIME` | gensets only, continuously |

There were four, with `DIESEL_HYBRID` and `SOLAR_HYBRID`, until the hybrid plant was
removed; those sites are `DIESEL_PRIME` now.

**It decides two things.** Whether the site has a mains supply (`hasMains`), and
where a monitoring unit's nine per-phase AC alarms file: under `Site` where there is
an incomer, under `Genset` where the generator is the only AC source. Nothing about
the gensets' own behaviour depends on it.

The role is the dataset's. It could be changed on a site's Settings tab, held in
`localStorage`, while there were site pages; the stored overrides are still read.

### Genset

A physical machine: an asset tag, a model, a location, a tank, and a **run state** —
`RUNNING`, `IDLE` or `OFFLINE`.

Those three are the whole of what a genset reports about itself, and `OFFLINE` is
one of them rather than a second axis beside them. It means **the panel has stopped
reporting** — we do not know what the engine is doing, which is a worse position
than knowing it is stopped, and it is why an offline unit carries the comms alarm
and no other: a panel that isn't talking cannot also be telling you its oil
pressure.

A genset whose controller has been silent for **over an hour** reads `OFFLINE`,
whatever the seed says it was last doing (`OFFLINE_AFTER_MINUTES` in `fleet.ts`,
2026-10-05). Before that, `BRF9540` read `Idle` five days after its last message.

There is deliberately **no separate "online" flag**. The app carried one until it
was removed, and it never held anything the run state didn't: it was derived as
`runState !== 'OFFLINE'`, and the badge it fed sat in the genset header reading
`Online` beside a hero reading `Idle`, inviting the reader to look for a distinction
the machine does not make.

Every rating, tank and load is sized to the site the machine stands at. A 1,000 kVA
genset beside a 5 kW tower is the one detail that would tell a reader this estate
was borrowed from another product.

→ `src/modules/genset/types/genset.type.ts`

### Deployment

**One job: a site, a window, and the machines that stood there.** It is the unit a
mobile fleet is managed and costed in, and it is what a genset's runs, fuel and
alarms are attributable to.

A yard that needs three sets for five weeks is **one deployment**, and the three
machines on it are `DeploymentMembership` records with no dates of their own. That is
the whole shape, and it is a deliberate departure from the production model: Helios
`DeploymentSession` is one posting per machine with its own window, which records the
paperwork correctly and loses the job. Tristan's call, 2026-09-21.

In practice **a job is one set, and two about one time in seven** — never three
(2026-09-29). The fixtures follow that: six of the thirty-one occupied yards in
`utility.ts` hold a pair, and `seed.ts` deals past and planned jobs one set at a time
with a 15% chance of a second (`PAIR_SHARE`).

`BRF9540`'s eight measured postings (`realJobs.ts`) go in first, and only on the
estate that has the machine (2026-10-05). The carrier estate has no `BRF9540`, and
until then listed its eight jobs anyway, at yards that estate does not have.

The cost of it is worth stating, because it is the thing to revisit first: **a fourth
set arriving in week three cannot join an existing job.** It needs a successor job,
which splits one hire into two records. If that turns out to be how Express Mission
actually work, the two dates move onto the membership and nothing else changes.

A membership carries the tank level at each of its own edges, and a `collectedAt` for the one case that needs a date: a set
pulled out early while the job runs on. The live level during an open posting is
*derived* from telemetry rather than stored.

**There is no separate lorry plate** (since 2026-09-29). A set is bolted to its
lorry, so the genset's number plate is the lorry's plate, and one plate is shown.
Until then each membership was dealt its own random lorry plate (a Sabah plate even
on peninsular jobs), and for one commit each genset had a fixed second plate; both
went as the same fact stated twice.

#### Three states, and none of them is stored

`planned`, `active` and `completed` are readings of the window against the clock.

- **planned** — the start is in the future. A commitment, and **it moves nothing**:
  the machines are booked and are still standing wherever they are. This is the state
  the earlier model could not hold at all, and holding it is what lets the app answer
  *what is booked* rather than only *what happened*.
- **active** — started, not closed. It may carry an *agreed* end in the future; every
  figure is still measured to **now**, because a five-week hire in its first week has
  produced one week's energy.
- **completed** — closed. The record.

A stored state would be a second answer to a question the window already answers, and
the two drift the moment a demo sits overnight. Derived, a planned job becomes active
because the clock moved — which is also the cheapest way to demo the transition: set
a start two minutes out and navigate.

#### A genset's site is derived from its active membership

This is the direction the model runs in, and it used to run the other way: `siteId`
was a field on the machine with an override store over it, and deployments were
history somebody else had written. **A machine is at a yard because a job put it
there**, so `fleet()` reads the site off the record and holds nothing of its own.

A site is a **yard**, not a folder — `fleet.ts` puts co-sited units within a hundred
metres of each other because that is what sharing a site means. So a job going active
is a lorry: its machines take the yard's placename and a spot in it, and their pins
move on the fleet map. Membership you could set freely without moving anything would
let a Penang set belong to a Petaling Jaya site, and every figure that made a site *a
place* would then be describing two places at once.

**Collecting moves nothing.** The set leaves the job and reports no site, and it is
still standing in that yard until somebody comes for it — so `siteId` is derived and
the coordinates are **last known**, the yard of the most recent job the machine
actually stood on. Inventing a depot coordinate would be a claim about the physical
world the app has not earned.

Two words are in use for a machine with no active job and it is worth knowing before
writing a third. The deployment layer and the site's own pages call it the **depot**;
the fleet cards and their role filter call it **`Workshop`**. They are the same
absence of a job.

**One machine may not be on two jobs whose windows overlap.** It is checked on every
write and the refusal names the job in the way, because "already out" is not an
answer a reader can act on and "on DEP-0117 at Kapit until the 14th" is. Deriving the
active one by picking a winner from overlapping records would make the invariant a
rendering convention, and two screens that picked differently would then disagree
about where a machine is.

Every figure a site reports is summed from its members, so all of them move when this
does — capacity, fuel, condition, the diagram's source count, the duty default, and
the site's rank in the list. That rebuild is cheap for one specific reason:
**`detail.ts` and `history.ts` never look at where a machine is.** They key off genset
id, so relocating a set cannot invalidate a single reading or run. The one module that
did look was `history.ts` itself, through `gensetById`; it reads the *seeded* row now,
because a fuel ladder that asked where its machine was standing made the derivation a
circle.

#### What the window makes possible

A run answers "when did the engine turn"; a job answers "where was the fleet posted,
and what did the posting cost". A fortnight at a substation may contain thirty runs,
and the questions asked of it — litres in, litres burned, hours on load — are asked of
the fortnight.

So the [runs](#the-runs-section) and [analysis](#the-analysis-section) sections can
offer a window named by **one posting**, exact where a calendar is day-granular, and
the totals under it reconcile with the record rather than approximately agreeing with
it. And the job's own page can state energy produced against fuel burned over the
window, which is *efficiency by deployment* — the figure the product's own notes name
as the one operators want, and the one the screen inventory recorded as unobtainable
while a genset carried a single `siteId` with no time dimension.

→ `src/modules/deployment/types/deployment.type.ts`,
`src/modules/deployment/data/{seed,store}.ts`,
`src/modules/genset/data/deployment.ts`

### Mains supply

The incomer at a grid-backed site: whether the supply is **live**, and what is flowing
through it.

A **measurement, not an inference** — and that distinction is the whole reason this
concept exists rather than being folded into the run states. An earlier version
derived mains health from the gensets ("a set is running, so the grid must be down"),
which is wrong for the case that matters most: a set out on a **test exercise** runs
beside a perfectly healthy grid, and inferring a failure from it reports an outage at
a site that never had one.

Whether the supply is **live** and **how much is flowing** are two separate fields, and
the split is load-bearing. `live` comes from the transfer switch, which senses voltage
on the incomer because that is how it decides to transfer at all, and it is known
whatever the incomer is carrying. The figure is `0` while the supply is down — a fact
about the copper, not a gap — and folding the two together would make a dead incomer
indistinguishable from an unknown one.

What the incomer reads when the grid is carrying is the **site's own load**, seeded in
`siteSeed.ts`. That is a fact about the customer, not about the plant: a hospital
draws what a hospital draws. It was briefly scaled off installed genset capacity,
which was a convenience that quietly made consumption a function of the machinery —
and being able to detach a set made it plainly wrong, since stripping a yard would
have made the customer appear to stop using electricity. It also let one load carry
two numbers: `mfg-015` read 152 kW while its own genset reported carrying 175 kW.

A consumption pattern over time, rather than one instantaneous figure, is the next step
and needs nothing above `SiteSummary` to change.

So a genset carrying the load and a failed grid are two facts, not one, and the page
states both. That is what separates these:

| Incomer | Duty set | The page says |
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
moving the load to it would be a deliberate operation.

It follows that **a site's draw is the duty set's output, not the sum of its running
sets'**. A set that happens to be turning while isolated is off-load and contributes
nothing to what the customer is pulling; adding it in would report a figure no
instrument at the site could ever read. Every isolator in the diagram, and every `off-load` badge
in the device rows, is a function of which set is duty.

**It is reported, not chosen.** `defaultDutyId` is the set carrying the load, or the
one that would if the grid dropped now, and no screen offers to change it. There was a
changeover control on the site page and it has been taken out: transferring a site's
load is an *operation*, and operations belong on the machine's own page beside the
interlocks that make them safe. The interlocks it enforced are worth recording, because
they are what any future control has to keep — the load can only be handed to a set that
is **already turning**, since a stopped set has to be *started* first (a `START`
command, and those are inert here) and an unreachable set cannot be commanded at all.

What a site can say that no genset can is **which of its sets is on the bus**, and the
site-level verdicts stop there and at rankings. A site reports its duty set, its summed
figures (capacity, fuel), the count of what is standing anywhere on it and its worst
[bucket](#fleet-status) — none of which is a new vocabulary. There is no site run state
and no invented status beside them: no `Covered` / `Standby` / `Exposed`. The states
themselves stay on the machines that have them, one row each.

**A site used to carry a condition verdict of its own — `Critical` / `Attention` /
`Optimum`, ranked worst-among-its-sets — and it was removed on 2026-09-14.** Two things
were wrong with it. It compressed a list nobody was shown, so `Attention` sent a reader
into the site to find out what; and it ranked the **gensets only**, while a site is
watched by its monitoring unit, its cabinet, its bank and its array — so a yard with
eleven standing rows and no genset among them read `Optimum` in the list while its own
Alarms tab listed all eleven. The alarm counts took its place everywhere it appeared: see
[the registers](#the-registers-list-map-and-split).

→ `src/modules/site/types/site.type.ts`, `src/modules/site/data/estateSummary.ts`

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
is why the analysis section can offer a picker that never produces a meaningless plot.

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

### Alarm handling

What an operator has **done about** an alarm, held apart from what the alarm is.

**Two axes, not one status.** Acknowledgement and clearance answer different
questions and neither implies the other. *Acknowledged* says a person has seen it
and taken it on; the bit may still be set. *Cleared* says the condition is finished
with; nobody need ever have looked. A set can trip, recover and be cleared by its
own controller with no human involved, and a technician can acknowledge a coolant
alarm at 2am and still be driving to it at four.

Every platform worth copying models it this way — one tracks `Unacked → Acked`
beside active → cleared, another writes the product of the two out longhand as
`Open`, `Open muted`, `Closed`, `Closed muted`. Collapsing them into a single enum
is the mistake that loses the distinction, so the two live as two nullable stamps
and the one word a reader sees is derived from them rather than stored beside them.

**Stamps and names, not booleans.** `acknowledged: true` cannot answer *since when*
or *by whom*, which are the two questions asked of an acknowledgement the moment
there is more than one name on the rota — and the second is the whole reason to
record one at all. The stamp costs nothing and the boolean is one `!== null` away.

Handling is the app's record, not the panel's, and it lives in `localStorage` for
the same reason every other choice does. It is also **live**: clearing an alarm drops
it from the standing table, from the genset home page's counts, and from the fleet
buckets, without a reload.

→ `src/modules/genset/types/alarmState.type.ts`, `src/modules/genset/data/alarms.ts`

### Tag

The operator's own filing system: a named list of reading keys.

Tags are **not** the controller's taxonomy. Two crews running identical hardware
group it differently depending on what they get called out for, so a tag is a
list and nothing more. A reading can sit under several — starter battery voltage
matters to both `Battery & charging` and `Starting` — which is the point of tags
being lists rather than a partition.

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

`Fuel` carries no alarms **from this map** and stays at zero in the table above. A
tag answers "how is this subsystem doing", and three healthy readings with nothing
wrong is a complete answer. The controller *has* `AL Fuel Level Wrn` and
`AL Fuel Level Sd`, and neither is marked for the dashboard, so neither may appear
in `ALERT_RULES` — that rule is what makes the list checkable against the sheet.

The tag is not empty on screen, though. Two alarms reach it, and both are the app's
own arithmetic rather than the panel's: the fuel **reconciliation** below, and the
**tank level** below that.

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

### Tank level

**A number, and one line drawn on it.** The panel sends a level; the app compares it
with the tank's capacity and files the result. One threshold, a fraction of capacity:

| Line | Fraction | What it means |
| --- | --- | --- |
| Reserve | `0.30` | Below it, a tanker has to be **booked** — a job with a lead time |

**There were two until 2026-09-22.** An `Empty` line at `0.10` sat under the reserve
line, with its own `CRITICAL`, its own `Tank empty` bucket and its own red on the tank
bars. It is gone because the estate does not reach it: a set is refuelled off the
reserve line and the tank never gets a third of the way down from there. It was
modelling a state this fleet does not have, and an exhaustive bucket that can never be
occupied is a tile reading `0` for the life of the product. A tank is fuelled or it is
low, and low is a tanker booking.

**The line is read three ways, and is written once.** It is the fleet's `REFUEL`
bucket in the Gensets strip, it is the reserve line the refuel runway counts down to on
the genset's own page, and it is the alarm in the alerts section. One number, so a tank
cannot be low on the strip and fine on its own page.

**It is an alarm, not just a bucket.** Fuel level used to be the one
threshold-crossing reading in the app that raised nothing: a set at 8% of capacity
showed a green `Optimum` beside a dry tank, because the register map has no bit
marked for the dashboard that watches the level and the app had never drawn the line
itself. It draws it now. `Low fuel` is a `WARNING`, and it moves the condition verdict.

**The tank cannot raise a `CRITICAL` at all**, which is the right shape rather than a
gap. Every critical in this app is a register-map protection that has stopped the
engine — a running set carrying one is a contradiction. A low tank stops nothing: it is
a statement about cover, and the fleet refuels well before cover is actually at risk.
The `CRITICAL` here belonged to the `Tank empty` tier and went with it.

**Like the leak, it must never become a register bit.** Its row prints `Tank level`
where a controller row prints its register and bit, so a reader can still tell the
panel talking from the app talking — `588L (24%) · < 30% of 2,450 L · Tank level`. The
litres are on the row because "Low fuel" is an adjective until the level is in the box
with it.

**It is a standing row, counted like any other.** Until 2026-09-28 it reached only the
condition verdict: the Alarm column, a set's own Alarms tab and its home-page counts are
all counted off the standing queue, and the queue held the controller's bits and the
monitoring unit's rows and nothing the app raised itself — so a set at 7% read `– – –`
in the register and "Nothing standing" on its own tab. It is in that queue now, and so
in every count read off it, including a job's Alarms tab. Its raised time is the last
moment the tank chart's level crossed the line.

**It ends when the tank is refilled, and nobody can clear it.** It stands exactly while
the level is under the line, so a Clear would be a person declaring a tank fine while
it is not; the row says `Clears when refuelled` where the button would be. It can be
**acknowledged** — "seen, a tanker is booked" is the useful statement — through the same
handling store as every other row.

**The fleet buckets read a tank-blind verdict, and that is the one place they must.**
`gensetStatus` asks `machineCondition` — the register map, the site monitoring unit's
rows filed against the set (since 2026-10-05, as its alarm count has them), and the
leak, and nothing about the tank — because it already tests the tank itself, in `REFUEL`. Asking the wide
`gensetCondition` there would say the same fact twice: every `REFUEL` set would test
true for `ALARM`, `ALARM` outranks `REFUEL`, and the fuel bucket those tiles exist to
show would drain into the red one entirely.

**The line is fixed, and not editable.** The rule the app works to: a setpoint that
lives in the panel is not editable from a screen that cannot issue the command. This
one is the app's own, so it *could* be — but it is also what the
[three buckets](#fleet-status) are defined as, and a per-genset reserve line would
leave the strip's counts working to a different definition on every row. If it ever
moves, it moves for the estate.

→ `src/modules/genset/types/fuelLevel.type.ts`

### Fleet status

The one-word answer to **"does anybody need to go out to this"** — a fourth
vocabulary beside run state, condition and fuel integrity, and it exists because
none of those three answers this question.

Run state says what the engine is doing; a set can be idle and perfectly healthy.
`GensetCondition` ranks the *alarms* — how bad is the worst thing this machine
reports — which is not the same as what van to send. `FuelIntegrityState` is about
diesel that went missing, which is a different problem from diesel that was
legitimately burned. An operator planning a day's callouts is asking across all
three at once, and this is that question written down.

**Worst wins, and the three are exhaustive.** Every genset is in exactly one bucket,
so a set of counts adds up to the fleet. Overlapping buckets would give three true
numbers that sum to more than the estate, and an operator reading them as a workload
would double-count the drive.

The order is **send an engineer before a tanker**:

| | |
| --- | --- |
| `ALARM` | the machine has a fault — the thing that can take it off cover today |
| `REFUEL` | below the reserve line — a tanker to book, not to scramble |
| `OK` | what is left |

**There was a fourth, `EMPTY`, until 2026-09-22.** `Tank empty` led the list, because a
dry tank gives no cover at all. It went with the fuel tier that defined it — see
[Tank level](#tank-level) — and nothing is lost by it: a machine
genuinely off cover is still counted, as an `ALARM`, by the fault that took it off.

`ALARM` outranking `REFUEL` matters more than it looks: a set below reserve *and*
carrying a shutdown alarm is not a refuel job, and filing it as one would send a
tanker to a machine that needs an engineer.

**Colour does not follow that ranking, and the departure is deliberate.** Hue says
what kind of job it is: violet is diesel — the colour every fuel figure in the app
already carries — so the fuel bucket takes it; red is the machine, the same token the
alarm badges use; green is nothing to do. A bucket ranking is about which single file a
set lands in; a colour is read as a category first.

Service is counted **across** the three rather than as a fourth bucket, because it is
measured off a machine's own hour meter and its own interval — a set can be `OK`
above and still be due. It is the one figure on the estate screen that a genset can
be counted in twice, which is why it sits in its own card rather than beside the three.

→ `src/modules/genset/data/fleetStatus.ts`

### Service

A genset is serviced on the same logic as a car: whichever comes first between a
number of run hours and a number of months. **Both counters run at once and neither
is converted into the other.**

That is worth stating plainly because the tempting alternative is wrong in a way
that is hard to see afterwards. The alternative is to project the hours onto a
calendar — take the unit's recent duty rate, divide the hours remaining by it, and
compare two dates. It reads well and it lies. The duty rate of a standby set is
noise: one long outage triples it, a quiet fortnight halves it, and neither says
anything about the machine's condition. Worse, an idle set divides by something very
near zero. Two counters that are each honest in their own units beat one number that
is a forecast wearing a fact's clothes.

A schedule is **both intervals, always**. Either alone is a different and worse
policy: hours only lets a set that never runs go unserviced forever, months only
lets a set worked around the clock run three intervals' worth of hours between
visits.

A service record is the technician's filled-in checklist, and its document link is
**nullable on purpose** rather than defensively. A seeded record points at a bundled
file and always resolves; a file attached in this session is an object URL that dies
with the tab. After a reload the record is still there and the file is not, so the
row shows the filename with the link inert — which is the honest rendering of a
prototype with nowhere to put an upload.

**An overdue service does not move the condition verdict.** It is a chore nobody has
done yet, not a live fault. See [Fuel reconciliation](#fuel-reconciliation) for the
other half of that asymmetry.

→ `src/modules/genset/types/service.type.ts`, `src/modules/genset/data/services.ts`

### Control mode

`AUTO` or `MANUAL`, and they are exclusive.

In `AUTO` the controller owns the decision: it starts on a mains failure and
stops when mains returns. A person reaching for START would be fighting it. So
**START and STOP only mean anything in `MANUAL`**, and within `MANUAL` only the
one that would change something is enabled — you cannot start a running set.

---

## The screens

Five destinations in the app rail, and Settings pinned to the foot. **Gensets** leads
and is the app's landing screen — the plant register, which on a fleet whose machines
move is the thing every question starts from. **Deployments** follows it: what is
out, where, and since when. Then **Fuel**, **Service** and **Reporting**.

**Sites** was a destination too, and on a mobile estate it was dropped: a yard there
is where a machine was sent, not a thing anyone opens the app to ask about, and
`/deployments` answers that question properly. The site pages were removed on
2026-09-22. The rail's own doc comment (`Sidebar.tsx`) argues the order.

```
/                    → /gensets

/gensets?view=split ─┐
/gensets?view=list ──┼─ the plate ─→ /gensets/<id>                      Genset
/gensets?view=map  ──┘  or panel →   ├── /analysis
                                     ├── /runs          (labelled Deployments)
                                     ├── /service
                                     ├── /alarms
                                     ├── /equipment     placeholder
                                     └── /settings      placeholder

/deployments?view=split ─┐
/deployments?view=list ──┼─ the reference ─→ /deployments/<id>   Deployment
/deployments?view=map  ──┤   or panel →                           ├── /gensets
/deployments?view=gantt ─┘                                        ├── /runs
                                                                  ├── /alarms
                                                                  └── /settings
/deployment          → /deployments

/fuel                                Depots (depot tanks)
/fuel?view=deliveries                Genset fills
/fuel?view=trucks[&truck=<id>]       Trucks and map     (estates with trucks)
/fuel?view=truck-log                 Truck log          (estates with trucks)
/fuel/depots/<id>                    one depot's own page

/service?tab=due|history             the fleet's service standing, and every visit
/reporting                           three CSV exports
/settings                            which brand this build is (where it carries several)
/gallery                             the component bench, dev only
```

Sections in the rails that are **not drawn** carry a labelled placeholder saying
what they will hold rather than a dead link: a genset's `Equipment` and `Settings`.
A destination that states its subject is how the shape of a screen gets agreed
before a table is drawn for it.

### Where the overview went

There used to be a `/overview` in the first slot of the rail, and later an estate
register with a card strip that absorbed it. Both are gone. One rule of the
overview's is worth keeping wherever its figures live: **every number is a link into
the screen that shows its working**, including the empty ones. Clicking a `0` and
landing on an empty list is a complete answer, where a dead tile makes the reader
wonder whether it is broken.

### The registers: list, map and split

`/gensets` and `/deployments` are the same screen over different objects (and
`/sites`, `/solar` and `/battery` were too). Each is a **register**: a row per thing,
a search box, and nothing that grows unboundedly with the estate.

**`split` is the default, and the other two views are exceptions to it.** The screen
used to be one or the other, and reading it meant switching: find the row, switch to
the map, lose the row. Side by side, the list is the index and the map is where the
answer is — scrolling one moves the other. The two full-width views survive because
each is still the right shape for a question: `list` when the columns matter and the
geography doesn't, `map` when a cluster is the whole point. Dropping them would have
made the split a cage.

**The row selects, the name navigates.** Clicking a row or a pin *selects* into the
preview panel — a preview, not a commitment. Getting in is a separate, deliberate
act: click the name, or the `→` in the panel header. Over the map the panel's arrow
is the only way in, because a pin has nowhere to put a link and clicking one has to
leave you on the map or the selection is useless.

**The fleet's preview panel carries the machine's alarms.** Under `Status`, as the
register's `Alarm` column sits beside its `Status`: the same pill, linking to the set's
Alarms tab, and under it each standing alarm by name with its source line, in the tab's
own order — unclaimed first, then worst. It names four and counts the rest into a link,
so a machine with nine monitoring-unit rows does not turn a preview into the tab it is
previewing. The panel, the column and the tab all read `gensetAlarmRows`, the one
definition of a set's queue, so none of them can name an alarm the others do not have.

**Every map has a locate button** (2026-10-01), above the zoom on the Gensets and
Deployments maps and below it on the pin maps (`src/lib/locateControl.ts`). The
browser asks for the location only when it is clicked. It flies to the person and
draws a live blue dot that follows them, keeping the map on them until they pan away;
a second click stops it. On a pin map, following the person moves the pin with them,
and an ended deployment's locked map has no button.

**The map draws state borders** at every zoom — neutral, never the brand colour, and
weighted to stay findable at both ends: a hairline over empty sea, heavier with a pale
casing under it once the basemap fills up with roads and buildings, and drawn over
those roads and buildings rather than under them (2026-10-01). They are drawn
from the app's own shapes — the same ones the hover washes in — and the basemap's own
state boundary is switched off, for reasons given further down. They are furniture —
the same job the basemap's own coastline does — and they are there so the hover and
the click below have something to aim at.

**Hovering a state isolates it.** Put the cursor anywhere inside one and that state
washes in under the fleet, its name and count are drawn **once**, at the centre of all
the land that state is made of, and every pin and cluster bubble standing anywhere
else fades back. The label is a card filled with the brand colour — the name large, the
count smaller under it — because it is the answer to the gesture and has to outrank
every road and place name the basemap draws. It is pinned to that point: zoom into a
corner of Sarawak and it is off-screen, because it belongs to a place rather than to
the viewport.

**The wash fits the border exactly, because they are the same shapes.** The border
itself does not change under the cursor — it is furniture, drawn at one weight
whatever is hovered, and the wash is what says which state you are asking about.

It answers the question the pins make you count for: *how much of this is in Sarawak*.
The fleet register's State dropdown narrows the list to one state; the hover asks the
other half of the question, how that state compares with the rest. This is not a filter — the dimmed fleet stays
visible, because the question is how one state compares with the rest and hiding the
rest would answer a different one.

**The gensets and deployments maps open on the whole peninsula.** With no filter or search on, it
frames Perlis to Johor rather than the fleet's own pins, which cut the north off. It
holds that frame until the list is scrolled or a filter changes, then follows the list.

**Clicking a state frames it.** The hover says how much is here; the click says show
me. Click the basemap anywhere inside a state and the map fits the whole of that state
into view — islands included, centred, with the same padding the fleet is framed with.
On the gensets and deployments registers the click also sets the toolbar's `State` filter to that
state, so the list and the map narrow to the sets standing there; `All states` in the
dropdown, or Back, undoes it. A state with no set in it filters too, to an empty
list, and the dropdown lists it at 0 for as long as it is picked. The map then holds
the state's frame rather than re-fitting to the state's pins, until the list is scrolled
or another filter changes. The sites map frames and does nothing
else. A click on a pin or a bubble is still a click
on a pin or a bubble; the state only answers when nothing on the fleet was hit. The
frame is measured on the fine copy of the shapes rather than the coarse one — the
coarse copy has shed Terengganu's islands, and a frame that left Redang off the edge
of the screen would be a frame of the wrong shape.

**The count follows the toolbar.** Hovering Sarawak with the list filtered to
`Offline` says how many *offline* sets are in Sarawak, not how many sets. The count
is of what is drawn, which is what the rest of the screen means by a number. It is
the one place this parts company with the summary cards above the table, which hold
still on purpose — those are a picture of the whole fleet, and this is a reading of
the map you are looking at.

**A state with nothing in it still answers.** Hovering Perlis highlights Perlis and
says `0 gensets`. An area that went inert would make the reader test whether the
control was working; `0` is a fact about the estate and one worth being able to find.

A cluster bubble is judged by what is inside it rather than by where it sits: it stays
lit if *any* of the sets it swallowed stand in the hovered state. At the zoom the map
opens at, the Klang Valley is one bubble over four states — judging it by its own
position would be cheaper and wrong every time.

**The borders and the wash are one set of shapes, and the basemap's own are switched
off.** That is the opposite of the obvious answer and worth saying why.

Drawing the basemap's boundary layer is *exact* — it is the geometry the reader can
see. What it cannot do is have anything drawn inside it: those tiles carry only
`admin_level` and `maritime`, with no per-state identity, so a single state cannot be
selected out of them. The wash therefore has to come from our polygons, and our
polygons disagree with the basemap's boundary by 130 m on average and 850 m at worst
— two OpenStreetMap snapshots cut at different times, which no amount of detail
closes. The shading spilled across the line.

So one set of shapes does both, and the basemap's own state and country lines are
hidden.

**The coast is the basemap's own.** Our shapes were OSM in 2017 and the basemap is OSM
today, so a coast drawn from ours cut across Penang's reclaimed land and ran off the
Johor shore. The shapes are now today's OSM too (below), but the coast stays the
basemap's, drawn at whatever detail the zoom calls for. The coast is traced instead off the sea in the tiles on screen, at
whatever zoom is showing, and only Malaysia's shore is kept: Singapore's bank of the
Johor Strait and the neighbours' islands stay unlined. The borders between states and
the land borders still come from our shapes. Where one reaches the coast it runs on
out to sea under the basemap's ocean, which trims it at the shore. The hover wash
does the same: it is painted under the basemap's water and reaches a little past the
shapes' coast, so no land the basemap draws goes unwashed.

**Every edge is the same line** — a coast, an island, a border with Thailand, Brunei or
Indonesia, and a border between two states. The coast used to be fainter, because a
shared edge belongs to two states' outlines and was stroked twice while a coast belongs
to one. The line is solid now, so stroking it twice changes nothing, and it carries the
weight the internal borders always had. Hiding the basemap's country lines takes every
country border in its tiles with them, so borders between two other countries are not
drawn; every border of Malaysia is.

Those shapes are OpenStreetMap as it stood on 2026-10-01 (until then, geoBoundaries'
2017 extract of it): OSM's own state relations, cut to OSM's land polygons where a
state's relation runs out to sea. They lie on the basemap's own state line, checked by
drawing that line over ours at KL, the Bernam, Gemas, Seberang Perai and the
Sabah–Sarawak border, and audited end to end: every border between two states and
every land border has a line, no line runs over land with no border under it, every
Malaysian shore is lined, and no other country's is. Islands no state relation
reaches, such as Pulau Aur and Layang-Layang, go to the nearest state. They live in the repo rather than being fetched,
for the reason the basemap is CARTO's: this thing has to come up on a fresh clone with
nothing configured. A 22 m copy served out of `public/` for the wash, with the borders
and the neighbours' outlines cut from the same build beside it, and a 440 m one in the
bundle for the arithmetic, because simplification shows when you draw a shape and does
not when you only ask which side of it something is on.

One site still needs slack: a coastline is a generalisation, and a tower on reclaimed
land can fall the wrong side of it, so a site within about five kilometres of a coast
counts as standing in the state it is obviously standing in. Under Natural Earth
fifteen sites needed that; under OSM it is one. See `src/lib/geo/malaysiaStates.ts`.

**Selecting opens the panel**, whatever the toolbar's toggle was set to. Selection
has no other visible effect — it tints a row, it recolours a pin — so with the panel
closed a click is a dead end that reads as a broken control. The toggle therefore
means "hide the preview until I next ask for one", and it never sits between the
row-click and the preview it is supposed to produce.

**The summary is two cards**, in the shape of the telcoIQ Sites strip: `Status`
(running, idle and offline as `?run=` toggles, with `Showing N of 38` under
them while a filter is on) and `Alarm` (the Alarm dropdown's four options, Critical to No alarms, as
`?alarm=` toggles). A third, `Due for service` (a toggle for `?service=due`), came off
on 2026-09-29; the filter still works from a link. The first two were `Gensets` and `Status` until 2026-09-29, and took the
names of the table columns they count. A fourth card stood here: `Fuel on hand`, replaced on 2026-09-29 by `Today` (run hours and litres since
midnight, and how many running sets started on an outage or a test), which came off the
same day on request. It was one line from 2026-09-21 to save height above the register;
it went back to cards on 2026-09-28 on request. Both count the whole fleet.

**The table shows 20 rows a page** (2026-09-30), with `21–38 of 38` and numbered
pages under it. The page is `?page=` in the URL, absent on page 1. A filter, search
or sort change goes back to page 1, and a pin picked on the map turns the table to
that set's page. The map and the phone-width cards still show the whole filtered
list. The pager is hidden when everything fits on one page. The `/service` page's Due
and History tables page the same way, sharing one `?page=`; switching tab goes back
to page 1.

The pager (`TablePager`, shared by all three) shows the row count on the left and,
centred, first, previous, three page slots, next and last. The current page is always
the middle slot and is a field: type a page and press Enter to jump there.

**The cards above the table are counts that double as filters.** Showing a number an
operator cannot act on is half a control, so each count is a toggle: click
`Critical` and the list and the map both narrow. The counts themselves do not move when
you do, so the strip stays a picture of the whole fleet while the list answers a
narrower question. Nothing there invents colour — a count carrying a verdict gets
the same token the badge two rows down uses.

The filters are the questions each register gets asked. The fleet's: where the set is,
what needs doing to it, and whether it is due for service. Its toolbar adds one dropdown per column a reader
scans for trouble — **Status** (`?run=`, the run state), **Alarm** (`?alarm=`, the set's
worst standing severity or `No alarms`) and **Fuel level** (`?fuel=`, below the reserve
line or not). Each files a set in exactly one option. **A dropdown's counts follow the
other filters**: each counts over the sets that every *other* filter leaves, so with
Johor picked `Status`, `Alarm` and `Fuel level` count Johor's sets, and with `Running`
picked `State` counts the running sets per state. A dropdown leaves itself out of its
own count, so its options still show what switching to each would give; an option's
count is exactly the rows picking it will show. Options never drop out — a zero stays,
greyed. The summary strip does not follow them (see above). The alarm filter reads the
same pass the `Alarm` column draws, and the fuel filter the line the red figure and the
`Low fuel` alarm use. They combine with each other, with the chips and with search.

**The fleet's first filter is the Malaysian state, by position** (`?location=selangor`)
— the State column's answer, listing only the states a set stands in. It was the
dataset's own filing list until 2026-09-28: `Wilayah Persekutuan` for Kuala Lumpur and
Putrajaya together on one estate, network regions on the other, and a `Workshop`
option for sets filed nowhere. A set in the workshop is still standing in a state, so
it is counted there, and the filter can no longer disagree with the column beside it.
The deployments register's State filter reads the yard's position the same way.

**The fleet had a `Duty` filter — what it feeds — and it was taken out on 2026-09-28.**
Duty is the yard's power role, read off whichever site a set is standing on this week,
so on a fleet whose plant moves it describes the posting rather than the machine: the
same set changes duty every time a lorry moves it. How a yard is fed is a question
about the site.

The whole view state lives in the URL, so any state is linkable and Back steps
through it:

```
/gensets?view=map&q=selangor&id=brf9540&panel=true
/gensets?status=REFUEL&view=list
```

**A genset is named by its number plate** — `Genset | WVA 5385` on its own page, the
plate alone on the register (`gensetName`, `gensetLabel`). It was named by the site it
stood at until the fleet became a mobile one; two sets at one yard then read alike,
and a set's plate is what identifies it.

**The fleet list drops two columns beside the map.** `Location` and `Last updated`
are drawn on the full-width list and dropped on the split view, where both truncated
to the half that carries no meaning — `Bangsar S…`, `1 hour …`.

**`State` stays on both.** It sits beside the plate — which machine, and where — and it
is short enough to survive the narrow column where `Location` is not. It is read off
the set's coordinates through the same point-in-polygon the map's hover counts with, so
the column and the number on the hover card cannot disagree; the placename cannot
answer it, because half of them name a town (`Sepanggar, Kota Kinabalu`). The header
sorts A to Z as `sort=location` — `sort=state` was already the run state's key — and a
set in no state goes to the foot in both directions.

**The column and the toolbar's `State` dropdown agree**, since the dropdown was rebuilt
off the same geography (it used to be the dataset's seeded roster). ⚠️ One row still
contradicts itself: `H 4141` is labelled `Kepong, Kuala Lumpur` and addressed `52100
Kuala Lumpur`, but its seeded coordinates fall just over the line in Selangor, so the
column says Selangor. Which half is right is a data question, not a rendering one.

**What is filtering the list is spelled out under the toolbar**, and only while
something is: `Filtered by:`, a removable chip per filter, then `Clear all`. It names
every narrowing — the search text, the four dropdowns, the summary strip's chip and a
`Service due` link — because a row that named some of them would leave a short list
unexplained, and `Clear all` would clear only part of it. The chips use each control's
own words, so a chip and the control that set it read the same.

**Capacity is a fifth dropdown** (2026-09-29): one option per kVA rating the fleet
has, read off the model name (`modelKva`, which the detail model's kW rating uses
too), faceted like the rest, and a chip reading `1,000 kVA`. The table carries a
sortable `Capacity` column in both views. To fit it beside the map the split went
from roughly 45/55 to 60/40 in the list's favour, with the map floored at 440px so
the preview panel still floats over a strip of basemap. With the column gone it went
to 50/50 on 2026-09-30.

**The deployments register copies these controls** (2026-09-29): plate search with
spaces ignored, plus the job reference (`DEP-0076`); `State` and `Status` dropdowns,
faceted the same way; the same chip row; and three cards in the gensets shape —
`Status` (the three states, each a toggle), `Deployments` and `Gensets out` (with what
is committed and a link to the depot count). A fourth, `Diesel burned` with the typical
closed job, came off on 2026-09-29. The old `Customer` dropdown and `?customer=` went. A job's state is its yard's,
read off the site's coordinates with `stateNameAt`, and travels as `?location=` so one
state reads the same on both pages. Its machines are shown by plate, falling back to the
tag. The table uses the gensets table's equal gaps. The full-width list keeps all seven
columns (State added beside the reference); beside the map it keeps four —
`Deployment`, `State`, `Status`, `Gensets` — and drops `Dates`, `Run hours` and `Fuel
burned` (2026-09-29), which the preview panel carries.

**Every set has a street address**, mock but plausible: a real town and postcode, an
invented lot number (`Lot 31, Jalan Kuala Kangsar, 30010 Ipoh, Perak`). It belongs to
the **site** — `address` on each site seed — so sets at one yard share it, and a set put
on a job elsewhere takes the new yard's. The workshop row carries its own. The town
(`locationLabel`) stays the short answer and the address sits under it: the `Location`
column shows the full address on one line (capped, the rest in a tooltip), the preview
panel and the genset page's header show town then address, and hovering a pin on the map
shows a card with the plate and the address.

**The estate list is worst standing alarm first, then by name.** Its second column is
the **alarm pill** — `Critical · Warning · Neutral`, the same three figures every metric
strip and device card in the app draws — and the ranking is that pill: worst severity
first, then how many rows are standing at it. Severity outranks volume, because one
shutdown alarm is a van today and nine notices are a morning's reading. Name breaks the
tie so the order is total and the list doesn't reshuffle between renders.

The column is a **link**, so a row is one click from the queue itself rather than one
click from a page that has the queue on another tab. Every row draws a pill, a quiet
site included — a column is read down, and a hole in it reads as missing data rather
than as nothing standing. **A severity with nothing standing draws a dash rather than a
`0`**, so a quiet row reads `– – –` and the only figures on the screen are counts that
exist; a zero is a number a reader has to parse before learning it says nothing. The
phone cards take the opposite rule, because they are a badge row: there the pill appears
only when something is standing, since an empty alarm chip between `1 · 0 running` and a
fuel level is an alarm-shaped element on a healthy yard.

The counts come from `useEstateAlarmCounts`, one pass over the estate off the same union
`useSiteAlarmQueue` gives a single site — so a row's pill, the site's own strip and its
Alarms tab are three renderings of one queue, and clearing a row on the tab re-ranks the
list on the way back. Site draw is deliberately not a column — it is instantaneous and
changes while you read the list, which makes it a detail-page figure.

**The estate map is one pin per yard**, coloured by the site's own [status
bucket](#fleet-status) and
sized by how many sets stand there, because "one set or three" is the difference
between a site that loses its supply when a machine faults and one that does not. It
was argued against for a long time on the grounds that a site's position *is* its
gensets' position and the fleet map already draws it. That is true of the
coordinates and wrong about the question: the fleet map answers *where are my
machines*, so a yard with three sets is three pins; this one answers *where are my
sites, and which of them is in trouble*.

### The deployments register

`/deployments` is the third register, and the only one whose rows are **jobs rather
than assets**. A job is one site, one window and the machines that stood there — see
[Deployment](#deployment) for the model — and the screen answers the operations-room
question: *what is out, where, since when, and what is booked next.*

**The table shows 20 jobs a page** (2026-09-30), paged exactly as the gensets table
is: `?page=`, back to page 1 on any filter, search or sort change, and a pin picked
on the map turns to its job's page. The map, the timeline and the phone cards still
show every job the filters leave.

**`New deployment`, above the search at the top left, opens a dialog** (2026-09-30), the only way to
create a deployment on screen. It is one form in four pages since 2026-10-01 (one
column until then), with a step strip at the top — **Details · Customer · Location ·
Team** — and one height for all of them, so the buttons stay put:

- **Details**: Job type first, then Deployment ID, Start date (today by default) beside the optional Planned end
  date, and Gensets.
- **Customer** is who hired the gensets, and their site contacts. An ERQ or PRQ ID
  typed on Details has already filled in TNB here.
- **Location** is the address: a search box over a large map whose pin sits at the
  centre. The map opens over Kuala Lumpur; moving it looks up the address at the pin,
  a picked suggestion moves it, and its locate button puts the pin where the person is
  standing. Whichever is done last sets the address. The map's bottom-left corner reads the
  pin's latitude and longitude live as it moves, and Settings' map does the same. **Create now** books
  it from here; **Next** goes on.
  A site with no street address (a plantation, a quarry, a stretch of highway) is
  placed by typing or pasting its coordinates into the same box (2026-10-01):
  `3.1579, 101.7116`, `3.1579° N, 101.7116° E` or `3°09'28.4"N 101°42'41.8"E`,
  latitude first. The one suggestion is the position, with the town it is near or else
  its state; picked, the coordinates stand in for the address everywhere one is shown.
  Coordinates outside Malaysia's states are refused. Settings' address box takes them
  the same way.
- **Team** is the optional rest: crew and a first note, then
  **Create deployment**.
- **Next works whatever is filled in** (2026-10-01), and any step in the strip can be
  clicked, ahead or back. A page left with something missing gets a red **!** in the
  strip, a finished one a tick. Only the Create buttons wait: they stay off until
  every required field is in, and hovering one lists what is missing, page by page
  ("Details: Add a customer."). **Back** keeps everything entered, and closing with
  anything entered asks before discarding it.
- **Job type and crew** (2026-10-01) appear only on an estate whose dataset has a
  `work` vocabulary (`DeploymentWork` in `src/brands/types.ts`): today the utility
  estate, which Express Mission runs. They follow Express Mission's genset-on report.
  - The Deployment ID is the customer's ERQ or PRQ request number, so it starts
    empty and is required. Two deployments cannot share an ID, on any estate.
  - **Job type** is ERQ, PRQ or Standby, and required. ERQ and PRQ follow the ID:
    typing `ERQ…` picks ERQ, and picking PRQ puts PRQ on the ID's digits. Standby is
    standby cover on an ERQ or PRQ request, so it keeps the ID as it is.
  - **ERQ and PRQ fill in TNB** as the customer, since TNB issues them (`clientId`
    on the job type), and so does Standby on one of their numbers. A customer
    somebody picked is never overwritten, and clearing the ID takes the filled-in one
    back out. TNB is first in the utility estate's
    customer list, written "Tenaga Nasional Berhad (TNB)" so the initials find it.
  - **The register filters by job type** too: a Job type dropdown beside State and
    Status, with faceted counts like theirs, a chip in the "Filtered by" row, and
    `?job=erq|prq|standby` in the URL. An estate without job types has no dropdown.
  - **Crew** is optional: rows of a role (Driver, Worker, Chargeman, Engine driver)
    and a name picked from the estate's roster, or typed and added. Settings edits
    both, and an ERQ/PRQ ID typed there sets the job type too.
  - **Every ID is ERQ or PRQ and seven digits**, no separator (`referenceDigits`),
    e.g. `ERQ0065692`. Typing is cleaned to capitals and digits; there are no IDs of
    our own on this estate.
  - **A checker under the ID box** (2026-10-01) ticks off the three rules as the ID is
    typed — starts with ERQ or PRQ, then seven digits, not used by another
    deployment — and where one fails says exactly what is wrong: "The 5th character is
    the letter O, not the number 0", "It starts with “EQR”. Did you mean ERQ?", "There
    are 8 digits; it needs 7. Remove 1." A rule still waiting on typing shows how far
    along it is ("3 of 7 so far") and turns red once the box is left. Settings shows
    the same checker while a new ID is typed (`referenceChecks` in `DeploymentWork.tsx`).
  - **Seeded IDs** read like request numbers (`ERQ0046728`, `PRQ0304623`), scattered
    because they are TNB's numbers (`seedReference` in
    `deployment/data/particulars.ts`). The carrier estate keeps `DEP-0001`.
  - **At most five seeded jobs are Standby** (`MAX_SEEDED_STANDBY`, 2026-10-01); the
    rest are ERQ or PRQ, since standby cover is the exception. New deployments can be
    Standby freely.
  - Left out on purpose, because they happen after booking: lorry position, the
    refuels and their drivers, and the diesel, hour-meter and kWh readings at on and
    off. Lorry plate and kVA come from the genset picked.
- **Dates** read and type as dd/mm/yyyy in every browser, here and in Settings
  (`src/components/ui/date-input.tsx`). A plain `<input type="date">` draws the
  operating system's format, so it read mm/dd/yyyy in a US-locale browser. The
  calendar button opens the app's own month grid, in the site's colours: Monday
  first, today in the brand colour, the picked day filled, days outside the allowed
  range greyed, and Today and Clear at the foot.
- **Required:** an address, a start date, a customer and at least one genset. Until
  they are there, `Create deployment` is greyed out, and its tooltip lists what is
  missing.
- **The genset list** is searchable and allows several picks. It orders free sets
  nearest the address first. A set already booked over the chosen dates is greyed out
  with the deployment in its way.
- **A start of today opens the deployment as Deployed** and moves its gensets at once.
  A later date books them as Planned.
- **Closing a form with anything typed asks** "Discard this deployment?" first.
- **Create opens the new deployment's own page.** A street address with no site behind
  it books through the nearest site, which gives it a region for the filters.

**A job is shown by its street address, not a site code** (2026-09-29): the preview
panel's `Address` row (the table leaves it out — `State` says where at a glance), the job's header, the Settings picker
and the `Gensets out` card (`at 25 addresses`). The timeline bars are the exception —
too short for a street, they show the town, with the full address on hover. The data
still joins a job to a yard record underneath; only the site's name has gone.

It shipped as a flat feed of postings, one row per machine, and was rebuilt to the
registers' shape on 2026-09-21: a summary strip, a preview panel, view state in the
URL, and the list/map/split switcher. It changed again the same day, and the second
change was the model rather than the furniture: **a row is a job now**, because a yard
that needs three sets for five weeks is one hire and three rows with identical dates
is that hire with its identity taken away.

**Four views, not three.** The first three do here what they do on the estate — the
table with its headers as the ordering control, the map, and the two side by side
with the map framing the rows on screen. The fourth is this screen's own:

**The timeline is one lane per machine and one bar per job that machine is on.** Lanes
rather than rows is the whole design. A list of jobs on a time axis would be the table
again with a bar drawn on it; a lane per genset puts that machine's whole chain on one
line, so **the white space between its bars is depot time** — which is the only place
in this app a thing that *did not happen* is drawn. On a fleet that hires plant out,
that gap is the number the business runs on. A job with three sets therefore draws
three bars on three lanes, sharing one window, and clicking any of them selects the
job.

**The axis runs past today.** It stopped at `now` while a posting that had not happened
was not in the data model; a planned job is, so `now` gets a rule down every lane, and a standing job quoted to a future date
carries a dashed tail from today to its agreed end. It is still **not a planner**:
nothing drags, nothing schedules, and no bar can be moved, because dispatch is a lorry
and a phone call and this screen is the paper trail those leave.

**One month to a screen, scrolled sideways for the rest** (2026-09-30). A day is a
thirtieth of the visible width, and the track runs from the earliest job in view to
the last booked, never less than fifteen days either side of today. It opens with
today in the middle; the date in the middle is held when the width changes, and a
`Today` button in the corner scrolls back to it. The genset column and the date row
stay put while the track scrolls. Until that day the whole record was squeezed into
the container's width, which left today near the right edge and the fortnight that
matters as a sliver. The lane names are the chart's first column, in primary text
behind a solid rule, and carry the plate alone. The preview panel floats over the
timeline as it does over the map, so the chart keeps its full width.

**A job's dates read `Started on` / `Planned end`, and `Ended on` once it is over**
(`Collected` until 2026-09-30, which read as a status and clashed with the
per-machine `collected` note). Its length reads `Standing` while it is out,
`Duration ran` once it has ended, and `Lorry wanted` before it starts. The preview
panel adds `Time remaining` on a standing job with a planned end, named after the
genset page's `Fuel remaining`, and `Past planned end by …` once that has passed.

The timeline also ignores the table's ordering, deliberately — sorting lanes by fuel
burned would put a machine's chain at a vertical position that means nothing against
a time axis — so the toolbar's sort dropdown is withheld there rather than left on
screen doing nothing.

**The strip counts jobs, not things.** The registers count what exists; this counts
what is happening, so the headline is two figures — machines out, and yards occupied —
which are not the same number when two sets stand at one substation, with a third
clause for machines *committed* to a job that has not started. The three chips are the
three states a job can be in, and they filter all four views together. The strip is
three cards: `Status` (the three chips), `Deployments` and `Gensets out`. Typical job
length and the record's diesel sat beside them once and came off.

**Closed jobs are drawn on the map as well as standing ones.** A map of only what is
out would be smaller and cleaner, and it could not answer "have we had a set at Kapit
before" — which is the question asked before quoting one. The `Deployed` chip is one
click away for anybody who wants the smaller map. A pin's size says how much plant is
on the job, which is the sites map's own channel and the question this map is asked
next.

**The columns are the job's facts.** `Deployment` (the reference over the yard),
`State`, `Status`, `Gensets`, `Dates`, `Run hours`, `Fuel burned`. `Run hours` sorts
by time standing on the job, not by engine hours. `Lorry` left the table with
the model: a plate belongs to a machine and a job may have three of them, so it is
searchable and it sits against each machine on the job's own page.

→ `src/modules/deployment/`

### A deployment's own pages

`/deployments/<id>` is the third thing in this app with a rail of its own, and it is
the same rail: `DetailSidebar`, a switcher in the header, five rows. A job differs
from a site and a machine only in its header and its items, and a new arrangement
here would have been a third pattern for one problem.

| Section | What it answers |
| --- | --- |
| `Deployment` | what the job is, how far through it is, and what it cost |
| `Gensets` | which machines are on it — **and the only place they go on and come off** |
| `Runs` | what those machines ran inside the window |
| `Alarms` | what their controllers raised inside the window |
| `Settings` | the ID, the address and pin, the dates, the customer and contacts, the notes, and the two acts that end it |

**The home band states energy against fuel over the window**, with the ratio between
them. That is *efficiency by deployment*, and it is the reason the model changed: it
could not be shown at all while a genset carried one `siteId` with no time dimension.

**A planned job does not draw that band.** It has produced nothing, burned nothing and
raised nothing, so the strip is dropped and the page says what is committed and when
the lorry is wanted — the same rule that keeps a `0 kWh` generation figure off a site
with no array.

**Runs has no range picker**, which is the one place this page deliberately differs
from the other two levels. The window *is* the job: offering a calendar would invite a
reader to choose a range that reconciles with no record.

**Alarms is the site's own queue, filtered** to the machines on the job and to alarms
raised inside the window. One handling store, one set of rows — so clearing a row here
clears it on the machine's tab and on the site's. Alarms in this prototype are a live
state rather than a log, so a job that closed last month has nothing to show, and the
page says that rather than drawing an empty table that reads as a quiet fortnight.

**Settings is four sections** (2026-09-30): `General`, `Customer`, `Notes` and
`End deployment`.

- **General** holds the `Deployment ID`, the `Address`, the `Start date` and the
  `Planned end date`, with a street map beside them.
  - The address is a search box that autocompletes as it is typed (`AddressField.tsx`): street addresses anywhere in Malaysia,
    from three letters in. The register's sites are not offered. Street addresses come from
    OpenStreetMap through Photon (`src/lib/geo/photon.ts`), a free public service,
    which is fine for a prototype and needs replacing before real traffic.
  - The pin stays at the centre of the map and the map moves under it, like a
    ride-hailing pickup pin (2026-10-01). Panning is the only way to move it; zoom
    keeps the centre, and the pin lifts while the map moves. It moves **this
    deployment only**; the site it was booked at keeps its position. Once the map comes
    to rest the address becomes the street address at the pin. On an ended deployment
    the map is locked: no pan, no zoom.
  - On a standing deployment, a new pin or site is a lorry: every genset on it moves
    to the new position on the fleet map, the same as picking another site.
  - The start date locks once the deployment has started.
- **Customer** holds the company that hired the gensets and a list of site contacts,
  each with a name, role, phone and email. A star marks one contact as primary.
  "Customer" here is the hiring company, not the site's region or zone.
- **Notes** is a log, newest first. Each note is signed with the logged-in user and a
  time, and only its author can edit or delete it.
- **End deployment** ends a standing deployment now, or deletes a planned one. Both ask
  in a dialog first. Ending closes the window and the machines leave the yard; none of
  them moves until somebody collects it. Deleting is for planned deployments only,
  because one that machines have stood on is a fact about the world. On a completed
  deployment the button is greyed out and its tooltip gives the end date.

**A completed deployment's Settings are read-only**, notes included, because it is
the record of what happened.

**The overview page and the side panel carry a Customer card**: the customer, the
primary contact with a tappable phone number and email, and the latest note, with a
link to the rest in Settings.

Every seeded deployment has an example customer and one to three contacts, and about a
third carry one to three notes from the operations room (`data/particulars.ts`).

**On-screen text says "deployment", never "job"** (2026-09-30). The code still says
`job` in places.

→ `src/modules/deployment/components/detail/`

### One thing's rail

Every detail page — a genset, a deployment — and the Service and Fuel sections sit
beside a 240px rail scoped to that one thing. It replaced a tab strip across the top of
the page, and the reason is worth recording because it is not about width: the strip
had run out of **levels**. A site's sections were five tabs, and the plant standing on
that site was reachable only by scrolling to the bottom of its home page. A vertical
rail answers *change section* and *go somewhere under this* with one list, because a
list can nest and a strip cannot. (The site rail nested `Asset ▸ Genset / Solar /
Battery`; it went with the site pages. The Fuel rail nests each depot under *Depot
tanks*.)

The rails differ only in their header and their items, and share one component so the
geometry is stated once. A deployment's header is a **switcher**, alarm-ordered like
the register, so moving between two jobs during an incident is one step rather than
three. A genset's header names the machine.

→ `src/components/global/DetailSidebar.tsx`

### The home pages, and the bands they share

A genset and a deployment each open on a **strip, then bands**, and the bands keep
one rule: the figures that move first, what the thing *is* last. (The site, solar
and battery pages kept the same bands until they were removed.)

**The strip** (`MetricStrip`) is the two or three figures that move, then the alarm
counts in a fixed last column — so a reader moving between pages knows where to look
before reading the labels. It is equal shares rather than content-width columns,
because a strip whose columns move between pages stops being a reference line.

**The details band** (`DetailBand`) is the facts that do not move: nameplates and
identity. It splits into two columns off a **container query** rather than a
breakpoint — these bands sit inside two rails that take 480px between them, so a
`md:` split would fire where the band is still narrow. The split is column-wise, so
the two-column version is the one-column version cut in half.

**What is wrong** is on each thing's **`Alarms` section**, not on its home page. A
band restating the strip's alarm counts lower down is a second answer to a question
the top of the page has already answered, and a reader who wants the detail wants the
log beside it. The strip's alarm pill is the one click from here to there.

**A page only offers what is fitted.** A figure for something the machine does not
have is absent, not zero: `0 kWh` reads as plant that made nothing rather than plant
that is not there.

→ `src/components/global/MetricStrip.tsx`, `src/components/global/DetailBand.tsx`

### The genset home page

Where a click into a machine lands. **Four bands, and the order is the order the
questions get asked.**

**Band 1 — the strip: fuel level, fuel remaining, service, then the alarm counts.**
Two diesel and one service, and the pairing is the point: the tank says how much is
there, the runway says when that stops being true, and the service counter says
whether the same trip has a second job on it. All three survive a stopped engine —
the tank is the tank whether or not the engine is turning, and a set sitting idle is
exactly the one whose service is quietly going overdue.

The design's `Generation today` is deliberately **not** here; output over time is the
[Analysis section](#the-analysis-section)'s. On its own in a strip it invited a
share-of-site reading this page cannot honestly give.

**Band 2 — the run, and the controls that act on it.** The control pad (`ControlPad`)
and the current run (`CurrentRunCard`): this run, and everything since midnight, so the
band reads at three horizons — what one start did, what the day's starts did together,
and how much tank is left beside them. The load is present *only* while the engine
turns; "0 kW" would read as a genset running into an open breaker.

**Band 3 — the tank, and the readings.** Three cards:

- **The tank** (`FuelColumn`): level, tank capacity, burn rate and `Refuel by`. The
  runway counts down to a **30% reserve**, not to empty — a set that runs dry picks up
  air and needs bleeding before it will restart. `hours to 30%` and `Refuel by` are
  the same quantity in two units, so they cannot disagree. A **stopped** set shows
  `—` for the rate and the date: a date would claim the tank is draining while the
  engine sits idle.
- **`Generator conditions`**: while running, five marks as tiles — frequency, active
  power, oil pressure, coolant temperature, battery voltage — each coloured by any
  alarm standing on it; and always, the two hour counters, **Run hours** and **On
  deployment**. The counters are not live readings, so they stay on an idle set
  (since 2026-10-05; for a while the whole card was running-only).
- **`Generator output`** (running only): the output lines, then the three line
  voltages and three phase currents as bar groups. The bars are drawn from zero and
  grouped by quantity because the point is the **comparison** — an imbalance across
  phases shows up as three bars of different lengths before anybody reads a number.

**When the engine stops**, `StandbyPanel` takes the output card's place. It is not a
placeholder: the readings that survive a shutdown are the pre-start ones — battery
voltage, coolant temperature, fuel — and they are what the pad's question, *start
it?*, turns on.

**Band 4 — what the machine is.** The `DetailBand`: which machine this is, what it is,
what size it is — the rows a person needs to order a part, brief a technician or find
it in a yard. Rating is among them because it is the denominator of every load figure
above. Last, because nothing in it changes between one visit and the next.

**Where the activity feed went.** Nowhere; it is gone. Everything it showed is owned
by a section of its own: runs and jobs on `Deployments`, services on `Service`, and
fills on the tank chart.

### The analysis section

The home page answers *what is this machine doing*. This one answers *what has it been
doing*, and the difference is not a matter of showing more numbers. A snapshot is a
verdict: 103 °C is either past the limit or it isn't. A trace is an argument — it shows
the coolant climbing steadily for two hours before the alarm, or jumping in a minute,
and those are different faults behind the same reading.

**Two readings, two axes, one window.** The cap is not a simplification. Readings carry
incompatible units, and the moment a third arrives either two of them share a scale
that fits neither, or everything is normalised to a percentage of its own range and the
numbers stop being numbers. Two is what a pair of labelled axes can state truthfully.
Colour is the only thing tying a trace to its scale, so the picker's chips double as
the legend.

**Four ways to name a window, because there are four different questions.** A
**preset** — 24 hours, 7 days, 30 days — is anchored to now, and the answer is a shape.
A **custom range** is anchored to dates the reader already had in mind, usually because
a ticket, an invoice or a site visit put them there; it is picked in whole days, since
that is the unit a person names and the unit a URL can carry legibly. A **run** is
anchored to an event, and it is the only stretch of time over which *every* reading on
the machine is defined, because a run is by definition the engine turning — which is
why the run list lives here as well as on the `Runs` section: it is this screen's
sharpest selector, not a cross-reference. A **posting** is anchored to a job, and on a
fleet whose plant moves it is the selector that answers the question a customer asks:
*what did the Ranau job cost?*

Each control clears the others, so only a hand-edited URL can ask for more than one at
once — and `analysisRange()` is the single place that gets settled. A custom range
reaching past the history layer's own horizon is clamped rather than refused: the reader
asked for March, and showing the part that exists beats an error about a boundary they
cannot see.

**Alerts appear as lines.** Most alarm bits are a threshold on a reading, so plotting
the reading draws the threshold with it, on that series' own axis, marked where the
trace crossed. The rule's limit is held as a number and its prose (`< 24 V`) is derived
from it — the dashed line and the caption on the home page's alert card are one fact
rendered twice, not two facts typed twice. The two bits with no reading behind them draw
nothing here, which is correct: there is no axis to put them on.

The selection lives in the URL, so the useful thing to send is not "open BRF9540" but
the chart itself:

```
/gensets/brf9540/analysis?keys=coolant-temp,oil-pressure&window=7d
/gensets/brf9540/analysis?from=2026-07-20&to=2026-08-05
/gensets/brf9540/analysis?run=brf9540-run-3
```

→ `src/modules/genset/data/history.ts`

### The runs section

Where the run card's `→` points, and the question it answers is the one that arrow
implies: *how does this run compare with the last twenty?* So the page leads with the
comparison and puts the list last.

**Three bands, in the order the questions arrive.**

**The strip** — runs as bars, gaps as space. The most useful thing on the page and it
carries no number at all. A fleet mixes duty profiles, and a set that runs
continuously, one that follows a load and one that has started three times since June
are three different machines to look after. A table of timestamps *states* that
difference; the strip draws it, and the reader has it before reading a row. It is also
how *when did it last run* gets answered without arithmetic — for a backup set,
readiness is the gap between the last bar and the right edge.

A site's strip has **one lane per set**, and the stack is the point: two sets
alternating read as interleaved lanes, and a vertical slice with no bar in any lane is
a stretch where the site had nothing running. That gap is the site version's reason to
exist, and it is invisible on either machine's own page.

**The totals** — completed runs, time running, energy, fuel, for the chosen window.

**The log** — one row per run, newest first, the open one at the head. The start stamp
links to `/analysis?run=<id>`, which closes a loop that until now ran only the other
way, from that section's run picker to here.

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
| **Carried in** from before the window | It delivered some of its energy on the far side of the boundary. Pro-rating would invent a number, since output is not uniform across a run — the entire premise of the analysis section. Counting it whole would credit this window with fuel burned before it opened. |

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

Four presets, a calendar, and — where a set has been on more than one job — a
[posting](#deployment). The presets are the analysis section's own
vocabulary, imported rather than retyped: the two sit one click apart in the same
rail, and a `7d` meaning different spans on each would be the app disagreeing with
itself. `All` is this section's addition and earns its place — a backup set runs
three times a year, so every bounded preset is empty for it.

There is no *by run* selector, though the analysis section has one. This page
**is** the list of runs; narrowing it to one would be a filter whose result is the
row you clicked.

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
section: the range in the link is the range in the file.

```
/gensets/brf9540/runs?window=all
/gensets/brf9540/runs?from=2026-07-01&to=2026-07-31
```

**Not here, deliberately:** start and stop cause (no source for it yet — the
`startReason` on a `Genset` is the *machine's* current reason, not a per-run
record), efficiency figures, and fuel discrepancy.

→ `src/modules/genset/types/runsView.type.ts`, `src/modules/genset/data/runsCsv.ts`

### The genset's remaining sections

**`Service`** — three bands, in the order the questions get asked: *is it due, and on
which counter* (both counters, at the same size, because
[neither converts into the other](#service)); *what is it measured against* (the two
intervals, editable); *what has actually been done* (the log, and the documents behind
it). A `Log service` dialog writes a record with the current hour reading and an
optional document.

Band 2 is a setting and nothing else. It briefly also carried the arithmetic behind the
counters — the meter now, the meter at the last service, the date of it — on the theory
that a counter is more trustworthy when its inputs are visible. All three were already
on the page: the hero states the result and the history table carries the hour reading
and date of every service including the newest, so the middle band was re-stating its
neighbours rather than adding to them.

**`Alarms`** — every alarm this machine is carrying, and what has been done about each.
**Two readings of one list, on one page.**

**The band, first.** It used to close the home page. It answers *is anything wrong
right now*, mixes the register map's alarms with the app's own rows — a leak, a low
tank, a service falling due — and files them under the operator's tags: a condition
verdict on the left, two rows of filter chips, then the cards, each drawn against the
reading and the line the reading crossed.

The chips are a **single-select filter** with two kinds of entry, and the asymmetry
between them is deliberate:

| Chip | Question | Shows |
| --- | --- | --- |
| **Severity** (`Critical 2`) | what is wrong, worst first | matching alerts only |
| **Tag** (`Coolant`) | how is this subsystem doing | every reading under the tag — alerting ones promoted into cards, quiet ones as plain rows |

A severity is a property of *alerts*, so filtering by it cannot surface a healthy
reading. A tag is a property of *readings*, so filtering by it has to show the ones
that are fine as well — otherwise selecting `Coolant` on a healthy engine returns an
empty list and the reader cannot tell "nothing wrong" from "nothing measured".

Single-select, not multi: two filters intersected produce a result nobody asked for
("critical alerts, but only coolant ones"), and the chip row stops being readable as a
summary of the machine.

Tag chips are **coloured before anybody clicks them**, by the worst alert among their
readings. Green means "these numbers are all inside their thresholds", which is the
answer most of the time and worth being able to see without opening anything.

The verdict — `Optimum` / `Attention` / `Critical` — is *derived* from the alerts,
never stored, so it cannot drift from them. Worst severity wins; neutral alerts do not
spoil it.

The selection lives in the URL, so a link can open a genset with its coolant readings
already showing:

```
/gensets/brf9540/alarms?tag=coolant
/gensets/brf9540/alarms?severity=critical
```

**The band deliberately carries fewer rows than the tables under it,** and says so in
a footnote rather than leaving the reader to notice. Every card in it prints the
register, the reading and the line the reading crossed; the site monitoring unit's
per-phase AC rows have no reading this prototype has ever taken, so they have nothing
to draw against and stay in the tables.

**Then the two tables, because there are [two axes](#alarm-handling).** `Standing` holds
everything still live, acknowledged or not — clearing is what moves a row out of it and
acknowledging deliberately does not. `Cleared` is the log: what was raised, when it was
closed, and by whom, with a `Reopen` on each. Splitting them is what lets the first
table be a work queue rather than a mixture of jobs and receipts.

Every row prints its register and bit, and it matters more in the tables than in the
band above them: this is the log, and a row that gets screenshotted into a message to
the panel supplier has to say which bit it came from, or it is one crew's paraphrase
of a fault.

**Both halves read one store**, subscribed once between them, so they cannot disagree
about which alarms are standing: clearing a row in a table empties its card out of the
band and drops it from the home page's counts on the way back, without a reload.

**Not here:** the threshold rules behind these alarms, which the section's earlier
placeholder promised. They are controller configuration — the voltage window this panel
treats as over-voltage — and this prototype has never read one. Guessing them on a
settings screen would be the app asserting a setpoint nobody has confirmed. Ticketing,
assignment to a named engineer and notification routing are likewise absent: they are
the layer above acknowledgement, and they need a decision about who gets told and how
before they are worth drawing.

**`Settings`** — **empty.** The rail names the section and the design draws nothing
behind it. What belongs here is the short list of lines the *app* owns, as against the
ones the controller does: the [fuel leakage alarm](#fuel-reconciliation)'s switch and
threshold, tags, and notification routing. Everything else on this machine is bounded
by the rule **a setpoint that lives in the panel is not editable from a screen that
cannot issue the command.** The tank's reserve line is the app's own so it
*could* be editable, but it is also what the [three buckets](#fleet-status) are
defined as, and a per-genset reserve line would leave those counts working to a
different definition on every row. If they ever move, they move for the estate.

**`Devices`** is the one section here that is not drawn: nameplate data, the controller
and ATS fitted, and the service schedule. It is named `Devices` in the rail and
`equipment` in the route.

### The fuel page

`/fuel` is four tabs, picked from a rail on the left, all over the same window: the
last 30 days, rolling, so it ends now and never resets on the 1st; every label
says *last 30 days* (Jeff, 2026-10-01), not *1 month*, which read as the calendar's. There is no period control at the top (Jeff, 2026-09-30: the page shows
the current state); it had a 1 day / 7 days / 1 month / custom one until then. The
Genset fills and Truck log tables each have their own picker, the genset analysis
tab's `RangePicker` — 24 hours / 7 days / 30 days / custom (2026-10-05) — and so does
the Level chart on a depot's own page. Each card's corner pill names the period it covers.
**Depots** has each yard's bulk tank reconciled against what it issued.
**Genset fills** (`?view=deliveries`; *Deliveries* until 2026-10-05, renamed because
"delivery" now means supplier fuel into a depot) has every genset filled at a depot. **Trucks** has the fuel that
reached a machine by road, and **Truck log** (`?view=truck-log`) every load, stop
and loss, a tab of its own since 2026-09-30 rather than a table under the truck
register, as Genset fills is beside Depot tanks. An estate with no trucks gets
Depots and Genset fills only.

**Numbers are written with a comma and a space**, *164, 158 L* (Jeff, 2026-10-01 on
the Fuel pages; app-wide since 2026-10-05), with a true minus, *−1, 234 L*. Every
figure on screen goes through `lib/format.ts` (`figure` and `amount`), so the
separator is set in one place. CSV exports keep plain numbers. Summary card titles are semibold in the text colour, app-wide,
so they read as headings.

**The Trucks tab is laid out and sized as the Gensets page is** (Jeff,
2026-09-30): a toolbar (number-plate search, a *Fuel depot* filter (named *Home depot* until
2026-10-01), list / split /
map), the filter chips, two summary cards, then the truck register beside the map,
with the selected truck's panel floating over the map's right edge. The panel shows
only while a truck is selected (Jeff, 2026-09-30): clicking a row or a pin opens it,
and its × or a click on the basemap closes it. It had a show / hide toggle in the
toolbar and an empty *Select a truck* state until then. It is kept short (Jeff, 2026-09-30):
the tank line (*3, 200 of 10, 000 L · 32%*), where the truck is and who has it, one red
line when fuel went missing (*2 short loads · 488 L missing*), *This period*
(received from depot, stops, delivered), and *View in Truck log ›*, which opens the Truck log tab
searched to that truck (`?view=truck-log&truck=<id>`). The truck's standing facts
(drivers, the states it covers, its instruments), a card per loss and its own copy
of the log were taken out. The cards are
*Missing from trucks* (a toggle that narrows the register to the trucks that lost
fuel, as the fleet's *Due for service* does), and *Fuel on board*; a *Trucks* count
(the register counts them) and *Delivered by truck* (a share nobody acted on) were
cut on 2026-10-01. Beside the map the register drops *Depot* and *Location*, as the
fleet table drops *Location*. The truck log is its own tab now; it followed below,
narrowed to whatever trucks the register's filters left, until 2026-09-30. Every truck mark on the map is fuel violet, the colour the genset tanks are drawn in
(Jeff, 2026-09-30): a truck's dot, and a cluster of trucks, which is a violet bubble
with its count in white. A truck with fuel missing is violet too; it was red, and
the register and the *Missing from trucks* card are where the losses are now. On the map a depot is a dark map pin with the warehouse icon on its head and its
name beside it (*Klang depot*), not another dot (Jeff, 2026-09-30): as a black
circle it read as one more truck, and a labelled square came in between. The icon is
the one the rail heads Depots with. The pin's head is a truck dot's width, 22px, so the
two marks differ in shape and not in size (Jeff, 2026-10-01); the map key draws
them at one width too. Clicking a depot's pin zooms the map in on it, to
town scale, and leaves the selected truck as it was. Clicking its name opens the
depot's own page, and the name is drawn as a link to say so: the brand colour with
a trailing ›, going dark on hover. Depots are kept out of
the clusters and out of a hovered state's truck count, and a key in the map's
top-left corner says what a violet dot and a pin mean. The register and the map take the rest of the screen, as the
Gensets page's do, so the page does not scroll and the table scrolls in its own box;
they were a fixed 520px while the log sat below. On a phone the trucks are cards and a truck
opens as a drawer.

It replaced a stack of sections that opened on a *Fuel missing* verdict with one
row per loss. That verdict is now the card; each loss is in its truck's panel and
in the log's *Missing* column.

**How a genset is filled** (Jeff, 2026-09-29), decided per fill by where the
machine was posted at that moment:

- **In a depot's own state** (Selangor, Perak, Pulau Pinang, Johor): the genset
  drives in and fills at that yard.
- **Anywhere else**: the truck that covers that state brings the fuel. Klang takes
  KL, Pasir Gudang takes Negeri Sembilan, Melaka and Putrajaya, Ipoh takes the
  east coast, Butterworth takes Kedah and Perlis.
- **Between postings**: the genset is at a yard, so it fills at the nearest depot.

The postings are the deployments as they stand, edits included (2026-10-05). Create,
move, end or delete a job and the fills it covers move with it, on the Fuel pages
and in the Reporting files. Both used to read the seeded record and ignore edits.

**Each estate has its own depots** (2026-10-05). Express Mission's four are Klang,
Ipoh, Butterworth and Pasir Gudang. The carrier estate runs no trucks, so every
genset drives to its nearest yard. Its seven are Klang, Butterworth and Pasir
Gudang for its peninsular towers, plus Kota Kinabalu, Sandakan, Bintulu and
Kuching. Before that both estates shared Express Mission's four, and about twenty
Sabah and Sarawak towers were listed as filled at Pasir Gudang.

**What the seed puts in each depot's gap.** Each yard has a slow loss every hour
and one larger drop nobody logged, both sized to what the yard issues (2026-10-05).
They were flat litres before, so a small carrier yard lost half its month to the
one drop. Butterworth, on Express Mission, takes no drop. Instead its level sensor
over-reads every fall by 0.1%, a gap just past the 100 L floor and under the
unlogged line, so it reads *Sensor fault*. The sensor used to under-read, which
made the gap negative, and since the gap is never shown below zero, that example
had vanished. The carrier estate has no *Sensor fault* case. Its yards issue under
20,000 L a month, and at that size 0.5% is already below the 100 L floor.

The depot's newest reading is taken at the same moment as the genset history's
(2026-10-05). It used to sit half an hour later. Each page then left that last hour
out of *Fuel Out*, *Mobile gensets* and *Fuel trucks* but still showed it in the
level. So *Balance* was not the opening level plus *In* minus *Out*, and a yard's
*Gensets filled here* came out higher than its *Mobile gensets* row.

The state comes from the site's label, not the map polygon. `Kepong, Kuala Lumpur`
sits just inside Selangor's outline.

**Where a truck's fuel comes from.** Its home depot, and nowhere else: a refuel
truck never fills at a petrol station (Jeff, 2026-09-29). It loads there every two
to four days, and when it would drop below 10% before its next stop it goes home
early to load. So every litre a truck carries left a depot tank the page can see.
A load that falls short shows on both tabs, from each side: on the Trucks tab as
*Depot out vs truck in* in the truck's panel and a *Missing* figure in the log,
and in the depot card's *Fuel trucks* figure, where the tank gave more than the
trucks received.

**The overview cards show what someone acts on** (Jeff, 2026-10-01). Every Fuel tab
opens on a row of them, and on every tab the problem card comes first; a tab has
as few cards as pass that test, down to one, rather than a fourth for the sake
of it. Counts of things (how
many trucks, entries or fills) were cut, since a table beside them counts them too.

**The Depots tab's cards** (Jeff, 2026-10-01): *Needs attention* and *Fuel
balance*. *Needs attention* lists each yard with a verdict, worst first, in the
tile's own words (*Klang · 1, 826 L unlogged*, *Butterworth · Sensor
fault*), each a link to that yard's page, and reads *None* when every yard balances.
*Fuel balance* is every depot's tank together: *Fuel In*, what suppliers put in,
and *Fuel Out*, what left for mobile gensets and fuel trucks; then, ruled off under
them, *Balance*, what is in the tanks now and how full that is. The period is said once per card, as a *last 30 days* pill in its
top-right corner, not in the title or on each line. *Needs attention* replaced two cards the same day, *Fuel unaccounted for* and
*Sensor faults*: they counted yards without naming them, so the reader still scanned
the tiles to find which, and their filters hid one or two of four tiles already on
screen. *Fuel in stock*, *Low stock* and *Days of stock* were tried and cut that
day too; *Days of stock* gave the yard running dry first, but took no account of the
supplier deliveries still to come.

**The depot card tells the depot's side only** (Jeff, 2026-10-01). The gap is *Unlogged fuel*,
badged *1, 826 L unlogged* (Jeff, 2026-10-01; it was *Missing at depot*): the figure is fuel
the log does not hold, and *missing* claimed more than that. It never reads below zero: the
opposite case, the pumps logging more than the tank fell, had its own label (*Over-logged
fuel*, once *Extra fuel recorded*) and was set aside the same day as not needed for now, so it
reads *0 L* with no badge. Under *Fuel Out*,
indented as where it went, are *Mobile gensets* (fills in the yard) and *Fuel trucks*
(loads into trucks), each what the yard's own pump log says it gave. They were *To
gensets at yard* and *To trucks*. *Unlogged fuel* is what is left: the tank's fall
less everything the log accounts for, so fuel that left with no fill or load logged.
Whether a fill or load then *arrived* is the receiver's story: a truck's short load
(the pump gave more than its tank rose) is on the Truck log under *Missing from trucks*.
A yard fill has no such gap in this data, since the genset's tank records exactly what
the pump gave. Earlier the same day each share showed its receiver's gap under the
figure (*180 L short*), and *Unlogged fuel* added those gaps to the unlogged fuel;
before that the shares were *Out* over *In* pairs, and an arrow, `63,721 → 63,720 L`,
before that. *In* now means only the depot's deliveries, and *Fuel In* sits above *Fuel
Out*. A *No fill or load logged* row went too, since it was *Unlogged fuel* again.
The card names no place beside the title, since the title already says *Klang depot*
(Jeff, 2026-10-01; it was *Klang, Selangor*, then *Selangor* alone). The period is said once, as a *last 30 days* pill in the card's top-right corner beside the
verdict, the same pill the overview cards carry, not on the *Fuel In* and *Fuel Out* rows.
The
level's percentage sits in the middle of the tank drawing in solid text colour,
with `level / capacity L` beneath it, which replaced the *Max capacity* row (Jeff,
2026-09-30). It was white over the diesel for a while, split at the level line, and
went back to one solid colour. In the card's bottom-left corner, *Last updated: 30
minutes ago*: when the level sensor last reported, with the exact time as the tooltip, as the
fleet table's *Last updated* says it for a genset. It sat under the litres at first and moved to the corner
(Jeff, 2026-09-30). A ring was tried in its place and dropped.

**Every depot card shows every row** (Jeff, 2026-10-01): *Fuel In*, *Fuel Out*, *Mobile
gensets*, *Fuel trucks* and *Unlogged fuel*, whether or not the card has a verdict. From
2026-09-30 a card with no verdict showed only the gap row, and a *Show breakdown* toggle was
tried and removed that day.

**The alarm is named in strong words, and by where the fuel went** (Jeff,
2026-09-30). On a depot, the gap row is *Unlogged fuel* when more left the tank
than its pump log accounts for, and *0 L* otherwise. The
red badge is the amount, *252 L unlogged*, and the amber one is *Sensor
fault*. Fuel lost after a truck drives off is the Trucks tab's, and says so:
*Missing from trucks* on its summary card and filter chip, *Missing from truck* in
a truck's panel. Both once read *Fuel missing*, which let the two stages pass for
one figure; before that the depot's were *Fuel Out − Fuel Arrived*, *Fuel did not
arrive* and *Check calibration*. The rail's status line reads `4 depots · 2
with unlogged fuel · 1 sensor fault`.

**Clicking a depot opens its own page**, `/fuel/depots/<id>` (Jeff, 2026-09-30).
The whole card is the target. Its name reads as a link, *KLANG DEPOT ›*, and is
the way in for a keyboard or a new tab; hovering anywhere on the card lifts it and
underlines the name. A faint *Details* in the footer came first and did not say the
card was clickable. It was a drawer over the tab for a few minutes
first and became a page, because a yard is somewhere a reader works in, comes back
to and shares, not a row glanced at on the way past. The page (`DepotPage.tsx`)
keeps the Fuel rail, where every depot is listed under *Depot tanks* with its verdict as a dot (Jeff, 2026-09-30). The current depot is marked, and *Depot tanks* goes back up. The
crumb reads *Fuel / Depots / Klang depot*, and *All depots* above the heading is the
way back on a phone, shown there only (Jeff, 2026-10-01), since wider the rail and the crumb
already say it. It reports on the last month, as the Fuel page does, with no period control
(Jeff, 2026-09-30); it had one for a few minutes, carried in the URL as `?period=`. Top to bottom:

Reworked element by element with Jeff on 2026-10-01, so the page tells the depot's side
only and says each figure once:

- the name, its street address (made up for the prototype; it was *Klang, Selangor*,
  which said Klang twice). No verdict badge: the *Unlogged fuel* card carries the warning;
- two overview cards, as on the Depots tab: *Unlogged fuel* with its verdict and share — a
  warning when the yard has a verdict, tinted red or amber with the figure and an alert mark
  in that colour and what to check under it (*past the limit, check the pump log*), and a
  plain card when it has none — and
  *Fuel balance* for this yard (*In*, *Out*, then *Balance*, *left in the tank*, in litres
  only since the tank drawing has the percentage), both with a *last 30 days* pill. They
  replaced *Unlogged fuel*, *Fuel in stock* with its days left, and *Fuel out*; days left
  was dropped;
- *Tank* as a third overview card (Jeff, 2026-10-01; it was a card of its own beside the
  chart): a smaller tank drawing with its percentage, `level / capacity L` and *Last updated*;
- *Level*, full width: the level over the period, drawn against the full tank rather than
  fitted to the line, so a quiet week looks quiet and a supplier delivery is a tall step. It
  is drawn by the genset analysis tab's chart (Jeff, 2026-10-01): round-number litre ticks,
  gridlines, a crosshair and the shared readout on hover, and a key under it, in the fuel
  violet. It has the page's one date filter (Jeff, 2026-10-01): the analysis tab's picker,
  *24 hours*, *7 days*, *30 days* and a custom range back to the start of the record,
  opening on 30 days, with no *By run*. It moves only the chart; the cards and lists stay
  on the last 30 days, so the card carries no period pill. Held in the page, not the URL.
  The level is read every 15 minutes over two days or less and hourly past that, since the
  chart needs evenly spaced samples;
- *Fuel breakdown* (it was *Reconciliation*, then *Where the fuel went*): *Fuel Out* and the shares it went to,
  *Mobile gensets*, *Fuel trucks* and *Unlogged fuel*; *Fuel In* is the balance card's;
- *Deliveries into the depot*: each rise between two readings, since nothing but a
  supplier puts diesel into a bulk tank;
- *Mobile gensets filled here*: the total, the latest ten, and a link to the Genset fills
  tab when there are more;
- *Fuel trucks loaded here*, at the depot pump's litres (*pumped*), one line per truck with its loads and litres, each linking to that
  truck on the Trucks tab (only where the estate runs trucks). The litres are the depot
  pump's, as *Fuel trucks* counts them, not the trucks' own sensors.

The lists follow the breakdown, In then Out: deliveries in beside *Fuel breakdown*,
then gensets and trucks, each totalling what its row says. Every card that covers the
period wears the *last 30 days* pill in its corner, not in its title.

**Two depots run down.** On Express Mission's estate Pasir Gudang stands at 24% and
Ipoh at 50% (Jeff, 2026-09-30), so the page shows a low tank and a half one. (The
carrier's depots have no such setting; they sit high.) Their supplier brings
less than the yard issues each round, and the stock runs down week by week, which
is why their *Fuel In* is far below their *Fuel Out*. The level is set by
`stockFraction` in `data/depots.ts`, and it stays above the 18% reorder floor. The loss figures are unchanged, since
they come from issues and receipts, not from the level.

**A truck has more than one driver** (Jeff, 2026-09-29). Each has two on a rota,
and it changes hands at its home yard: each run from one home load to the next is
the next driver's. Every event records who was driving, so a loss and a log row name the
driver at the time, not the truck's first name. The truck log gives it a column
of its own, beside the truck, headed *Operator*. The drawer lists both drivers and who has the truck now.

**Three ways fuel goes missing.** Each truck has a tank level sensor, a nozzle
meter and GPS. The genset's own level rise is a fourth reading, and each load has
a fifth: the depot's pump meter.

- **Truck out vs genset in.** The meter says more than the genset rose, by more
  than 10% of the metered litres.
- **Truck out vs nothing in.** The truck's level fell with the meter idle.
- **Depot out vs truck in.** The depot pump says more than the truck's tank
  rose, by more than 10% of what was pumped.

Gaps under 10% are instrument noise and are not shown as missing anywhere.

Every loss is titled `<where it came out> out vs <where it went> in`, and its
figures read `Out 1, 806 L · In 1, 556 L`, rather than naming the instruments
(Jeff, 2026-09-29). Out carries an amber ↗ and In a green ↙; neither is red,
which stays for the missing litres.

**The Genset fills tab's cards** (Jeff, 2026-10-01): *Litres filled* over the
table's period, with the fills and gensets under it, and *Waiting for fuel*: the
gensets below their reserve line now, with the longest any of them has gone since
a fill. *Waiting for fuel* is a link to the Gensets page filtered to low fuel, which
lists the same machines. It was "low and not filled this period" first, which over
a month never fired: every low machine had had some fill, just not enough.
*Busiest depot* and *Latest delivery* were cut.

**The Truck log tab's card** (Jeff, 2026-10-01): *Missing from trucks* alone,
over the log's own period. It filters the table to the entries with fuel missing
and leaves a chip, and it counts the whole period, not what the other filters
leave. An *Entries* count was cut, and so were *Depot loads* and *Genset fills*,
which did the *Activity* dropdown's job from a second place.

**The truck log.** Every load and stop, newest first, with the truck and its
operator in separate columns (Jeff, 2026-09-29), what was recorded (the
meter at a stop, the depot pump at a load), the truck tank's change, the
genset's rise, and litres missing, which is empty unless past the 10% line.

The seed plants one of each so every kind can be seen. Klang's truck pumps 16%
more than arrives at one stop about six days back. Pasir Gudang's loses 380 L
with the meter idle eleven days back. Ipoh's loads at the depot about two days back
and its tank rises 12% less than the pump says. There is no "next stop" suggestion
and no RM pricing.

**The four trucks share the work.** Each does roughly 20 to 30 log entries a
month. To get there, three Kuala Lumpur yards (PE-002 to PE-004, once Setapak,
Cheras and Sentul) now stand in Temerloh, Alor Setar and Kangar, and Putrajaya
moved from Klang's truck to Pasir Gudang's (Jeff, 2026-09-29).

→ `src/modules/fuel/data/fills.ts`, `trucks.ts`, `truckRuns.ts`, `depotTank.ts`

**Both tables work like the Gensets and Deployments registers, and like each
other** (Jeff, 2026-09-29): a number-plate search, filter dropdowns whose counts
follow the other filters, a *Filtered by* row of removable chips with *Clear all*,
headers that sort, and a count on the right. A new header opens the way a reader
means it (names A to Z, newest and biggest first); clicking the one showing flips
it. Both open newest first. The deliveries filter by *Depot*; the truck log by
*Operator* and *Activity* (loaded at depot, filled a genset, level fell with
the meter idle).

Both tables have their own period picker, the genset analysis tab's `RangePicker`:
24 hours, 7 days, 30 days and Custom (2026-10-05; it was 1 day / 7 days / 1 month /
Custom from 2026-09-30). It opens on 30 days, so on arrival each table lists what the
figures above it add up. Changed, it narrows that table and its cards, whose pill
names the new period, and leaves a chip that puts it back to 30 days. → `src/modules/fuel/TablePeriod.tsx`

Both run twenty rows a page under `TablePager`, the registers' pager (Jeff,
2026-09-30). Any search, filter or sort goes back to page 1, and turning a
page scrolls the table's head back into view, since the page scrolls rather than
the table.

→ `src/components/global/TablePager.tsx`, `src/modules/fuel/RegisterTable.tsx` (the shared pieces), `DeliveriesTable.tsx`,
`TruckLog.tsx`

**Switching between the tabs.** From tablet width up, a second rail on the left:
the 240px column a genset's sections use, headed *Fuel* (Jeff, 2026-09-29).
*Depots* and *Trucks* head it as plain labels that never switch the page and no
longer fold (Jeff, 2026-09-30; they were dropdowns with a chevron for a while). The
links under them are always shown and are what switch the page: *Depot tanks* and
*Genset fills* under Depots, *Trucks and map* and *Truck log* under Trucks. Under
*Depot tanks*, one smaller link per depot opens that depot's own page, with a dot
when its card has a verdict. A chevron at the right of the *Depot tanks* row folds
that list away and back; the row itself still opens the tab. The link
for the tab showing is highlighted. *Truck log* scrolled to a section of the Trucks
tab until it became a tab of its own (2026-09-30). A heading with a problem in the period carries a red (or
amber) dot, and its status line (`4 depots · 2 with unlogged fuel · 1 sensor fault`) is the
heading's tooltip. Genset fills (then *Deliveries*) was a table under the depot tanks until 2026-09-30,
when it became a tab of its own (`?view=deliveries`). An estate with no trucks
shows the Depots group only.

The top bar names the tab too (Jeff, 2026-09-30): `Fuel / Depots`, `Fuel /
Genset fills`, `Fuel / Trucks`, with *Fuel* a link back to the first tab. The tab is a
query string rather than a child route, so the route supplies it through
`staticData.crumbTab`, read off the URL — see `TopNav`.

It was chosen from six built side by side the same day: a status line under each
label, rows nested under Fuel in the main sidebar, a count on each row, an
icon-only strip, cards on top, and this. On a phone, where no page has a second
rail, the switch is a card per tab above the page with the status line on each. The
cards replaced a small pill switch that read as a filter rather than a choice,
and a combined page of both halves was tried and dropped: they are different jobs.

→ `src/modules/fuel/FuelNav.tsx`, `src/modules/fuel/ViewSwitch.tsx`

### Settings

One section, and it switches which customer this build is.

The picker exists because the alternative was restarting the dev server. Two brands
share one build, and the thing a designer actually does with that is compare them: is
the rail dark enough behind this mark, does the amber still read on that blue, does the
estate's own vocabulary make the summary cards scan. That is a two-second loop with a
control and a forty-second one with a terminal.

It is **absent from a customer's own deployment**, because that build carries one brand.
The control keys off the number of brands in the bundle rather than off a flag, so what
is shown and what is shipped cannot drift apart. Switching reloads the page: a brand
names a dataset, and the estate is built once at startup.

### Phone width

The **four phone destinations** — Gensets, Deployments, Fuel and Service — and the
genset home page lay out for a phone. They are the same routes at a narrower window
rather than a parallel set of mobile ones, so a link works wherever it is opened.

The line is Tailwind's `md`, 768px. Almost every decision either side of it is a CSS
class; the two that cannot be are in `lib/useIsCompact.ts`, where the *tree* differs
rather than its layout — a table swapped for cards (rendering both and hiding one would
put every row's links in the accessibility tree twice), and the map's panel inset, which
is a number.

**The nav becomes a floating bottom bar with four destinations** — Gensets,
Deployments, Fuel and Service. Reporting and Settings are desktop-only: the point of a
limited bar is that everything it offers works. The routes themselves still resolve if
a URL is typed or followed from a desktop link; what is withheld is *navigation to*
them.

**A detail page's rail has no phone form at all.** A phone sent to `/gensets/brf9540`
gets the page but not its seven sections. That is acceptable for a page you arrive at
from a list you tapped; it would not be acceptable as a destination the bar offered
directly.

**The registers withhold their maps and the list becomes the whole screen.** A 375px
basemap of Malaysia puts Kangar and Johor Bahru within a thumb's width of each other,
so panning and pinching become the only way to read it.

**The summary strip folds; the filters do not.** Stacked two-up the strip is several
rows deep before the list starts, so it folds and the list takes the height back. The
filter dropdowns are in the toolbar above it and stay put at every width.

**The registers become cards, and the whole card navigates.** Not the table with
columns dropped: the columns that survive 390px are the ones that say least on their
own. There is no preview panel at this width to select into, so a card that
highlighted itself and did nothing else would be a dead end.

**The genset home page needed no rewrite, because its reading order is already
vertical.** Each band's row breaks into a column. The control pad is four **tap
targets**, and a control shrunk below a thumb is worse than no reflow at all, so it
keeps its size.

One trap is worth knowing before editing any of it. Where the desktop layout is a
wrapping row holding a fixed item beside a shrinkable one, **`flex-wrap` is the wrong
instruction at phone width**: both items "fit" on one line once the shrinkable one may
shrink, and the result is a squeezed column with its contents spilling under the fixed
one. Those rows are `flex-col md:flex-row md:flex-wrap` instead.

`MobileNav` is a *floating* pill rather than a docked bar, so every scrolling page
carries `pb-24` below `md` or its last row finishes behind it.

---

## Where things live

```
src/brands/                  whose app this is, and which estate
├── types.ts                 the line between identity and the product model — read first
├── manifest.ts              the brand list and each tab's title — Node only
├── catalog/                 one file per brand: name, marks, three colours, a dataset
├── datasets/                carrier.ts, utility.ts — sites, sets, regions, programmes
├── identity.ts, dataset.ts  the registries, split so colours load alone
└── selection.ts, active.ts  which brand this session is showing

src/lib/format.ts            every figure on screen (`figure`, `amount`) and every date

src/components/global/
├── Sidebar.tsx              the app rail — five destinations
├── MobileNav.tsx            the floating bar, four destinations
├── DetailSidebar.tsx        one thing's rail: 240px, shared by gensets, deployments,
│                            Service and Fuel
├── MetricStrip.tsx          the strip on a home page
├── DetailBand.tsx           the details band on the genset home page
├── SummaryCards.tsx         the card strip above the registers, and `CardPill`
├── registerTable.ts         the register table's shared classes
├── FilterSelect.tsx         one filter as a toolbar dropdown
└── ComingSoon.tsx           a section that says what it will hold

src/modules/genset/
├── types/                   Genset and run state, runs, readings, alerts, alarm handling,
│                            service, fuel integrity, the reserve line, series, and the
│                            URL state of the register, the analysis and the runs
├── data/
│   ├── fleet.ts             the dataset's machines — the givens; offline after an hour
│   ├── deployment.ts        where each set is, DERIVED from its active job
│   ├── spread.ts            the one hash every mock number is seeded from
│   ├── detail.ts            everything derived from a given, incl. `ALERT_RULES`
│   ├── history.ts           the run log, refuels and reading series, built backwards
│   ├── alarms.ts, alarmViews.ts, assertedAlarms.ts, lowFuelAlarm.ts
│   │                        the standing/cleared store, and every alarm source
│   ├── services.ts          the service log; serviceSeed.ts is its givens
│   ├── fleetStatus.ts       the three buckets, worst-wins and exhaustive
│   ├── fuelInstruments.ts, fuelIntegrity.ts   the instruments and the leak check
│   └── runsCsv.ts           the run log as a file somebody bills against
└── components/              the register; detail/ (the home bands, analysis/);
                             runs/ (the Deployments section); alarms/; service/

src/modules/deployment/
├── types/                   Deployment, DeploymentMembership, the three states; URL state
├── data/
│   ├── seed.ts              the record, dealt per yard; and what a window cost
│   ├── realJobs.ts          BRF9540's measured jobs, runs and refuels
│   ├── store.ts             the jobs as edited, the write path, and the overlap rule
│   ├── feed.ts              one job joined to its machines — every view's row
│   └── detail.ts            one job, live, for its own pages
└── components/              the register (toolbar, strip, table, cards, map, Gantt),
                             the new-deployment dialog, and detail/ — the job's sections

src/modules/fuel/
├── data/
│   ├── depots.ts            each estate's depots
│   ├── depotTank.ts         each depot's level walk, and `reconcile` / `varianceSeverity`
│   ├── fills.ts             every genset fill, and whether a depot or a truck gave it
│   ├── trucks.ts            each estate's fuel trucks
│   └── truckRuns.ts         each truck's loads, stops and short loads
└── …                        the tabs (index.tsx, FuelNav, ViewSwitch), the depot page,
                             the Genset fills table, the trucks view and the truck log

src/modules/service/         the fleet's service standing and history
src/modules/reporting/       the three CSV exports
src/modules/settings/        the brand picker
src/modules/site/            the site data the rest reads: seeds and overrides, regions,
                             power roles, monitoring units and plant alarms; the site
                             screens and several data files are unused and kept
```

### The rules that hold the graph together

**`data/siteSeed.ts` imports almost nothing** (the brands, its overrides and types),
and that is structural rather than tidiness.
`sites.ts` needs it and so does `genset/data/deployment.ts` — which needs to know where a
yard is, so a job going active can move its machines there — and `sites.ts` reads the fleet,
which reads placement, which reads the deployment record. Leaving the seed inside
`sites.ts` closes that loop; pure data at the bottom of the graph breaks it.

**The deployment record is dealt lazily, and that is load-bearing.** The deal reads the
fuel ladder, the ladder is derived from a machine's detail, and placement — which the
record produces — is what `detail.ts` used to read to answer *where is this machine*. That
circle is fine as a set of imports and fatal as an order of execution: dealing at import
time called into `history.ts` while `detail.ts` was still initialising, and recursed until
the stack gave out. Two rules came out of it and both are worth keeping: **nothing in
`deployment/data/` computes at module load**, and **`history.ts` and `fuelIntegrity.ts`
read the seeded row** through `seededGenset()` rather than the deployed one, because
nothing they need is touched by placement. `siteOverrides.ts` is under even that: it imports no
site data at all, because `siteSeed.ts` has to read it and `siteConfig.ts` reads
`siteSeed.ts` to know a site's default.

**Three stores are neither seeded nor derived** — `siteConfig.ts` (the power role),
`siteOverrides.ts` (a site's own facts), `deployment/data/store.ts` (the jobs),
plus the alarm, service and note stores beside them. All hold **overrides only**, so a
fresh browser renders the estate as its dataset states it and clearing site data restores
it. Site summaries are memoised on the deployed fleet's identity rather than built once at
module load, and that stays safe because `buildSummary` reads no clock at all.

**`data/detail.ts` is worth reading if you are changing numbers.** It is built on one
rule: **nothing is stated twice.** Every figure is either a given (tank level, run state)
or derived from a given through a stated relationship, so the run's energy, its fuel burn,
the consumption rate, the refuel date and the tank runway all move together and none can
contradict the others. Per-unit variation is a hash of the genset's id, not
`Math.random()`, so a unit looks the same on every render and every reload.

**`data/history.ts` applies that rule to time**, and it is where the analysis section's
credibility lives. Nothing there is a recording; it is a *consistent* invention. Every
series is generated backwards from the value `detail.ts` already publishes and eased onto
it at the right-hand edge, so the chart's last point and the home page's gauge are the same
number. The run log's newest entry **is** `detail.run` — the same object — and every
earlier run costs its fuel through the same curve the home page uses, so any row in the log
can be checked with a calculator. Fuel level is integrated from the burn rate rather than
wobbled around a mean, because the slope of a tank is a quantity somebody reads off the
chart to plan a tanker.

**`data/sites.ts` follows the same rule one level up.** Only a site's *givens* are seeded.
Membership comes from the gensets naming their site; its draw, capacity and fuel are
summed from them. (`sites.ts` is unused since the site pages went; the rule is kept.) There is
no stored site figure to drift — and since 2026-09-14 no site *verdict* either: what is
wrong with a yard is the alarm queue, counted in `siteAlarmQueue.ts`, not a roll-up
stored on the summary.

**`data/hybrid.ts`, where the hybrid energy model met the run log, is gone** with the
solar and battery plant.
