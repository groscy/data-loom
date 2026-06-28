# roadmap-derivation Specification

## Purpose
TBD - created by archiving change scaffold-roadmap-daemon. Update Purpose after archive.
## Requirements
### Requirement: Source data from the CLI and proposal capability declarations
The derivation SHALL obtain the change list, per-change task/status progress, and capability deltas (capability names and delta operations) from the `openspec` CLI's JSON output, and SHALL NOT hand-parse requirement or scenario prose. Because the CLI does not expose capability ownership, the derivation SHALL read each change proposal's structured Capabilities section to determine which capabilities a change introduces (New) versus extends or depends upon (Modified).

#### Scenario: Deltas and progress come from the CLI
- **WHEN** the derivation needs the changes, their capability deltas, and task progress
- **THEN** it uses the `openspec` CLI JSON output as the source and does not parse requirement or scenario prose

#### Scenario: Ownership comes from proposal capability declarations
- **WHEN** the derivation needs to know which change introduces a capability versus depends on it
- **THEN** it reads the proposal's New / Modified Capabilities declarations to determine ownership

### Requirement: Derived, non-persisted ordering
The roadmap ordering SHALL be derived fresh from the current OpenSpec workspace on every recompute and SHALL NOT be read from or written to any stored phase/order field.

#### Scenario: No stored order is consulted
- **WHEN** the derivation computes phases
- **THEN** it uses only the live dependency graph and writes no phase/order back into any proposal or sidecar file

### Requirement: Dependency edge derivation
The derivation SHALL create a dependency edge from a change that declares a capability under its Modified Capabilities to the change that declares that same capability under its New Capabilities. A capability that already exists as a settled spec under `openspec/specs/` SHALL satisfy the dependency without creating an edge to a pending change. Changes whose New Capabilities are mutually disjoint SHALL NOT have an edge between them.

#### Scenario: Modify-after-add creates an edge
- **WHEN** change B lists capability `X` under Modified Capabilities and change A lists `X` under New Capabilities
- **THEN** the derivation records an edge B depends-on A

#### Scenario: Existing baseline satisfies dependency
- **WHEN** a change modifies capability `X` and `X` already exists under `openspec/specs/`
- **THEN** the dependency is treated as satisfied by the baseline and no edge to a pending change is created

#### Scenario: Disjoint additions are independent
- **WHEN** two changes each introduce only new, non-overlapping capabilities
- **THEN** the derivation records no dependency edge between them

### Requirement: Topological phase assignment
The derivation SHALL assign each change a phase equal to its depth in the dependency DAG: a change with no unmet dependency is Phase 1, and any other change is one phase deeper than its deepest dependency.

#### Scenario: Dependent change is a later phase
- **WHEN** change B depends on change A and A has no dependencies
- **THEN** A is assigned Phase 1 and B is assigned Phase 2

#### Scenario: Independent changes share the first phase
- **WHEN** two changes have no dependencies
- **THEN** both are assigned Phase 1

### Requirement: Status axis from task progress
The derivation SHALL assign each change a status derived independently from its `tasks.md` progress, with archived changes treated as done. Status SHALL be a separate axis from phase.

#### Scenario: Completed tasks yield done status
- **WHEN** a change's tasks are all complete or the change is archived
- **THEN** the derivation marks the change as done

#### Scenario: Partial progress yields in-progress status
- **WHEN** a change has some but not all tasks complete
- **THEN** the derivation marks the change as in-progress, independently of its phase

### Requirement: Defensive derivation on malformed graphs
The derivation SHALL NOT crash when the dependency graph is incomplete or cyclic. It SHALL still emit a roadmap model, leaving unsatisfied dependencies unsatisfied and producing a layout for cyclic input without raising an error.

#### Scenario: Dangling dependency does not crash
- **WHEN** a change modifies a capability that no change adds and no spec baseline provides
- **THEN** the derivation still produces a roadmap model and records the dependency as unsatisfied

#### Scenario: Cycle does not crash
- **WHEN** the dependency graph contains a cycle
- **THEN** the derivation still returns a roadmap model rather than failing

### Requirement: Detect dependency cycles
The derivation SHALL detect cycles in the change dependency DAG and SHALL identify the changes and capabilities participating in each cycle.

#### Scenario: Cycle identified
- **WHEN** change A modifies a capability added by change B and change B modifies a capability added by change A
- **THEN** the derivation reports a cycle naming both changes and the capabilities involved

### Requirement: Detect dangling and out-of-order dependencies
The derivation SHALL detect when a change modifies a capability that no change adds and that has no settled spec baseline (a dangling / out-of-order dependency), and SHALL identify the change and capability involved.

#### Scenario: Dangling dependency identified
- **WHEN** a change modifies capability `X` but no change adds `X` and no baseline spec provides it
- **THEN** the derivation reports an unsatisfied dependency naming that change and `X`

### Requirement: Attach structured conflict information to the model
The derivation SHALL attach structured conflict information (type, involved changes, involved capability) to the emitted roadmap model so the view can surface it, without aborting derivation of the rest of the roadmap.

#### Scenario: Conflicts travel with the model
- **WHEN** one or more conflicts are detected
- **THEN** the emitted roadmap model includes structured conflict entries while still describing all non-conflicting changes

### Requirement: Derive dependency-review state per change
The derivation SHALL assign each open change a dependency-review state derived from its proposal: `declared` when the proposal contains a `## Depends On` heading (regardless of whether that section lists any dependencies), otherwise `pending`. This state SHALL be metadata only and SHALL NOT affect dependency-edge derivation, phase assignment, or readiness.

#### Scenario: Missing heading yields pending
- **WHEN** an open change's proposal has no `## Depends On` heading
- **THEN** the derivation marks that change's dependency-review state as `pending`

#### Scenario: Present heading yields declared
- **WHEN** an open change's proposal contains a `## Depends On` heading, even with no entries listed
- **THEN** the derivation marks that change's dependency-review state as `declared`

#### Scenario: Review state does not change ordering
- **WHEN** a change's dependency-review state is `pending` or `declared`
- **THEN** its phase, dependency edges, and readiness are identical to what they would be if the review state were not derived

