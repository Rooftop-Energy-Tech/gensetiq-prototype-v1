# How telcoiq works

What the product is for, the concepts it is built on, and how the screens fit
together. Read this before changing behaviour — most questions about "should it do
X" are answered by one of the rules below rather than by taste.

For what is *implemented* versus mocked, and for how the brands and the build are
wired, see the [README](../README.md).

---

## The job

A **site** is a piece of network infrastructure that has to stay up: a tower, a
switching centre, a substation. It has a load, and something has to feed it. On
this estate four things do, in combination — the grid, a diesel genset, a solar
array, a battery bank — and which of them a site has is the single fact the whole
app organises itself around.

Someone has to know, across a few dozen of them:

- which sites are **at risk** right now, and which of them needs a person sent;
- what **carried the load** — grid, sun, storage or diesel — and what that cost;
- how much diesel is left, and when a tanker has to be booked;
- what each machine has been doing, and what is about to break.

telcoiq answers those four questions. Everything in the app is one of them.

The first two are the pair that separates this product from a genset monitor. A
controller reports its own output and knows nothing about the array on the roof
beside it, so "what carried the load" is a **site** question that no machine on the
site can answer. That is why the site, not the genset, is the top of the model.

---

## The estate, and whose app this is

The product is one build, and the customer is **configuration**. `VITE_BRAND` picks
it; `src/brands/` holds everything a brand may change.

A brand owns *whose app this is* — the name on the door, the mark on the rail, four
colours, and which estate the demo walks through. It does **not** own the product
model. That line matters because it has already been crossed once: an earlier fork
shipped a two-role power vocabulary (`STANDBY` / `PRIME`) and the estate that needed
hybrid plant replaced it with four. Reviving the two-role version as "the utility
way" would fork the model in config instead of in git, and every hybrid feature
would be dark on that brand. So the utility dataset is **re-expressed in today's
model** rather than restored. The vocabulary is the product's; which sites use which
entry is the dataset's.

**Identity and dataset are separate axes.** A brand *names* a dataset rather than
containing one, because datasets are the expensive half and the pairing is not
one-to-one — the unbranded build shows the carrier estate under product colours,
since what it is for is showing the product without a customer's name on it, not
inventing a third estate.

| Brand | Estate | Sites | Sets |
| --- | --- | --: | --: |
| `celcomdigi` | carrier — a tower network | 25 | 30 |
| `sesb` | utility — a distribution network | 25 | 37 |
| `gensetiq` | carrier, under product colours | 25 | 30 |

A build carries only the brands it is allowed to show: the registry is generated per
build, so a customer's deployment has no other customer's name, mark or site names
anywhere in it — not behind a flag, absent. The Settings picker keys off the same
list, so the gate and the bundle cannot drift apart.

Two groupings come with an estate, and they are **different axes** rather than two
names for one:

- A **region** (a carrier's network regions, a utility's distribution zones) is
  where the site *is*. Geography settles it and an operator gets no say. It is also
  where `peakSunHours` lives, because the sun is a fact about the place and putting
  it on each site would be twenty-five copies of six numbers waiting to disagree.
- A **programme** is a line the operator draws for their own reasons — a funding
  round, a conversion campaign. It is a grouping and *only* a grouping: no figure,
  no diagram, no default, no behaviour derives from it.

The two happen to line up on the carrier estate, where the programmes are
state-scoped, and that coincidence is exactly why four sites are in **no**
programme: without them a reader would reasonably conclude that programme is a
second name for region and start expecting one to imply the other. Unassigned is a
first-class answer, not a gap — sixteen of the utility estate's twenty-five
substations are in no programme, because they are not *work*, they are the network.

A region owns **sites**, and a genset takes its region from the site it stands at.
An id seeded onto each machine would be a second copy of a fact the site already
states, and detaching a set would leave a machine in the workshop still claiming a
region. The consequence is deliberate: a set fitted nowhere has no region, and the
summary cards count it under `Workshop` rather than inventing an owner.

→ `src/brands/types.ts`, `src/brands/datasets/`, `src/modules/site/data/customers.ts`,
`src/modules/site/data/programs.ts`

---

## The model

Twenty-one concepts. They are small, and the constraints between them are what keep the
screens honest.

### Site

A **place with a load**, and the plant standing on it is a property of the site
rather than the other way round. One or more sets, an array, a bank, one changeover,
one thing being kept alive.

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
a site reports — installed capacity, fuel on site, condition, its hybrid plant — is
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
a few hundred, so "is 216 kW a lot here" has no answer without it.

→ `src/modules/site/types/site.type.ts`, `src/modules/site/data/siteSeed.ts`

### Power role

**How the yard is fed** — the site's most load-bearing given, and the one that
decides which circuit the site page draws:

| Role | The bus carries | Battery | Array |
| --- | --- | :-: | :-: |
| `GRID_BACKUP` | a mains incomer, gensets behind it | — | — |
| `DIESEL_PRIME` | gensets only, continuously | — | — |
| `DIESEL_HYBRID` | a bank the genset charges in blocks | ✓ | — |
| `SOLAR_HYBRID` | sun by day, bank by night, genset as backstop | ✓ | ✓ |

`DIESEL_HYBRID` is the conversion this estate is in the middle of: rather than
idling all day at the 4 kW a tower draws, the same machine runs in blocks near its
efficient loading to recharge a bank. Fewer engine hours, less diesel, same supply.
`SOLAR_HYBRID` adds the array and keeps the genset — that is the point, it is a
hybrid and not an off-grid site.

**It is a display choice, and only a display choice.** It selects a layout — which
sources the single-line diagram draws onto the bus — and nothing else depends on it.
`isolatorStateOf`, the changeover, `defaultDutyId` and every control pad behave
identically under all four.

That boundary is deliberate rather than a shortcut. A control that redrew a diagram
*and* quietly changed which sets could take load would be two operations wearing one
label, and the second would be a command this prototype has no business issuing. One
visible consequence of holding the line: a set's history is the **machine's**, so at
a site declared `SOLAR_HYBRID` a run may still read "Engine started on utility
outage". The role redraws the yard; it does not rewrite what the controllers did.

Three predicates read it, and they exist so the question is asked in the reader's
words rather than as an equality: `hasMains`, `hasBattery`, `hasSolar`. Three of the
four roles have no incomer, and the day a grid-tied hybrid joins the list `hasMains`
is the only line that changes.

Changing a site's role is one of the things its [Settings section](#the-sites-other-sections)
does, and the choice lives in `localStorage` because there is no backend to put it
in. Every site's default is its dataset's, so a fresh browser renders the estate as
seeded.

### Genset

A physical machine: an asset tag, a model, a location, a tank, and a **run state** —
`RUNNING`, `IDLE` or `OFFLINE`.

Those three are the whole of what a genset reports about itself, and `OFFLINE` is
one of them rather than a second axis beside them. It means **the panel has stopped
reporting** — we do not know what the engine is doing, which is a worse position
than knowing it is stopped, and it is why an offline unit carries the comms alarm
and no other: a panel that isn't talking cannot also be telling you its oil
pressure.

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

The cost of it is worth stating, because it is the thing to revisit first: **a fourth
set arriving in week three cannot join an existing job.** It needs a successor job,
which splits one hire into two records. If that turns out to be how Express Mission
actually work, the two dates move onto the membership and nothing else changes.

A membership carries the **lorry plate** that took that set out, the tank level at
each of its own edges, and a `collectedAt` for the one case that needs a date: a set
pulled out early while the job runs on. The live level during an open posting is
*derived* from telemetry rather than stored.

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

### Hybrid plant

The array and the bank at a site, **and what the last thirty days did with them**.

This is the concept the genset module cannot supply. A controller reports its own
output; nothing in it can say what fraction of a site's month came off a roof. So
the plant is a site-level model, and it exists to answer *what carried the load*.

**Everything in it is derived from four givens:** the site's load, its power role,
its region's peak sun hours, and the genset's own fuel curve. Nothing about the
plant is seeded separately, and that is deliberate rather than economical — a seeded
PV size and a seeded solar share can disagree, and the first thing a reader does
with a hybrid dashboard is check whether the second follows from the first.

So the chain runs one way only, and every figure on a hybrid site's page is a link
in it:

```
load → daily energy → array size → generation → what the genset still owes → litres
```

**The fuel arithmetic reuses the genset's own curve.** `sfcLitresPerKwh` is the
module-wide statement that a diesel burns worse the lighter it is loaded, and it is
what the run log, the tank ladder and the current-run card all cost their fuel with.
Reading it here too — at the loading a genset actually holds, rather than at a flat
litres-per-kilowatt-hour — is what keeps the litres this module reports and the burn
rate a genset's own page shows from drifting apart. A second constant here would
have made the estate's headline figure the one number that reconciles against
nothing.

