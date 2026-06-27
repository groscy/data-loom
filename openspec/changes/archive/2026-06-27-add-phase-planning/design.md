## Context

The derivation already builds a `depMap` (change → dependency changes) from capability ownership, computes phases as longest-path depth, detects cycles, and records unsatisfied (dangling) dependencies. Explicit dependencies and readiness slot into that existing machinery: explicit edges are just more entries in `depMap`, and readiness is a classification computed from the final graph plus each change's status. The view already renders cards by phase with status pills and a conflicts banner.

## Goals / Non-Goals

**Goals:**
- Let a proposal declare `## Depends On: <change names>` and have those edges shape the phases.
- Classify each open proposal ready / blocked / done.
- Show, on the roadmap, which proposals are ready and which to do next.

**Non-Goals:**
- Auto-suggesting dependencies. Explicit edges are author-declared; inference stays capability-based.
- Cross-project planning. Planning is within one project's open proposals.
- Storing phase numbers. Phases remain derived (now from capability + explicit edges).

## Decisions

### D1 — Declaration format: a `## Depends On` section in the proposal
A proposal may include:
```
## Depends On
- some-change-name
- another-change
```
`OpenSpecClient.readProposalDependsOn(name)` parses `- <kebab-name>` bullets under a `## Depends On` heading (mirroring the existing capability-section parser). Absent section → no explicit deps. Author-edited markdown keeps it transparent and diff-friendly, consistent with how ownership is already read.

### D2 — Merge explicit edges into the dependency graph
For each change, add an edge to every declared dependency that resolves to a known change:
- dependency is an **active** change → real edge (affects phase + readiness).
- dependency is **archived/done in baseline** → satisfied; no blocking edge (treated like a met capability dependency).
- dependency is **unknown** (no such change) → recorded as an unsatisfied dependency (surfaces via the existing dangling-conflict path).
Explicit edges share `depMap` with capability edges, so phase depth and `findCycles` already account for them (an explicit-dependency cycle is detected like any other).

### D3 — Readiness classification
After phases and statuses are computed, classify each non-archived change:
- `done` — status is done (all tasks complete) or archived.
- `ready` — not done, and every change it depends on (capability + explicit) is done or archived.
- `blocked` — not done, and at least one dependency is an active, not-done change.
`dependsOn` already lists only active dependency changes (baseline/archived don't create edges), so a change is `blocked` iff any `dependsOn` target's status is not `done`, else `ready`. Add `readiness` to `ChangeNode`.

### D4 — Recommended next
"Next to implement" = the `ready` changes, ordered by phase then name. The view computes this from the model (ready + lowest phase) and highlights them; no extra model field required beyond `readiness`.

### D5 — View
- Active, not-done cards get a small **ready** (accent) or **blocked** (muted) badge; `blocked` cards also note which dependency isn't done yet.
- The earliest-phase `ready` proposals are highlighted as "next up" (e.g. an accent ring / a one-line "implement next: …" hint above the board).
- Done/archived cards are unchanged. Phase layout and the conflicts banner are unchanged.

## Risks / Trade-offs

- **`## Depends On` typos / wrong names** → resolved as unknown ⇒ surfaced as a dangling conflict, so mistakes are visible rather than silently ignored.
- **Redundant explicit + capability edge** (same pair) → de-duplicated in `depMap`; harmless.
- **Readiness vs phase confusion** → keep them distinct in the UI: phase = column (order), readiness = badge (can I start now?). Document the difference in the hint.

## Migration Plan

Additive; no migration. Existing proposals (no `## Depends On`) behave exactly as before. Ship in a later release; no exe behavior change beyond the new roadmap rendering.

## Open Questions

- **Show readiness on the MCP tab?** No — planning is a roadmap concern; the topology tab is unaffected.
- **A dedicated "plan" view** vs badges on the existing roadmap — start with badges + a next-up hint on the roadmap; a separate view is a possible later refinement.
