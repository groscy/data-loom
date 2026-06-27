## Context

The Phase 1 derivation is deliberately defensive: it tolerates a malformed dependency graph (cycle guard in the depth function; `unsatisfiedDependencies` recorded per node) but does not surface *what* is wrong. The view already renders a faint `.warn` treatment when a node has unsatisfied deps, but there is no first-class conflict concept and cycles are silently broken rather than reported. This change turns those latent conditions into explicit, visible conflicts.

This is additive on top of baseline `roadmap-derivation` and `roadmap-view`.

## Goals / Non-Goals

**Goals:**
- Detect dependency cycles and identify the changes (and the capability) involved.
- Promote dangling/out-of-order dependencies (a Modified capability with no introducing change and no baseline) to first-class conflicts.
- Attach structured conflict information to the emitted model, without aborting derivation of the rest of the roadmap.
- Surface conflicts in the view: mark involved nodes and show the offending relationship, keeping the rest readable.

**Non-Goals:**
- Auto-resolving conflicts or reordering. The dashboard reports; the user fixes the specs.
- Changing the edge-derivation rule or the status axis.

## Decisions

### D1 — Conflict shape
A single `Conflict` type covers both kinds:
```
{ type: "cycle" | "dangling", changes: string[], capability?: string, description: string }
```
`cycle` lists the changes forming the cycle; `dangling` names the one change and the unsatisfied `capability`. `description` is a ready-to-display one-liner. The model gains a top-level `conflicts: Conflict[]`.

### D2 — Cycle detection
A standard DFS with a gray/black coloring finds back-edges; each back-edge yields the cycle slice from the stack. Reuses the existing `depMap`. The existing depth() cycle guard stays — detection and defensive layout are separate concerns, so a cyclic graph still lays out *and* now reports the cycle.

### D3 — Dangling promotion
The derivation already computes `unsatisfiedDependencies` per node (a Modified capability with no owner and no baseline). This change emits one `dangling` conflict per (change, unsatisfied capability) — no new detection logic, just promotion to the conflicts list.

### D4 — View surfacing
- Mark every node whose name appears in any conflict with the existing `.warn` treatment (now driven by the conflict set, not only by `unsatisfiedDependencies`).
- Add a compact conflicts banner above the board listing each conflict's `description` (cycle path or unsatisfied dependency). Hidden when there are none.
- Keep phase/status rendering intact; the banner + node marks are additive.

## Risks / Trade-offs

- **Duplicate/overlapping cycles** reported more than once → acceptable for a local tool; dedupe identical member-sets if noisy.
- **Detection must never crash derivation** → cycle detection runs over the same in-memory `depMap` and is wrapped so any failure leaves the roadmap intact with an empty conflicts list.

## Open Questions

- **Highlight cycle edges in the SVG** (red spokes) is a nice-to-have; the banner + node marks satisfy the spec, so edge-coloring is optional polish, deferred.
