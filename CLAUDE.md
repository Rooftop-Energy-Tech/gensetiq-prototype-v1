# CLAUDE.md — telcoiq-frontend

> Standing instructions for anyone — human or agent — working in this prototype.
> Written 2026-09-14. Read this before touching anything.

## What this is, and who it is for

A **clickable prototype of telcoIQ**, the telco-power product line, built from the
RooftopIQ V2 Figma. It exists so a **product designer or product manager** can hold
the idea, click it, and check that it behaves the way they meant.

**They are the audience. Not an engineer.** This is not a staging area for
production code and nothing here ships. It is a thinking tool.

**Owner:** Tristan Lim (Product Lead, IQ product line)

One build serves five customers — `VITE_BRAND` picks the brand, and everything a
brand may change lives in `src/brands/`. Read
[`src/brands/types.ts`](src/brands/types.ts) first: it states the line between
*whose app this is* and *what the product is*.

## The source of truth

**Two documents describe how this prototype is supposed to behave**, and they are
written for a person rather than a compiler:

| Document | What it holds |
| --- | --- |
| [`docs/how-it-works.md`](docs/how-it-works.md) | the model, the screens, and the reasoning — band by band, page by page |
| [`README.md`](README.md) | the brand system, the route table, what's built, and where this departs from the mock-up |

**When you change what the prototype does, update them in the same session.** A
behavioural change delivered without the documentation update is incomplete work,
not work plus a follow-up. Moving a band between pages, adding or removing a
screen, changing a rule or a URL parameter — all of these land in the prose too.

Visual and layout tweaks do not need it. Structural and behavioural ones always do.

**If a document and the code disagree, raise it rather than silently fixing either
side.** The documents record intent; the code records what got built. A
contradiction between them is a finding.

### The reasoning lives in the code as well

This codebase carries its argument in **doc comments** — why a band sits where it
does, what an earlier arrangement got wrong, which figure was deliberately left
out. That is deliberate and it is part of the deliverable.

So when you move or delete something, **fix the comments that referred to it**,
including the ones in neighbouring files. A doc comment describing a band that is
no longer there is worse than no comment: it is a confident, wrong explanation.

## Commits

**Commit your own work.** When a change is complete and verified, commit it — do
not leave it uncommitted for the owner to sort out.

- **One commit per coherent change**, not per file and not per session.
- **Stage only the files you touched.** This tree often carries unrelated in-flight
  work; `git add -A` sweeps it into your commit.
- **Do not push.** Pushing is the owner's call.
- Never force-push or rewrite history.

Commit messages here are a sentence about the product, in the present tense —
`The genset card answers at the barrel`, not `refactor GensetCard`. Read
`git log --oneline` before writing one.

## Working alongside other Claude sessions

**The owner often runs several sessions against this prototype at once.**
Assume another agent is editing this repo while you are, and that it cannot
see you. That is the normal condition here, not an incident.

**Every rule below ends in a move.** If you are about to finish a turn with
"another session is editing this, tell me how to proceed", you have missed the
rule that covers it. Waiting for the tree to go quiet is not a plan — it does
not go quiet.

### Committing

- **Stage the exact paths you touched, by name.** Never `git add -A`,
  `git add .` or `git commit -a`. Another session's half-written file is one
  command away from ending up in your commit under your message.
- **Commit as soon as your change verifies.** Do not hold work back because
  the tree is dirty. The dirt belongs to someone else and it will still be
  there later; everyone committing their own paths promptly is the only thing
  that clears it.
- **Do not push.** Pushing is the owner's call.
- **A file you edited has also been edited by someone else — commit it
  anyway**, and name their hunks in the commit body: which lines are not
  yours, and what they appear to do. A commit that says plainly it contains
  two changesets is worth more than a tree nobody will commit.
- **Your file imports one they have not committed yet — commit yours**, and
  say in your report that the tree will not build standalone until theirs is
  committed. Do not commit their file for them, and do not wait.
- **`Unable to create '.git/index.lock': File exists` is a race, not a
  fault.** Another session is mid-commit. Wait a few seconds and retry once.
  Never delete the lock file.
