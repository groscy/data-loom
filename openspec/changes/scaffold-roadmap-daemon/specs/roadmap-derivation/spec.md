## ADDED Requirements

### Requirement: Read OpenSpec data via CLI JSON
The derivation SHALL obtain change, capability, and status data from the `openspec` CLI's JSON output rather than hand-parsing markdown artifacts.

#### Scenario: Source data from the CLI
- **WHEN** the derivation needs the set of changes and their capabilities
- **THEN** it invokes the `openspec` CLI JSON commands and uses their structured output as the source of truth

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
