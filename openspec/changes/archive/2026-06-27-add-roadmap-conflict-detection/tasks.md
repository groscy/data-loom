## 1. Conflict detection (roadmap-derivation)

- [x] 1.1 Add a `Conflict` type (`cycle` | `dangling`, involved changes, optional capability, description) and a `conflicts` array on the roadmap model
- [x] 1.2 Detect dependency cycles via DFS back-edge finding over the existing dependency map; record the changes in each cycle
- [x] 1.3 Promote each unsatisfied (Modified-but-unowned, non-baseline) capability to a `dangling` conflict naming the change and capability
- [x] 1.4 Attach conflicts to the emitted model defensively — detection never aborts derivation of the rest of the roadmap

## 2. Conflict surfacing (roadmap-view)

- [x] 2.1 Compute the set of changes involved in any conflict and mark each such node with the warning treatment
- [x] 2.2 Add a conflicts banner above the board listing each conflict's relationship (cycle path / unsatisfied dependency); hidden when there are none
- [x] 2.3 Keep phase and status rendering intact and reflect conflict changes live on daemon push

## 3. Verification

- [x] 3.1 Against the real (clean) workspace, confirm zero conflicts and an unchanged roadmap render
- [x] 3.2 With synthetic input, confirm a cycle is detected (both changes reported) and a dangling dependency is detected (change + capability reported)
- [x] 3.3 Confirm the view marks conflicted nodes and shows the banner for a model containing conflicts
