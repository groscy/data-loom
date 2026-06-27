## Why

The foundational roadmap (`scaffold-roadmap-daemon`) derives phases defensively: it tolerates a malformed dependency graph without crashing, but it does not yet tell the user *what* is wrong. In practice the interesting failures — a change that modifies a capability nobody adds (dangling / out-of-order), or two changes that modify each other's capabilities (a cycle with no valid order) — are exactly the things a roadmap should surface, not hide. This change turns those latent conditions into visible, actionable conflicts.

This change builds on the derivation and view from `scaffold-roadmap-daemon` (Phase 1); it is Phase 2.

## What Changes

- Extend the derivation to **detect** dependency conflicts: cycles in the dependency DAG, dangling dependencies (a Modified capability with no Adding change and no spec baseline), and out-of-order references.
- Classify each conflict with enough information to act on it (which changes and which capability are involved).
- Extend the view to **surface** conflicts: mark affected change nodes (e.g. a ⚠ treatment), show the offending relationship (e.g. the cycle or the unsatisfied dependency), and keep the rest of the roadmap readable.
- No change to the edge-derivation rule itself or to status — this strictly adds detection and presentation on top of the existing model.

## Capabilities

### New Capabilities
<!-- None. This change strictly extends existing capabilities. -->

### Modified Capabilities
- `roadmap-derivation`: Gains conflict detection — identifying cycles, dangling/out-of-order dependencies — and attaching structured conflict information to the emitted roadmap model, in addition to its existing derivation duties.
- `roadmap-view`: Gains conflict surfacing — visually marking changes and relationships involved in a conflict — in addition to rendering phase and status.

## Impact

- Purely additive to data_loom's own logic; no new external dependencies.
- Depends on `scaffold-roadmap-daemon` (modifies its `roadmap-derivation` and `roadmap-view` capabilities) — this is the dependency edge placing this change in Phase 2, parallel to `add-mcp-topology`.
