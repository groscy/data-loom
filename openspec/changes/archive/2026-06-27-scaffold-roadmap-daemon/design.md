## Context

data_loom is a fresh project: an OpenSpec workspace with no application code yet. The goal of this first change is to stand up the foundation — a local process that reads the OpenSpec workspace and renders a live, phased roadmap of changes. Everything later (the MCP topology tab, conflict detection) attaches to this foundation.

Key constraints established during exploration:
- **Fully local, single user, Windows host.** No cloud, no multi-tenant concerns.
- **Derive, don't store.** The roadmap's ordering must be a pure function of the OpenSpec files, recomputed on every change. Nothing about phase/order is persisted.
- **Lean on the `openspec` CLI.** It already exposes structured JSON (`openspec list/show --json`) and an interactive `openspec view`. We consume its JSON rather than re-parsing markdown, so we inherit its schema knowledge.

## Goals / Non-Goals

**Goals:**
- A long-running daemon that serves a browser SPA and keeps it live over a websocket.
- Deterministic derivation of a change-level dependency DAG and its topological phases.
- A two-axis roadmap model: **phase** (order, from the DAG) × **status** (progress, from `tasks.md`).
- Live updates: editing/adding/archiving a change reflects in the view within ~1s, with no manual refresh.

**Non-Goals:**
- The MCP topology tab and any MCP probing (→ `add-mcp-topology`).
- Detecting or surfacing dependency cycles / dangling / out-of-order dependencies (→ `add-roadmap-conflict-detection`). This change assumes a well-formed DAG and may render an unhelpful layout if one isn't; making that failure legible is the next change's job.
- Editing OpenSpec artifacts from the dashboard. data_loom is read-only over the spec workspace in this change.
- Authentication, packaging/installers, multi-IDE support.

## Decisions

### D1 — Daemon + thin SPA over websocket (not a static page, not an Electron app)
A pure static page can read files but **cannot watch the filesystem or (later) probe processes** from the browser sandbox. A long-running local daemon can. We therefore make the **daemon the single source of runtime truth** and the browser a thin reactive view that receives pushed state.
- *Alternative — static SPA reading files directly:* rejected; no file-watching, and it would dead-end the MCP work which needs process/OS access.
- *Alternative — Electron/Tauri desktop app:* rejected for now as heavier than needed; a localhost daemon + browser tab is "simple" per the product goal. Revisit only if a desktop shell is wanted later.

### D2 — Node runtime
The daemon is Node. Rationale: native file-watching, trivial websocket libraries, easy child-process/OS access for the *later* MCP work, and the official MCP client SDK is JS-first — so the same runtime serves both tabs. Keeping one runtime across both product halves avoids a polyglot split.

### D3 — Consume `openspec ... --json`, don't hand-parse markdown
The daemon shells out to the `openspec` CLI for structured data (change list, per-change capabilities, status) instead of parsing `proposal.md`/`tasks.md` by hand. This keeps us aligned with the CLI's schema as it evolves. The CLI is a runtime dependency on the host.
- *Risk noted below:* output shape/availability of the CLI.

### D4 — The dependency edge rule (the heart of the roadmap)
An edge is mechanical, requiring no natural-language understanding:
> A change that declares capability *X* under **Modified Capabilities** depends on whichever change declares *X* under **New Capabilities**. If *X* already exists as a settled spec in `openspec/specs/`, the dependency is satisfied by that baseline (no edge to a pending change).
Two changes that only introduce **disjoint New Capabilities** are independent and share a phase.
- *Alternative — infer deps from prose in design.md/proposal.md:* rejected; fuzzy and unstable. The New/Modified capability lists are explicit, structured, and already required by the schema.

### D5 — Phases = topological layers; status is a separate axis
**Phase** of a change = its longest-path depth in the DAG (rank): changes with no unmet dependency are Phase 1; a change is one phase deeper than its deepest dependency. **Status** is derived independently from `tasks.md` checkbox progress (draft = no/early tasks, in-progress = some done, done = all done or archived). The view is a phase (columns) × status (cell treatment) grid. Conflating the two was explicitly rejected during exploration — "when should I do it" and "where is it" are different questions.

### D6 — Push, don't poll
A filesystem watcher on `openspec/` triggers a recompute-and-push over the websocket. The browser holds no derivation logic; it renders whatever model the daemon sends. Debounce rapid saves so a multi-file edit yields one push.

## Risks / Trade-offs

- **`openspec` CLI JSON shape changes or is missing on the host** → Pin the consumed fields, validate the CLI is present at daemon startup, and fail loudly with a clear message rather than rendering an empty roadmap.
- **Malformed / cyclic dependency graph** (a change Modifies a capability nobody Added, or a cycle) → Out of scope here, but the derivation must not crash on it. Decision: derive defensively (e.g. break cycles arbitrarily for layout, leave dangling deps unsatisfied) and leave a hook for `add-roadmap-conflict-detection` to flag them. Document that early/partial graphs render but may look flat.
- **Early roadmap is flat** — with no `specs/` baseline yet, every change is all-New and lands in Phase 1. This is expected and acknowledged; the graph gets interesting once changes start Modifying each other (e.g. this very initiative).
- **File-watcher noise / rapid saves** → Debounce; coalesce bursts into a single recompute.
- **Capability name drift** between a Modified list and the New list that introduced it (typo, rename) → Surfaces as an unsatisfied dependency; again, legibility is the next change's concern, but derivation must tolerate it.

## Migration Plan

Greenfield — no migration. Deployment is "run the daemon, open the served localhost page." Rollback is stopping the daemon; nothing persistent is written outside the existing `openspec/` workspace (which data_loom only reads).

## Open Questions

- **Frontend stack** (plain TS + a graph lib vs. a framework like Svelte/React): deferred to implementation; the model the daemon emits is framework-agnostic, so this choice is reversible and low-stakes.
- **Exact status thresholds** from `tasks.md` (what counts as "in-progress" vs "draft") — to be pinned in the spec/tasks; a simple "0% / partial / 100%" mapping is the default.
- **Websocket vs. SSE** for the push channel — websocket is the default (bidirectional headroom for future interactivity); SSE would suffice for one-way push. Low-stakes, decided at implementation.