**There is no counterfactual.** The chain used to run one link further, into what
the same site would have burned on diesel alone and what that was worth in ringgit.
That comparison has been taken out and will come back as its own thing; what is left
is a measurement of what happened, with nothing under it claiming a saving.

**The seam, stated rather than hidden.** This is a *site* model and the run log is a
*machine* model, and the two are not reconciled. `history.ts` deals every genset a
run log from a hash of its id — it knows nothing about arrays or banks — so a
solar-hybrid site's genset has a history in which it ran like any other machine,
while the thirty-day figures here say it barely ran at all. Reconciling them means
the run log becoming a function of the site's configuration, which is the right
shape and a larger change than this white label. **Until then the rule is that the
two never appear on one screen:** the site pages and the energy figures read this
module, the run log and the tank chart read `history.ts`, and no figure is derived
from both.

→ `src/modules/site/data/hybrid.ts`

### Solar system

**Everything PV at one site, taken together — and the only level this module has.**

There was a level below it, and it was an inverter: a box with a serial, a comms
link, a control pad and a page of its own. It is gone, because these are telco
sites. A tower runs a −48 V DC bus and its loads are DC, so the array feeds the bus
directly; there is no AC stage anywhere on the site for an inverter to make, and a
page describing one was describing a box that is not in the cabinet.

What went with it is worth stating plainly, because it is a real loss and not a
tidy-up: per-box state, so a plant is now reporting or silent as a whole rather than
four-fifths visible; the per-box control pad; and the insulation-resistance rule,
which was an inverter's own earth-leakage interlock and so had nothing left to
measure it.

**Strings survive the boxes.** A string is modules in series, a physical run on the
roof, and it is a fact about the array whatever it terminates in — which is why
`string-out` is still a health rule and still the most useful thing this module
says.

A system reports one of three states, and the parallel with a genset is exact on
purpose: `GENERATING` is `RUNNING`, `IDLE` is `IDLE`, `OFFLINE` is a plant that has
stopped talking. An operator who has learned the fleet screen's state column has
already learned this one.

Two states were drafted and cut, and both for the same reason:

- **`CURTAILED`.** An off-grid system does spill, and `hybrid.ts` caps generation at
  what the site can absorb and says so — but that cap acts on a *thirty-day total*
  and nothing in the model resolves spill to a moment. A state the page could show
  but not derive is the worst kind of lie: the one where the header disagrees with
  the chart under it.
- **`FAULT`.** A system with a string down is still generating, at three-quarters of
  what it should. Folding that into the state would either hide it — `GENERATING`,
  as though nothing were wrong — or overstate it, `FAULT` on a plant making most of
  its number. It belongs in the alarm queue, as the derived `Strings offline` row,
  where it can carry the date it started
  and the energy it has cost since.

→ `src/modules/solar/types/system.type.ts`

### Battery bank

**The storage at a site, taken together** — the same unit argument the solar system
makes. Nobody says "we have four hundred and twelve battery modules"; they say
"SBH-1495 has sixteen hours of autonomy". The bank is what is specified, quoted,
commissioned and what fails; a module is a part inside it, and a register with a row
per module would be a stores list rather than an estate. There is one BMS, one
converter and one state of charge, so the bank is the leaf and `modules` is a count
rather than a list of things with identities.

**Nothing about a bank is seeded.** `hybridPlant` sizes it from the site's load and
the autonomy its configuration is specified at, and `hybridState` says where its
charge stands. That is what stops the diagram's `88% charged`, the site page's device
row and the bank's own page from being three numbers that can disagree.

A bank carries **two percentages**, and they are never printed side by side because
the second reads as a version of the first:

| | |
| --- | --- |
| **State of charge** | where the level sits in the tank right now |
| **State of health** | how big the tank has become after some years of cycling |

A bank can read `100%` charged and `81%` healthy at the same time and both are true.
The specified capacity is **not** discounted by health — the pair is what makes fade
visible instead of it quietly shrinking every other figure on the page.

The same doubling applies to autonomy: the **specification** assumes a full, healthy
bank, and **hours left** is what is actually there from here. Both are on the page,
because the gap between them is the bank's condition stated in the only unit an
operator acts on.

→ `src/modules/battery/types/bank.type.ts`, `src/modules/site/data/hybrid.ts`

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

**A number, and two lines drawn on it.** The panel sends a level; the app compares
it with the tank's capacity and files the result. Two thresholds, both fractions of
capacity:

| Line | Fraction | What it means |
| --- | --- | --- |
| Reserve | `0.30` | Below it, a tanker has to be **booked** — a job with a lead time |
| Empty | `0.10` | Below it, the set gives **no cover** — it cannot pick the load up |

`EMPTY_FRACTION` is deliberately not zero. A gauge reading exactly zero is a sensor
fault as often as it is an empty tank, and waiting for it would mean the alarm fires
after the machine has already failed to start.

**The two lines are read three ways, and are written once.** They are the fleet's
`EMPTY` and `REFUEL` buckets in the estate strip, they are the reserve line the refuel
runway counts down to on the genset's own page, and they are the alarm in the alerts
section. One pair of numbers, so a tank cannot be low on the strip and fine on its own
page.

**It is an alarm, not just a bucket.** Fuel level used to be the one
threshold-crossing reading in the app that raised nothing: a set at 8% of capacity
showed a green `Optimum` beside a dry tank, because the register map has no bit
marked for the dashboard that watches the level and the app had never drawn the line
itself. It draws it now. `Low fuel` is a `WARNING`, `Tank empty` is a `CRITICAL`,
and both move the condition verdict.

The `CRITICAL` is not the overreach it looks like next to the rule that a critical
belongs only to a set which has actually stopped. That rule is about *register-map*
criticals, every one of which is a protection that stops the engine — a running set
carrying one is a contradiction. A dry tank stops nothing; it is a statement about
cover, and a running set can perfectly well be about to run out.

**Like the leak, it must never become a register bit.** Its card prints `Tank level`
where an alarm prints its register and bit, so a reader can still tell the panel
talking from the app talking. It carries the `fuel-level` reading inside the card,
because "Low fuel" is an adjective until the litres are in the box with it. It used to
carry a link to the refuel log, on the reasoning that unlike a coolant alarm there is
something to *do* about this one and it is a booking; with no booking anywhere in the
app the card states the level and stops.

**The fleet buckets read a tank-blind verdict, and that is the one place they must.**
`gensetStatus` asks `machineCondition` — the register map and the leak, and nothing
about the tank — because it already tests the tank itself, in `EMPTY` and `REFUEL`.
Asking the wide `gensetCondition` there would say the same fact twice: every `REFUEL`
set would test true for `ALARM`, `ALARM` outranks `REFUEL`, and the two fuel buckets
those tiles exist to show would both drain into the red one.