- Never force-push or rewrite history.

### Verifying

- **A typecheck or build error in a file you never opened is not yours.**
  Check it against `git diff --name-only` rather than assuming. If the failing
  file is not in your set, retry once after a pause — in-flight edits usually
  settle within a minute — then report it as another session's and move on. Do
  not debug it, and do not treat it as a blocker on your own change.
- **A blank screen or a stale HMR error is often a half-saved file, not a
  break.** Reload before concluding anything.
- **The dev server on 3400 belongs to whoever started it.** Do not kill it,
  and do not restart it to pick up your change.
- **If 3400 is taken, it is another session's — serve your own on 3450** with
  `bun run build && bunx vite preview --port 3450`, and say which port you are
  on when you report. Two servers is fine; two servers and no way to tell them
  apart is not.

### Reporting

- **Say which files you changed.** It is how the owner reconciles two sessions
  that touched the same page.
- **Mention another session's work only when it affects the owner**: it
  blocked you, it changed something you built, or it is sitting uncommitted
  alongside your commit. An inventory of every foreign file you noticed is
  noise — the owner knows the other session is there, because they started it.

### When the rules genuinely run out

Two sessions rewriting the same module at the same time is the one case these
rules do not cover. Say so plainly, name the files, and put the choice to the
owner: sequence the two, or open a channel with the `coordinate` skill (the
`skill-coordinate` repo, mounted at `.claude/skills/coordinate/`). That is an
answer. "Another session is editing this" on its own is not.

## Before you say you are done

```bash
bun run typecheck    # tsc --noEmit
bun run build        # typecheck + vite build
```

**And look at the change in the browser.** This is a prototype; a screen that
compiles and renders wrong has failed at the only job it has. Use the Browser
pane against the running dev server rather than asking the owner to check.

`bun run check:equipment` re-measures the equipment drawings against the boxes
`plantScene.ts` places them by — run it if you touch either.

## Running it

Each brand runs on its own port, so they can be open side by side:

```bash
bun install
bun run dev             # REDTONE      :3400  (the default)
bun run dev:sesb        # SESB         :3401
bun run dev:unbranded   # gensetIQ     :3402
bun run dev:celcomdigi  # CelcomDigi   :3403
bun run dev:telcoiq     # telcoIQ      :3404
```

`.claude/launch.json` carries these for the Browser pane. **Never run a dev server
with a bare shell command** — start it through the preview tooling so it is
managed.

## Working rules

- **Never hardcode a colour.** Use the design tokens in `src/styles/` — the
  Tailwind utilities (`bg-canvas`, `text-primary`, `border-subtle`, …) or the CSS
  variables behind them. `src/styles/colors.ts` is token-compatible with
  `rooftopiq-frontend-v3` and every token names the Figma variable it *is*, in its
  `figma` field. Read that file's header before moving a colour in either
  direction, and never infer a token's Figma counterpart from its name.

  *(Its header cites an org skill `figma-tokens` for the full bridge. No skill by
  that name exists in `org-skills` as of 2026-09-14 — treat the pointer as stale
  and work from `colors.ts` itself.)*
- **A brand is configuration, not a branch.** Adding a customer is a file in
  `src/brands/catalog/`, an entry in `manifest.ts`, and nothing else. A build only
  contains the brands it may show — that is a shipping guarantee, not a hidden
  control.
- **There is no backend.** Every figure is a fixture under
  `src/modules/<module>/data/`, and `site/data/hybrid.ts` is the energy model the
  other screens read. Two screens disagreeing about one quantity means one of them
  stopped reading the model.
- **Routes are files.** `src/routes/` drives TanStack Router; `routeTree.gen.ts` is
  generated — never hand-edit it.
- **A page only offers what is fitted.** No `0 kWh` under `Generation today` at a
  site with no array — the option is absent, not zeroed. The documents explain why
  at length; it is the rule most easily broken by accident.

## Background

- Why prototypes work this way:
  `personal-tristan/shared-knowledge/re-product-team/rapid-prototyping.md`
- The vault's own conventions, including the rule that code repos never live inside
  a vault: `personal-tristan/CLAUDE.md`