**The lines are fixed, and not editable.** The rule the app works to: a
setpoint that lives in the panel is not editable from a screen that cannot issue the
command. These two are the app's own, so they *could* be — but they are also what the
[four buckets](#fleet-status) are defined as, and a per-genset reserve line would leave
the strip's counts working to a different definition on every row. If they ever move,
they move for the estate.

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

**Worst wins, and the four are exhaustive.** Every genset is in exactly one bucket,
so a set of counts adds up to the fleet. Overlapping buckets would give four true
numbers that sum to more than the estate, and an operator reading them as a workload
would double-count the drive.

The order is **cover first**:

| | |
| --- | --- |
| `EMPTY` | a dry tank gives no cover at all — it cannot pick the load up |
| `ALARM` | the machine has a fault, but it is a machine somebody can look at |
| `REFUEL` | below the reserve line — a tanker to book, not to scramble |
| `OK` | what is left |

`ALARM` outranking `REFUEL` matters more than it looks: a set below reserve *and*
carrying a shutdown alarm is not a refuel job, and filing it as one would send a
tanker to a machine that needs an engineer.

**Colour does not follow that ranking, and the departure is deliberate.** Hue says
what kind of job it is and lightness says how urgent: violet is diesel — the colour
every fuel figure in the app already carries — so the two fuel buckets share it and
separate on lightness; red is the machine, the same token the alarm badges use;
green is nothing to do. A bucket ranking is about which single file a set lands in;
a colour is read as a category first.

Service is counted **across** the four rather than as a fifth bucket, because it is
measured off a machine's own hour meter and its own interval — a set can be `OK`
above and still be due. It is the one figure on the estate screen that a genset can
be counted in twice, which is why it sits in its own card rather than beside the four.

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

Three destinations in the app rail, and Settings pinned to the foot. **Gensets**
leads and is the app's landing screen — the plant register, which on a fleet whose
machines move is the thing every question starts from. **Deployment** follows it:
what is out, where, and since when. **Sites** is last, because on this estate a yard
is where a set was sent rather than the subject itself. The rail's own doc comment
argues the order at length, including what a *permanent* estate would do instead.

```
/                    → /gensets

/gensets?view=split ─┐
/gensets?view=list ──┼─ the tag ─→ /gensets/<id>                        Genset
/gensets?view=map  ──┘  or panel →   ├── /analysis
                                     ├── /runs
                                     ├── /deployments
                                     ├── /service
                                     ├── /alarms
                                     ├── /equipment
                                     └── /settings

/deployments?view=split ─┐
/deployments?view=list ──┼─ the reference ─→ /deployments/<id>   Deployment
/deployments?view=map  ──┤   the site ──────→ /sites/<id>             ├── /gensets
/deployments?view=gantt ─┘   or panel →                               ├── /runs
                                                                      ├── /alarms
                                                                      └── /settings

/sites?view=split ──┐
/sites?view=list  ──┼─ the site's name ─→ /sites/<id>                    Site
/sites?view=map   ──┘   or the panel's →     ├── /alarms
                                             ├── /deployments
                                             ├── /settings
                                             └── /runs · /contract   still resolve;
                                                                     nothing links

/settings            which customer this build is
```

Sections in the rails that are **not drawn** carry a labelled placeholder saying
what they will hold rather than a dead link: a genset's `Devices`, a site's
`Alarms` and `Contract`, a system's `Service` / `Alarms` / `Settings`, and every
section under a battery bank. A destination that states its subject is how the shape
of a screen gets agreed before a table is drawn for it.

### Where the overview went

There used to be a `/overview` in the first slot of the rail, and it is worth saying
what it was and why it is not there, because the question it answered has not gone
anywhere.

It existed because the two list screens answered the wrong question first: a network
power team arriving in the morning is asking *is every site up*, *is the hybrid
programme working*, and *where are they* — and a list makes them read twenty-five
rows to find that out. It was those questions as three bands plus a directory:
readiness (the [four buckets](#fleet-status) plus a service tile), energy (thirty
days of what carried the load), a map, and a row of region links.

**The estate screen already answers all four**, which is what made the destination
redundant rather than merely small. Its card strip is the same tallies over the rows
they are counting: `Status` is the four buckets, the toolbar's grouping dropdown is
the region directory, and the map is the one that has always sat beside the list. Two
figures were genuinely only on the overview — **service due** and **solar share** —
and they came down with it, into two cards on that strip. See
[the estate register](#the-registers-list-map-and-split).

One rule of the overview's is worth keeping wherever these figures live: **every
number is a link into the screen that shows its working**, including the empty ones.
Clicking `Tank empty 0` and landing on an empty list is a complete answer, where a
dead tile makes the reader wonder whether it is broken.

→ `src/modules/site/data/estateSummary.ts`,
`src/modules/site/components/SitesSummaryCards.tsx`,
`src/modules/site/components/SitesToolbar.tsx`

### The registers: list, map and split

`/gensets` and `/sites` are the same screen over different objects, and `/solar` and
`/battery` are the flat half of it. All four are **registers**: a row per thing, a
search box, and nothing that grows unboundedly with the estate.

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

**Selecting opens the panel**, whatever the toolbar's toggle was set to. Selection
has no other visible effect — it tints a row, it recolours a pin — so with the panel
closed a click is a dead end that reads as a broken control. The toggle therefore
means "hide the preview until I next ask for one", and it never sits between the
row-click and the preview it is supposed to produce.

**The cards above the table are counts that double as filters.** Showing a number an
operator cannot act on is half a control, so each count is a toggle: click `Low
fuel` and the list and the map both narrow. The counts themselves do not move when
you do, so the strip stays a picture of the whole fleet while the list answers a
narrower question. Nothing there invents colour — a count carrying a verdict gets
the same token the badge two rows down uses.

**The estate strip is not four groupings, and that is where the two screens part.**
The fleet's four cards are four ways of slicing the fleet. The estate's four say what
the estate *is* before offering to narrow it: how many sites, what needs doing to
them (`Status`), what is `Due for service`, and how the hybrid programme is going
(`Solar share`). The last two came down from the overview when it went, and they are
the only figures in the app that state either.

Those two are drawn as **anchors, not chip cards**, because a count that narrows this
list and a count that leads to another screen must not look like the same control.
Each is a link over its whole card with the arrow every other way-out here carries —
service to the fleet register already filtered to `due`, solar to the array register.

**Three of the estate's filters are dropdowns in its toolbar**, not cards: supply,
region and programme. They are *attributes* — a reader either wants one of them or
does not — and the counts beside them are context rather than an answer, so they do
not earn a card's width. Three that did cost a card's width each left the strip on
two rows. `Status` stayed a card because its **distribution is the information**:
thirteen alarms beside nine clear is a fact you read at a glance, and a dropdown
would put the estate's readiness behind a click.

That also puts search, filtering and view in one line and one order — narrow by text,
narrow by attribute, choose the shape — where two of the three used to be a card row
apart. The fleet register keeps all four of its groupings as cards; it has no
`Status`-shaped exception to make and no figures to carry.

The filters are the questions each register gets asked. The fleet's: whose set,
what it feeds, what needs doing to it, and whether it is due for service — the last
being where the estate strip's `Due for service` card lands. The estate's: whose site,
which programme, how it is fed. `Workshop` is one of the fleet's role filters, because a
set fitted nowhere is a real answer rather than a missing value.

The whole view state lives in the URL, so any state is linkable and Back steps
through it:

```
/gensets?view=map&q=sabah&id=brf9540&panel=true
/gensets?status=EMPTY&view=list
/sites?view=split&program=jendela-swk
```

**Assets name themselves by their site, and the prefix is no longer uniform.** A bank
reads `SBH-1495`, an array `Solar | SWK-0559`, a set `WPKL-0207` on its register and
`Genset | WPKL-0207` on its own page. The four shared one shape — asset, then code —
until 2026-09-14, when the battery's prefix came off: every place the name is drawn
already says `Battery` louder than the word did — the rail item is lit, the breadcrumb
reads `Battery ▸ …`, the register's column is headed `Bank` — and on the register it
cost the column its left third.

**The genset took half of that, and the split is the point.** Its register drops the
prefix — the column is headed `Genset name`, the page `Gensets`, and thirty rows of
`Genset | …` under it is the header read once per row — and all three of the
register's renderings drop it together, because the table, the phone cards and the
preview panel are one screen. Its **detail page keeps it**: a set, a bank, an array
and a cabinet standing at one site all take that site's name, so `SBH-1336` alone
would title four different pages identically, and the rail a reader is sitting in
lists all four. `gensetName` and `gensetSiteName` are the two, one line each, and the
note on the second is where the line is drawn. The battery does not make that split —
it is bare everywhere — so the two assets read differently on their own pages, which
is the open end of this.

⚠️ **A set is named by its site, which five sites cannot answer uniquely.** The genset
tag — `BRF9540` — is fixture data rather than a recorded name, so the label falls back
to where the machine stands. Five sites on this estate hold two sets, so five pairs of
rows read alike. The rows are still distinct objects, keyed and linked by `genset.id`,
and the tag is still what the search box matches; `gensetName` is one line and carries
the note.

**The fleet list drops two columns beside the map.** `Location` and `Last updated`
are drawn on the full-width list and dropped on the split view, where both truncated
to the half that carries no meaning — `Bangsar S…`, `1 hour …`. The solar register
drops `Capacity` and the estate list drops `Fuel on site` the same way.

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
was not in the data model; a planned job is, so the window runs to the last thing
booked, `now` gets a rule down every lane, and a standing job quoted to a future date
carries a dashed tail from today to its agreed end. It is still **not a planner**:
nothing drags, nothing schedules, and no bar can be moved, because dispatch is a lorry
and a phone call and this screen is the paper trail those leave.

The timeline also ignores the table's ordering, deliberately — sorting lanes by fuel
burned would put a machine's chain at a vertical position that means nothing against
a time axis — so the toolbar's sort dropdown is withheld there rather than left on
screen doing nothing.

**The strip counts jobs, not things.** The registers count what exists; this counts
what is happening, so the headline is two figures — machines out, and yards occupied —
which are not the same number when two sets stand at one substation, with a third
clause for machines *committed* to a job that has not started. The three chips are the
three states a job can be in, and they filter all four views together. Typical job
length and the diesel the record burned sit beside them because they are the two
figures nobody can read off the list.

**Closed jobs are drawn on the map as well as standing ones.** A map of only what is
out would be smaller and cleaner, and it could not answer "have we had a set at Kapit
before" — which is the question asked before quoting one. The `Deployed` chip is one
click away for anybody who wants the smaller map. A pin's size says how much plant is
on the job, which is the sites map's own channel and the question this map is asked
next.

**The columns are the job's facts.** `Deployment` (the reference over the yard),
`Status`, `Gensets`, `Window`, `On load`, `Fuel burned`. `Lorry` left the table with
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
| `Settings` | the reference, the yard, the dates, and the two acts that end it |

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

**Close and delete are different acts.** Closing ends a standing job now: the window
closes, the machines leave the yard and none of them moves. Deleting is offered on a
*planned* job only, because a job machines have actually stood on is a fact about the
world and the app does not offer to unmake one.

→ `src/modules/deployment/components/detail/`

### One thing's rail

Every detail page — a site, a genset, a system, a bank — sits beside a 240px rail
scoped to that one thing. It replaced a tab strip across the top of the page, and
the reason is worth recording because it is not about width.

The strip had run out of **levels**. A site's sections were five tabs; the plant
standing on that site was reachable only by scrolling to the bottom of the home page
and clicking a name. So the two things an operator does here — *change section* and
*go to a machine* — were answered by two completely different gestures at opposite
ends of the page. A vertical rail answers both with one list, because a list can nest
and a strip cannot: `Asset ▸ Genset / Solar / Battery` is a section of the same nav
that holds `Site` and `Alarms`.

**The rail only offers plant the yard actually has.** Drawing all three rows
everywhere would put a `Solar` link on a diesel-prime site with no array — a door
onto a page that can only say "nothing fitted". `Genset` goes to the **lead** set,
which is the one turning or the sickest if none is; the rest of the yard is reachable
from the home page's device row. A rail that listed four engines would be an
inventory, which is what `/gensets` is for.

The two rails differ only in their header and their items, and share one component so
the geometry is stated once. A site's header is a **switcher** — the design puts a
`ChevronsUpDown` on it, and it is the gesture the page was missing: moving between two
sites used to mean going back to `/sites`, finding the row and clicking it, three steps
to compare two yards during an incident. Its list is alarm-ordered, the same ranking the
sites list uses, because a separately alphabetised menu would be a second opinion about
the estate and the first thing anyone would notice is that the two disagreed. It does
not draw the counts themselves: the menu is a way *to* a site, and thirteen alarm pills
stacked in a 224px popover would be a worse copy of the screen the menu exists to save a
trip to. A machine's header is a **back card** to the site it stands at.

Two consequences of the move are load-bearing:

- **Two of a site's five old tabs did not survive it.** `Runs` and `Contract` keep
  their routes, so a bookmark on either still works, but the design draws four rows
  and they are not among them, so nothing links to them. Each is one entry in
  `navEntries` if they are wanted back.
- **The header's info tooltip went, and nothing was lost.** It carried Load, Supply,
  genset count, installed capacity and fuel on site; the first three are now a band
  on the page itself and the rest are in the metric strip and the device rows. A
  hover that restated visible figures was the weakest part of the old header.

→ `src/components/global/DetailSidebar.tsx`

### The four home pages, and the bands they share

A site, a genset, a solar system and a battery bank each open on the **same bands in
the same order**, and that is the design decision the whole detail half of the app
rests on. An operator moving between a tower's genset, its array and its bank finds
the same things in the same places, and the pages differ only in what they are
*about*. Three pages that each invented their own shape was the thing this design set
out to fix.

| | Band | Shared component |
| --- | --- | --- |
| 1 | **The strip** — the two or three figures that move, then the alarm counts | `MetricStrip` |
| 2 | **What it is doing now** — the dials, the gauge, or the circuit | — |
| 3 | **The chart** — one metric, a day stepper, a period control | `TrendPanel` |
| 4 | **The details** — what the thing *is*, nameplates only | `DetailBand` |

Pages carry **four or five** of those, and the variation is the model's rather than
the page's: a genset splits band 2 in two, because its live dials and its run totals
are the same subject read at two speeds. Nothing is dropped for want of room, and
every missing band has a rail section of its own saying what it will hold.

**There was a fifth band: *what is wrong* — the rules, and the numbers behind them.**
A genset carried it and so did a solar system; a site and a bank never did. It is on
each asset's **`Alarms` section** now, above the standing and cleared tables, and the
move is the same argument the site page made when it took its device stack off the
foot of the page. A band that restates the strip's alarm counts nine hundred pixels
below them is a second answer to a question the top of the page has already answered,
and a reader who wants the detail wants the log beside it — the row that says whether
anybody has acknowledged the thing the card is describing. The strip's alarm pill is
the one click from here to there, and it always was.

**Every band is full width, because only one thing on these pages has a natural
width.** The diagram is a fixed canvas, the figures are short, the chart wants
everything it can get. An earlier arrangement put a summary beside the diagram and
the devices in a row of cards, and it left two ragged holes down the right at any
site with fewer than three devices — which is seventeen of the twenty-five. Bands
never have a leftover column to fill, so device count changes the page's *height* and
nothing else.

**The strip's third column is always the alarms**, and that is the one column every
page can fill: generation exists at a system, fuel at a genset, charge at a bank, and
none of them anywhere else. Pinning alarms to a fixed column is what lets a reader
moving between the three know where to look before reading the labels. It is equal
thirds rather than content-width columns for the same reason — a strip whose columns
move between pages stops being a reference line, which is most of what a strip is for.

**The details band is the facts that do not move.** The strip carries what changes and
a reader checks it to decide whether anything needs doing today; these are nameplates
and identity, and their job is to tell you what you have just been looking at. Mixing
them would put two rates of change in one line. It splits into two columns off a
**container query** rather than a breakpoint: these bands sit inside two rails that
take 480px between them, so a `md:` split would fire at 768px where the band is 288px
wide. The split is column-wise — the left column is the first half of the list — so
the two-column version is the one-column version cut in half rather than a different
reading order.

**A page only offers what is fitted.** A yard with no array has no `Solar generation`
option in its chart picker rather than one that draws a flat zero; a grid-backed site
with no set has no fuel figure in its strip. Printing `0 kWh` under `Generation today`
at a site with no panel on it reads as an array that made nothing rather than as a
site that has none.

→ `src/components/global/MetricStrip.tsx`, `src/components/global/DetailBand.tsx`,
`src/modules/site/components/TrendPanel.tsx`

### The genset home page

Where a click into a machine lands. **Five bands, and the order is the order the
questions get asked.**

**Band 1 — the strip: fuel level, fuel remaining, service.** Two diesel and one
service, and the pairing is the point: the tank says how much is there, the runway
says when that stops being true, and the service counter says whether the same trip
has a second job on it. A lorry to an interior site is a day and a four-figure sum,
so the questions this strip answers are the ones that fill it. All three survive a
stopped engine, which is what a summary has to do — the tank is the tank whether or
not the engine is turning, and a set sitting idle is exactly the one whose service is
quietly going overdue.

The design's `Generation today` is deliberately **not** here. It lives in band 4,
where a day stepper and a period control put it beside yesterday and the week. On its
own in a strip it invited a share-of-site reading this page cannot honestly give: an
engine's output may go into a battery and come back out tomorrow, so what fraction of
*today* it carried is a question about the site's day, not the machine's.

**Band 2 — the live dials, and the controls that act on the circuit they read.** Five
gauges — frequency, active power, oil pressure, coolant temperature, charge alternator
voltage — plus the three line voltages and three phase currents as bar groups, and the
control pad on the right.

Frequency sits there rather than engine speed, and they are one measurement: on a
four-pole 50 Hz set 1500 rpm *is* 50 Hz, as the `Speed & frequency` tag says, and of the
pair frequency is the one the load actually sees. Every face is scaled to put the healthy
value near mid-scale and keep the alarm limits on the dial — a reading whose working band
occupies a fifth of its scale is a reading whose drift is invisible, and drift is the whole
diagnostic value of a live dial.

The pad is on the right, which reverses what this band used to do. The readings are
what the band is *about* and what a reader scans; the pad is a thing you reach for
having decided something, and a control column between the page's edge and its own
subject was making the dials start a third of the way in.

The phase bars are drawn from zero and grouped by quantity because the point is the
**comparison** — an imbalance across phases is a real fault (a dropped conductor, an
unbalanced load) and it shows up as three bars of different lengths before anybody
reads a number.

**When the engine stops, the dials are replaced rather than emptied.** `StandbyPanel`
takes their place beside the pad, and it is not a placeholder: the readings that
survive a shutdown are the pre-start ones — battery voltage, coolant temperature,
fuel — and they are what the pad's question, *start it?*, actually turns on. A row of
dials pinned at zero says less than one line of text saying the engine is stopped, and
it invites the reader to wonder whether the page is broken.

**Band 3 — the run, the day, and the tank.** The run card carries two columns — this
run, and everything since midnight — so the band reads at three horizons without
gaining a third card: what one start did, what the day's starts did together, and how
many more starts are left in the tank beside them.

The load badge is present *only* while the engine turns. A stopped genset has no load,
and "0 kW" would read as a genset running into an open breaker — a real and quite
different problem.

The fuel runway counts down to a **30% reserve**, not to empty. Empty is not a number
anybody plans against: a set that runs its tank dry picks up air in the fuel system
and needs bleeding before it will restart. `hours to 30%` and `Refuel by` are the same
quantity in two units — litres-above-reserve ÷ burn rate — one for a shift and one for
a schedule, so they cannot disagree.

A **stopped** set states its runway differently, and has to. The same arithmetic is
still the runtime it would get if you started it, but a *date* would claim the tank is
draining while the engine sits idle. So a stopped set shows runtime and no date, and
labels its rate as the one from its last run.

**Band 4 — what this engine has put out over time.** The shared `TrendPanel`, held to
one metric: diesel output. An undeployed set has no chart at all rather than a flat
line — it has made nothing today because it is not wired to anything, and a plot of
that would be claiming a measurement.

**Band 5 — what the machine is.** The `DetailBand` all four detail pages share, and
identity is deliberately all it holds: which machine this is, what it is, what size it
is — the rows a person needs to order a part, brief a technician or find it in a yard.
Rating is among them because it is also the denominator of every load figure in the
bands above.

Under the chart rather than over it, which is the order all four detail pages keep:
nothing in this band changes between one visit and the next, so it is what a reader
consults having already read the live bands. It used to sit between the fuel panel and
the runtime trend, wedging a block of nameplates between two bands read together.

The frame puts the *site's* `Supply` and `Installed capacity` here, which is the site
page's band copied across. A genset page stating how the yard is fed would be the
machine answering a question about the yard, and the rail's back card is one click from
the page that does answer it.

**There was a sixth band: what is wrong** — the condition verdict, the filter chips
and the alert cards. It is on the [`Alarms` section](#the-gensets-remaining-sections)
now, over the two tables, and the reasoning is in
[the shared bands](#the-four-home-pages-and-the-bands-they-share). The page ends on
its details band.

**Where the activity feed went.** Nowhere; it is gone, as it is from a system's page.
It closed the page as a band below the alerts — a list of things that had already
happened, with a text field for adding another — and it was the page's only
backwards-looking band,
which is why it was last and why nothing above it moves now that it has gone.
Everything it showed is owned by a section of its own: runs on `Runs`, services on
`Service`, and deliveries on the tank chart.

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
/sites/wpkl-0207/runs?window=7d
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
cannot issue the command.** The tank's reserve and empty lines are the app's own so they
*could* be editable, but they are also what the [four buckets](#fleet-status) are
defined as, and a per-genset reserve line would leave those counts working to a
different definition on every row. If they ever move, they move for the estate.

**`Devices`** is the one section here that is not drawn: nameplate data, the controller
and ATS fitted, and the service schedule. It is named `Devices` in the rail and
`equipment` in the route.

### The site home page

Four bands, and this is the page the shared grammar was drawn against.

**Band 1 — the strip.** `Supply`, the plant figures, `Site draw`, `Alarm`. Supply
leads because what is feeding the yard is the fact every other figure on the page is
conditional on, and it is the one column every site can fill — including a site being
fed by nothing. Site draw closes the readings: the only figure about *the tower*
rather than about the plant standing beside it, and where the DC bus reading hangs,
as `4 kW (53.4 V · 75 A)`.

**The plant figures are drawn, not chosen.** The design names `Generation today` and
`Fuel level` and the strip now carries both, which it did not until 2026-09-14 — it
picked one of them. What has not changed is the rule underneath: neither figure
exists everywhere. A diesel-prime yard has no array to have generated anything, and a
grid-backed site with no set fitted has no tank, so each is drawn only where the plant
behind it is fitted. A site with neither runs three columns, and falls back to
`Battery left` where a bank is the only thing standing.

So the strip is **three columns wide to five**, against a fixed three everywhere
else. That is the cost of the design's pair and it is paid on this page only: the
asset strips — a system's, a bank's, a cabinet's, a set's — still run two readings and
the pill.

**The alarm pill closes the strip** rather than holding the third column. It was
pinned third so a reader moving site → solar → battery would find it in one place;
that rule held while every strip had two readings and stopped holding when this one
grew to four. Last is the rule that survives a strip growing. On the asset strips
nothing moved, because with two readings last *is* third.

**Band 2 — the circuit, and the device it is pointing at.** The single-line diagram on
the left, and beside it one card: the detail of whichever piece of plant the reader has
clicked in the drawing. The diagram is still the only part of the page that is not a
card — it sits on the canvas, so it reads as the page's own subject rather than as
another panel — and it is still the one thing here that is a fact about the *yard*
rather than about a machine in it.

It is also the page's **navigation**. Clicking a `GENSET` box puts that set's card in
the right-hand column and the box takes a ring to say which one is showing; clicking the
drawing's **background** puts the selection down again and the column returns to the
site's own figures, which is the state the page opens in. `MAINS` and `LOAD` are not
clickable, because neither is a device on this estate's books and neither has a card
behind it.

**The drawing was removed and is back.** It came out when the telco plant did — the
argument was that a circuit of an incomer, a bus and a set is a DC-plant picture, and
that the isometric plant scene answered the same question better by drawing the compound.
Then the scene came out too, because a mast and a row of equipment cabinets draw a *telco
site* and this product posts a genset to a yard. What was left in this band was a row of
pill buttons — `Site`, then one per set — which is an honest control that draws nothing.
The schematic is the projection that survives the change of product: an incomer, an
isolator, a set and a load is the electrical truth about a compound whatever the compound
is for. Tristan's call, 2026-09-21. It is back stripped to what this product has —
mains where the role has one, one row per set, the load — and the pills are gone with the
`Site` pill's job handed to the background click.

The cards were band 5 — a stack of full-width rows at the foot of the page — and the
move is the same argument the details' move made, one page further on. The stack was a
second mention of what the diagram had already drawn, 900px below it with a chart in
between: the page said "this genset is carrying the site" at the top and "here is that
genset" at the bottom, and nothing joined the two but the reader's memory. Clicking the
box is that join.

It also fixed what band 5 could not. A stack has to choose how many rows it is willing
to be, so it showed the **lead set** and carried a footnote counting the ones it was
leaving out. A picker has no such limit: the drawing already draws every set, so every
set is now selectable, and a four-set yard has four boxes with four cards behind them
rather than one card and a footnote.

Below `xl` the band folds into a column — the drawing, then its card. This page carries
the global rail *and* the site's own nav, so its content column is about 380px narrower
than the viewport: 901px at `xl`, which divides into 398 for the drawing — a fixed canvas,
so its track is sized to it exactly — and the rest for its card. One step down it is
645px, which puts the card under the 18rem where its badges start wrapping one to a line,
and there is no honest way to split that.

**Band 3 — the details.** What the site *is*, in the shared `DetailBand`: its name,
where it stands, its region, its programme, how it is fed and what is installed. Every
row is a field the Settings section edits, in the order that section presents them —
including the site's own name, which looks redundant under its own header and is not: a
reader who has just renamed a site should see the new name land somewhere that isn't
chrome.

A `Load` row naming what the installation is *for* — `Macro base station` — stood at
the foot of the band until 2026-09-14. It was the one row the design did not draw, and
it was the site's **kind**: fixed for the life of the site, the same at most of the
estate, and already the second line of the site's own row on the list that opened this
page. It is out, and the band is back to the fields Settings edits.

They sat beside the diagram until the design moved them underneath it, and the move is
right. The strip carries the figures that change and a reader checks those to decide
whether anything needs doing today; these do not move, and their job is to tell you what
you have just been looking at.

**Band 4 — diagnostics.** *"A quick preview of what is going on at the site through
graphs"*: one full-size chart with a metric picker and a period control, over the
metrics this particular yard can answer for — load, genset output, battery, solar
generation. Four stacked charts would push three below the fold and make the band a
report rather than a preview; four small ones would each be too short to read a shape
off, which is the only reason to draw a curve at all.

#### What the diagram draws

Every source, its switch, the bus they share, and the load at the end of it. Every node
is captioned in two lines — what it is, and what it is putting into the bus — and every
node that is a **device** carries the alarm pill under those two.

**The pill is what makes the drawing say where the trouble is** (Tristan, 2026-09-14).
The band already answered *what is feeding this yard*; it could not answer *which of
these boxes has something wrong with it* without a reader clicking each one in turn. Every
set's box now carries `Critical · Warning · Neutral` in the app's own pill, in the same
position on each, so the column of them reads down like a column in a table. The mains and
the load carry none: an incomer is a supply rather than a machine on this estate's books,
and nothing reports on a load.

Each set takes the union its own page takes — the controller's bits plus the monitoring
unit's `GENSET` rows — so a box and the device card it opens beside the drawing cannot
report different numbers. Two sets in one yard therefore both carry that yard's AC rows;
at a site with no incomer that AC is each engine's own output, so this is right rather
than double-counted.

**The pill is a link** to that device's Alarms tab, and **double-clicking the box opens
the device's own page** — the gesture a reader already expects from a box in a diagram. A
single click still puts the device in the card beside the drawing. That is why a node is a
`div` with the button role rather than a `<button>`: a button may not contain an anchor,
and the browser closes it at the `<a>` if you try. Enter and Space still select; the
double-click is mouse-only, and the card it opens carries the same link.

Pills are drawn on **every** device node, a quiet one included, so their absence never
becomes the signal — and a severity with nothing standing draws a dash rather than a `0`.
The settings page, which renders this same drawing twice as a preview of a power role,
passes no counts at all and gets the tighter geometry back: the pitch and the bottom
margin both open up by one pill's height only when there are pills to put there.

Only a connected, energised source gets a **kW figure**; the rest get a word
(`off-load`, `stopped`, `unavailable`, `failed`), because `0 kW` is a
*measurement*, and claiming to have measured zero at a machine that is unreachable is a
stronger statement than the page is entitled to make. The load's caption is the site's
draw, stated where the power actually arrives — and on a grid-backed site with the grid
up, that draw is the **incomer's** figure, not a genset's.

**Which sources appear is the [power role](#power-role).** A `GRID_BACKUP` site draws a
mains source above its gensets, on its own contactor. The frame has no such node — it
draws gensets only, which quietly makes every site look like it has nothing else
feeding it — and a page about *backup* power that never shows what is being backed up is
missing its subject. It is a row like any other, and that is the argument for one column
rather than a second: a bus is a bus, so every source is a row, and every measurement
above applies to each unchanged. Three sources at a grid-backed site with two sets is the
same drawing as one source at a diesel-prime site with one — taller, and not otherwise
different.

The order down the column is the order the site uses its sources in: **grid, then
gensets.** Reading it downwards is reading the control strategy.

Conductors are painted **dead runs first, then live ones**. Not cosmetic: every source
elbows onto the bus riser and runs along it to the tap, so with three or more sources
those segments overlap. In document order a dead genset could paint a grey stub over
the live mains riser above it, leaving a conductor that appears to go dead halfway to
the load. Ordering by state makes that unrepresentable.

An isolator carries two independent facts, and separating them is the whole point:

- **closed / open** — is this set *connected* to the site bus;
- **live / dead** — is it pushing power through it.

A set can be closed onto a dead bus, and that is the normal state of a healthy standby
installation: breaker made up, engine off, waiting. It is what lets the controller pick
up a mains failure in ten seconds instead of after somebody drives out. The impossible
combination is open *and* live, and `isolatorStateOf()` is the one place that is
guaranteed:

| Duty? | Run state | Isolator | Why |
| --- | --- | --- | --- |
| duty | `RUNNING` | closed, live | this is the set feeding the load |
| duty | `IDLE` | closed, dead | standby — made up and waiting |
| duty | `OFFLINE` | open, dead | we cannot hear from it, so it must be drawn as *not* contributing |
| not duty | anything | open, dead | isolated by the changeover; off-load even if turning |

That `OFFLINE` row is a safety decision, not a display one. Assuming a silent machine is
carrying load is the single error on this page that could get somebody hurt.

The **mains contactor** does not appear in that table because it does not obey it — it
has no closed-and-dead position at all. See [Mains supply](#mains-supply).

Flow along a live conductor is animated, and it is switched off under
`prefers-reduced-motion` — the conductor is already teal, glowing and terminated in
filled dots, so the motion is the one cue nothing else duplicates.

**The diagram does not reflow, it scales.** Its conductors land on the boxes at measured
coordinates, so a reflow leaves a wire ending in mid-air. It measures the box it is
handed and shrinks the whole canvas as one piece, so every coordinate survives and the
only casualty is type size. Scrolling was the earlier answer and it was worse: the load
node, the thing the whole drawing points at, started off screen.

#### What is no longer on this page

**The changeover control.** It was the diagram band's third column, and this page now
*reports* the duty set rather than offering to change it: transferring a site's load is
an operation, and operations belong on the machine's own page beside the interlocks that
make them safe. The diagram still draws every isolator's true position, and
`summary.defaultDutyId` is still the set carrying the load or the one that would if the
grid dropped now.

**One row per genset, each with its own control pad.** That was the old band 2 and it is
now the device stack, which shows the lead set and a way to the rest. The rows'
components were the genset's own — the same `CurrentRunCard` and `ControlPad` the machine
page uses — and that principle survives the move: a control pad that behaved differently
depending on which page you pressed it from would be the worst kind of divergence to
ship, because the rules about when `START` is live are safety rules.

### The site's other sections

**`Settings` configures the four things a site *is*** — what it is called and where, how
it is fed, what stands on it, and what measures it.

**Identity and placement** first, as six editable fields: name, placename, latitude,
longitude, region, programme. They are first because they are what a reader arrives to
fix — a pin in the wrong district or a site filed under the wrong rollout is a data
correction, and it is the errand that brings somebody to this section. The rule is
**givens, not readings**: what the site draws, what stands in the yard and what the tanks
hold are not here, because they are measurements and the fleet's own membership, and a
form that let a reader type a load figure would be inventing an instrument reading.

The two pickers apply on change and the three text fields do not. A `<select>` has no
half-finished state, so committing on change is exactly as honest as the radios below
it. A text field does — `5.` and `-` are both real keystrokes on the way to a real
coordinate, and committing per keystroke would put the pin at 5°N and then at 0°N while
somebody types 5.9804. So those commit on blur or Enter, revert on Escape, and say so.

**Power configuration** second, on its own and with room to explain itself. It is a given
like the six above it and unlike them in one way that matters: the others change what the
page *says* and this one changes what it **draws**. Each of the four options states both
what it asserts about the yard and what it changes on the page, because a control on a
page called Settings will otherwise be read as reconfiguring plant.

**Gensets installed** lists the site's machines with a Detach on each, and a picker to
attach more. The picker offers the **depot** first, then sets at other yards labelled
`Move from Hosp-006` — because restricting it to the depot would make every transfer a
two-step errand across two pages, while naming the source site makes it impossible to
take a set off another yard without reading that you are doing it. It states the physical
consequence too — *"Attaching moves the set to Kota Bharu, Kelantan"* — since
[deploying moves the machine](#deployment) and a picker that hid that would be concealing
the biggest thing it does.

Under all three is a **live preview**: the site's own diagram at the selected role and
current membership. Attach a set and it appears in the drawing. The choices above are
about a picture, so the picture is the argument for them.

Everything applies on click, with **no Save button**. There is no backend to save to; a
Save button would imply a round-trip, a server-side record and a rollback that do not
exist. The honest version is a control that visibly takes effect and a line of text saying
it went into this browser only. Overrides are stored as a **patch over the seed**, so a
site nobody has touched *is* its dataset's, Reset is a delete rather than a copy of
twenty-five defaults, and clearing site data restores the estate.

A site with **no gensets** is reachable, and the roles answer it differently. A grid-backed
yard still draws `MAINS → LOAD` — on the grid, no plant installed, which is true and worth
seeing. A diesel-prime yard has no incomer and no machines, so there is nothing to draw and
the page says so; the alternative is a load box with a conductor arriving from nowhere.

**`Runs` is built** — the genset module's own panel, not a site-flavoured copy. The rules
that make it trustworthy are the same rules at both levels, and a second implementation of
them is a second set to keep in step. What differs is a lane per set on the strip and an
asset column in the table, which are the same fact: a site's log has more than one machine
in it. See [the runs section](#the-runs-section). Nothing in the rail links to it — see
[the rail](#one-things-rail) — so it is reachable by URL and by bookmark only.

Two things are true only of the site version.

**Its energy figure is what the sets *produced*, not what the site *received*.** Only one
set is connected to the bus at a time, so a second set turning while isolated is off-load
and delivered nothing to the load. Summing both is right for "what did this plant do" and
wrong for "what did the customer get". The page cannot resolve that — it does not know,
historically, which set was duty — so it says which of the two it is reporting rather than
picking one silently, and the caveat travels into the CSV, where it matters more for having
no surrounding page to infer it from.

**It lists the runs of the sets standing here *now*.** A run is a fact about a machine and
a machine's site can change, so a set that arrived last week brings its whole history with
it, including runs it performed in another yard. The record that fixes this exists — see
[Deployment](#deployment) — and **a per-job run log is built**, on the job's own Runs
section; what has not changed is this page, which still pools whatever is standing here
today. Pointing it at the yard's jobs instead is the next step and needs nothing above
`SiteSummary` to change.

**`Alarms`** is in the rail and not drawn: every active threshold across this site's
gensets, pooled into one list. **`Contract`** is drawn in no frame at all and is the one
section a genset has no counterpart for — the clearest signal in the design that a site is
a **commercial** object as well as an electrical one: a genset has runs and alarms, but only
a site has an SLA.

### The solar register, and a system's pages

`/solar` is a row per [system](#solar-system), the way `/gensets` is a row per
machine: system, state, output, capacity, alarms. It was a scaffold of six empty tabs
before it was a table, and the six moved down onto a system, which is the shape
`/gensets` has always had.

There was a sixth column, `Strings`, carrying a count with `N dark` under it, and a
fourth summary card totalling the dark ones across the estate. Both went on
2026-09-14, and the preview panel's `Strings` row — `3 of 29 dark` — went with them.
A string is a wiring detail of one array: this register's job is to say *which system
needs someone*, and a dark string is not `OPTIMUM`, so the system is inside
`Attention` on the strip either way. The count is still on the system's own page, box
by box, where a reader who has decided to look at one array can act on it.

**The last column is `Alarm`, and it was `Health`.** Same slot, different question:
the verdict is this app's summary over the rows, and the counts are the rows. The
estate list moved first, for the reasons `SitesTable` gives, and the two registers
are meant to read alike. The cell is a **link** to that system's Alarms tab, and the
counts come off `solarAlarmQueue` — the array's two sources reconciled — rather than
off `systemHealth`'s derived rules alone, which would read `1` beside a tab listing
`2`. The panel beside the map draws the same cell, for the same reason it draws the
table's state badge: a row and its own preview saying two things about one array is
how they come to disagree.

⚠️ **The register is still *ordered* by the verdict**, which ranks the derived rules
only. So two rows can sit in an order their own pills contradict — a system with
three criticals off the monitoring unit below one with a single derived critical.
That is the fault `useEstateAlarmCounts` and `alarmRank` fixed on the estate list and
it is not fixed here yet; `alarmRank` over `SolarRow.counts` is the shape the answer
wants.

**A system's home page is four bands**, the shared grammar over an array: the strip
(capacity, generated today, alarms); what it is putting out now, broken out a junction
box at a time, with a `Dark` badge beside the total when the sun is down; the details;
and the chart. *What is wrong* was a fifth and is now the first thing on the array's
own `Alarms` section — see
[the shared bands](#the-four-home-pages-and-the-bands-they-share).

**Nothing on that page is a verdict.** Every figure is a measurement or a nameplate,
and the page does not hold either up against a target — there is no design figure
anywhere in this app to hold them against. A design benchmark was built and taken
out again; what is left compares the system against **itself**, which is the only
comparison the model can support: the chart's day view carries the array's own
recent normal, and the derived string rule fires on a step in its own series.

**Three health rules, and every one is checkable on the page it appears on.** That
page is the `Alarms` section, where each rule is a row marked `Derived` beside the
device's own registers, naming the rule that fired. A
genset's alerts are a register map's bits, so the app can print the coordinates and a
reader can go and check. A PV system has no such map, so each rule here had to earn
its place a different way — by being derivable from something else drawn on the same
page:

| Rule | What it says | Checkable against |
| --- | --- | --- |
| `system-offline` | the plant has stopped reporting | the readings below it |
| `string-out` | output stepped down on a date and stayed down | the month the chart steps down |
| `soiling-due` | four months since the last wash | the last wash in the readings |

Two rules went with the inverters, and the losses are the interesting half.
`inverter-offline` was a box silent while its neighbours were not — there are no
boxes, so a silence is now the whole plant's. `insulation-low` was an inverter's own
earth-leakage interlock, and with no inverter there is nothing on the site that
measures it. **A rule this app cannot derive is a rule it must not print.**

`string-out` needs a **step** behind it. A system can be quietly mediocre for its
whole life — a shallow roof, a shaded corner, an optimistic build — and that is not a
fault anybody can go and clear. What *is* a fault is output that dropped on a date and
stayed down, so the rule fires only where there is a step, and the alert carries the
month, because that is the half of it that sends somebody up a ladder rather than
into an argument.

The `Analysis` section is generation over a chosen window, as bars, with the window in
the query string so "look at the July dip" is a link. It was two charts — bars, and
the same series added up beside them — and the second was an integral of the bars
drawn next to the bars once there was no design figure to hold the series against.
**Attribution stops at *when*:** the placeholder this replaced promised a shortfall
pinned to a cause, and the model cannot separate a soiled array from a shaded one.

`Devices` holds the array — the glass, the strings, and how many of them are dark.
`Alarms` carries both sources' rows in one table — the derived rules and, where a
monitoring unit is fitted, its four `PV N Array Fault` registers. `Service` and
`Settings` are named and not drawn.

### The battery register, and a bank's pages

`/battery` is a row per [bank](#battery-bank): bank, charge, flow, autonomy, alarm,
configuration. It was the same six-tab scaffold `/solar` was, and its own note said what
the fix would be; this table is that, column for column.

**The fifth column is `Alarm`, and it was `Health`** — the last of the four registers to
make that swap, on 2026-09-14, so `/battery` now answers *what is wrong here* in the same
place and the same shape as `/sites`, `/gensets` and `/solar`. Health is the one reading
in this table that cannot change between two visits: state of health moves over years,
so the column handed back the same numbers every morning, which is why it was already
kept out of the sort. It has not left the screen — it is a row in the preview panel
beside the list, and the strip still counts the estate's banks under 85%. The counts come
off `plantAlarmQueue`, the same call the bank's own strip and its Alarms tab make.

⚠️ **A bank with no monitoring unit and a bank whose unit is reporting nothing draw the
same empty pill**, and this column cannot tell them apart — only the bank's own Alarms
tab says which, and the pill links to it. `plantAlarmsWatched` is the predicate if the
column should ever say so itself.

**The sort is still runtime, not the queue**, which is where the other three registers
rank from. Most of this estate's banks have nothing watching them, so an alarm sort would
rank a handful of rows and leave the rest tied on nothing; hours left is a reading every
bank has. The day the units are fitted more widely, `alarmRank` is the shape the answer
wants.

**A bank's home page is four bands**, not five: the strip, one dial for where the charge
stands, the details, and the chart.

⚠️ **The paragraph that stood here said "nothing in this app raises a battery alarm"** —
no cell imbalance, no over-temperature, no low-charge rule, no BMS fault — and that the
strip's zeros therefore meant *no rule has ever been written*. That was true when it was
written and is not any more: a site with a **monitoring unit** on its DC plant has
twenty-eight of that unit's registers pointed at the battery, and the bank's `Alarms` tab
lists the ones it is asserting. The strip and now the register both read that queue. What
survives of the old rule is the part that was always the point — a count here must never
be invented — and the shape the answer takes is in `battery_.$bankId.alarms.tsx`:
*nothing standing* where a unit is watching, *nothing watching* where none is.

The gauge is **charge, not power**. A system's dial is generation because what an array
is *doing* is the question; a bank's is state of charge because what a bank is
*holding* is — an operator deciding whether to send a genset out tonight needs the
level, and the direction and rate are the caption under it. Charge is also the one
reading with a natural full scale, where a converter's throughput has only a nameplate.

Every section under a bank is a placeholder. That is the same way `/solar` was stood up
before it had a register: a destination that says what it will hold is how the shape of
a screen gets agreed before a table is drawn for it.

### Settings

One section, and it switches which customer this build is.

The picker exists because the alternative was restarting the dev server. Three brands
share one build, and the thing a designer actually does with that is compare them: is
the rail dark enough behind this mark, does the amber still read on that blue, does the
estate's own vocabulary make the summary cards scan. That is a two-second loop with a
control and a forty-second one with a terminal.

It is **absent from a customer's own deployment**, because that build carries one brand.
The control keys off the number of brands in the bundle rather than off a flag, so what
is shown and what is shipped cannot drift apart. Switching reloads the page: a brand
names a dataset, and the estate is built once at startup.

### Phone width

The **two registers with maps** and the **detail home pages** lay out for a phone. They are the same routes at a narrower window rather than a parallel set of
mobile ones, so a link works wherever it is opened and the designed desktop frames are
untouched.

The line is Tailwind's `md`, 768px. Almost every decision either side of it is a CSS
class; the two that cannot be are in `lib/useIsCompact.ts`, where the *tree* differs
rather than its layout — a table swapped for cards (rendering both and hiding one would
put every row's links in the accessibility tree twice), and the map's panel inset, which
is a number.

**The nav becomes a floating bottom bar with three destinations** — Sites, Solar,
Gensets. Each is a **register**, which is the one shape that reads at 390px, and the point
of a limited bar is that everything it offers works:

- **Battery** is a judgement rather than a rule: five items is where a bar of this width
  starts squeezing labels, and of the five registers storage is the one whose page nobody
  opens standing at the foot of a tower. It is one tap away through the site.

The routes themselves are untouched and still resolve if a URL is typed or followed from a
desktop link. What is withheld is *navigation to* them, which is the honest version of
"not built yet".

**A detail page's rail has no phone form at all.** A phone sent to `/solar/kdh-0431` gets
the page but not its six sections. That is acceptable for a page you arrive at from a list
you tapped; it would not be acceptable as a destination the bar offered directly, which is
most of why the bar offers registers only.

**The registers withhold their maps and the list becomes the whole screen.** Not a
shrunken map: a 375px basemap of Malaysia puts Kapit and Ipoh within a thumb's width of
each other, so panning and pinching become the only way to read it. The cards and the
counts are what a phone is good for here.

**The estate strip folds; its filters do not.** Stacked two-up the strip is four rows
deep before the list starts, so it folds and the list takes the height back — and the
button says `Show summary` rather than `Show filters`, because that is what it hides.
The three filter dropdowns are in the toolbar above it and stay put at every width,
which is the other half of why the fold can be called a summary at all.

**The registers become cards, and the whole card navigates.** Not the table with columns
dropped: the columns that survive 390px are the ones that say least on their own, and the
fuel figure and the placename are why anybody scrolls. There is no preview panel at this
width to select into, so the table's select-versus-navigate split has nothing to be a split
between — and a card that highlighted itself and did nothing else would be the dead-end
control the panel toggle rule exists to avoid.

**The home pages needed no rewrite, because their reading order is already vertical.** The
bands are asked in sequence and the rules between them carry that, so a phone gets the same
page in the same order with each band's row broken into a column. Every child keeps its
designed size — the gauges are 153px, the phase bars 322px, the control pad 220px, all of
which fit a 390px screen. Nothing in the genset's dial band needs to shrink or scroll
sideways: the pad in particular is four **tap targets**, and a control shrunk below a thumb
is worse than no reflow at all.

The one exception is the **site diagram**, and it is the only fixed-geometry drawing left
on any of these pages. It does not reflow — its conductors land on the boxes at measured
coordinates — so it **scales**: it measures the box it is handed and shrinks the canvas as
one piece, every coordinate surviving, and the only casualty is type size (0.9 at 390px, a
9.5px caption). Scrolling was the earlier answer for it and it was worse — the load node,
the thing the whole drawing points at, started off screen. A second drawing on the genset
page used to scroll sideways beside the control pad; it is gone, and band 2 there is now
five gauges, a bar group and a pad, all of which fit 390px as drawn.

One trap is worth knowing before editing any of it. Where the desktop layout is a wrapping
row holding a fixed item beside a shrinkable one, **`flex-wrap` is the wrong instruction at
phone width**: both items "fit" on one line once the shrinkable one may shrink, and the
result is a squeezed column with its contents spilling under the fixed one — a 100px run
card under a 220px control pad. Those rows are `flex-col md:flex-row md:flex-wrap` instead.

`MobileNav` is a *floating* pill rather than a docked bar, so every scrolling page carries
`pb-24` below `md` or its last row finishes behind it.

---

## Where things live

```
src/brands/                  whose app this is, and which estate
├── types.ts                 the line between identity and the product model — read first
├── catalog/                 one file per customer: name, marks, four colours, a dataset
├── datasets/                carrier.ts, utility.ts — sites, sets, regions, programmes
├── identity.ts, dataset.ts  the two generated registries, split so colours load alone
└── selection.ts, active.ts  which brand this session is showing

src/components/global/
├── Sidebar.tsx              the app rail — five destinations
├── MobileNav.tsx            the floating bar, three registers
├── DetailSidebar.tsx        one thing's rail: 240px, nesting, shared by all four
├── MetricStrip.tsx          band 1 on every detail page
├── DetailBand.tsx           the details band on every detail page
├── SummaryCards.tsx         the card strip above both registers
├── FilterSelect.tsx         one filter as a toolbar dropdown — the estate's three
└── ComingSoon.tsx           a section that says what it will hold


src/modules/genset/
├── types/
│   ├── genset.type.ts       Genset, run state
│   ├── run.type.ts          GensetRun — one start to one stop
│   ├── telemetry.type.ts    Reading, GaugeReading, PhaseGroup, ControlMode
│   ├── alert.type.ts        GensetAlert, GensetTag, condition
│   ├── alarmState.type.ts   acknowledged and cleared — two axes, not one status
│   ├── service.type.ts      the two counters, and the document a service produced
│   ├── fuelIntegrity.type.ts the two fuel instruments, and the leak arithmetic
│   ├── fuelLevel.type.ts    the reserve and empty lines
│   ├── series.type.ts       Sample, ReadingSeries — a reading over time
│   ├── view.type.ts         the fleet register's URL state — views and filters
│   ├── analysisView.type.ts the analysis section's URL state
│   └── runsView.type.ts     the runs section's URL state, window rules and totals
├── data/
│   ├── fleet.ts             the dataset's machines — the givens
│   ├── deployment.ts        where each set is, DERIVED from its active job
│   ├── spread.ts            the one hash every mock number is seeded from
│   ├── detail.ts            everything derived from a given, incl. `ALERT_RULES`
│   ├── history.ts           the run log and the reading series, built backwards
│   ├── alarms.ts            the standing/cleared store, and who touched what
│   ├── services.ts          the service log; serviceSeed.ts is its givens
│   ├── fleetStatus.ts       the four buckets, worst-wins and exhaustive
│   ├── fleetSummary.ts      the register cards' tallies
│   ├── fuelInstruments.ts   which sets carry what, and the leak alarm's defaults
│   ├── fuelIntegrity.ts     the reconciliation, and the condition it can move
│   └── runsCsv.ts           the run log as a file somebody bills against
└── components/
    ├── …                    the register, incl. GensetsCards for phone width
    ├── detail/              the five bands, and StandbyPanel for a stopped set
    │   └── analysis/        the analysis section: picker, range, calendar, chart
    ├── runs/                strip, totals, log, posting picker — shared with sites
    ├── alarms/              the standing and cleared tables
    └── service/             the two counters, the schedule, the log, the dialog

src/modules/site/
├── types/
│   ├── site.type.ts         Site, the four power roles, mains supply, switch states
│   ├── device.type.ts       which device band 2 is showing — a genset, the array, the bank
│   └── view.type.ts         the estate register's URL state
├── data/
│   ├── siteSeed.ts          the dataset's sites, with overrides applied
│   ├── siteOverrides.ts     what a reader has changed — a patch, nothing more
│   ├── sites.ts             everything else, summed from the sets standing there
│   ├── hybrid.ts            the array, the bank, and thirty days of what carried
│   ├── estateSummary.ts     the estate strip's tallies and per-site verdict
│   ├── siteTrend.ts         which metrics a yard can chart, and the series
│   ├── siteRuns.ts          every set's runs, merged into one time-ordered log
│   ├── customers.ts         the estate's regions, and their peak sun hours
│   ├── programs.ts          the rollout groupings — a grouping and only that
│   └── siteConfig.ts        the power role, per site, in localStorage
└── components/
    ├── SitesToolbar…/Table/Cards/Map   the register; the toolbar holds three filters
    ├── SitesSummaryCards.tsx   four cards: two counts, two links out
    ├── SiteDetailPanel.tsx  the preview beside the list and over the map
    ├── SiteDetailShell.tsx  the rail, and which plant this yard has
    ├── SiteSwitcher.tsx     the rail's header — alarm-ordered, like the list
    ├── SiteHome.tsx         the four bands
    ├── SiteMetricStrip.tsx  band 1 — the two figures this site can answer for
    ├── SiteCircuit.tsx      band 2 — the drawing, its picker, and which is picked
    ├── SiteDiagram.tsx      the circuit itself, and every source on the bus
    ├── SiteDevicePanel/SiteDeviceCard   the card beside it — one device at a time
    ├── SiteDetails.tsx      band 3 — the rows the Settings section edits
    ├── SiteDiagnostics.tsx  band 4 — which metrics this yard offers
    ├── TrendPanel.tsx       the chart itself, shared with solar and battery
    ├── SiteRuns.tsx         the genset panel, over every set here
    ├── SiteSettings.tsx     identity, power, gensets, and the preview
    ├── settings/SiteIdentityPanel.tsx   six editable givens
    ├── SiteDeployments.tsx  every job this yard has held, newest first
    └── SiteGensets.tsx      what stands here, under which job, and a way to start one

src/modules/deployment/
├── types/
│   ├── deployment.type.ts   Deployment, DeploymentMembership, the three states
│   └── view.type.ts         the register's URL state — four views, three chips
├── data/
│   ├── seed.ts              the record, dealt per yard; and what a window cost
│   ├── store.ts             the jobs, the write path, and the overlap rule
│   ├── feed.ts              one job joined to its machines — every view's row
│   └── detail.ts            one job, live, for its own pages
└── components/
    ├── Deployments…         the register: toolbar, strip, table, cards, map, Gantt
    ├── stateMeta.ts         one description of a state, for the six places drawing it
    └── detail/              the job's five sections, and the rail's switcher

src/modules/settings/        the brand picker
```

### The rules that hold the graph together

**`data/siteSeed.ts` has no imports**, and that is structural rather than tidiness.
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
summed from them; its plant is sized by `hybrid.ts` from its load and its role. There is
no stored site figure to drift — and since 2026-09-14 no site *verdict* either: what is
wrong with a yard is the alarm queue, counted in `siteAlarmQueue.ts`, not a roll-up
stored on the summary.

**`data/hybrid.ts` is the one place two models meet, and they are not reconciled.** See
[Hybrid plant](#hybrid-plant) for the seam and the rule that keeps it off the screen.
