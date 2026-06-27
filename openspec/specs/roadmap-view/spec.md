# roadmap-view Specification

## Purpose
TBD - created by archiving change scaffold-roadmap-daemon. Update Purpose after archive.
## Requirements
### Requirement: Phased roadmap layout
The view SHALL render the roadmap as nodes laid out by phase, where each node is exactly one OpenSpec change and phase order reads in a consistent direction (e.g. Phase 1 first). Dependency relationships between changes SHALL be visible.

#### Scenario: Changes grouped by phase
- **WHEN** the daemon sends a roadmap model with changes across multiple phases
- **THEN** the view places each change in its phase group in order

#### Scenario: Dependencies are visible
- **WHEN** one change depends on another
- **THEN** the view shows the dependency relationship between their nodes

### Requirement: Status shown as a second axis
The view SHALL convey each change's status (draft / in-progress / done) as a visual treatment distinct from its phase position, so order and progress are readable independently.

#### Scenario: Status is distinguishable from phase
- **WHEN** two changes share a phase but differ in status
- **THEN** the view renders them in the same phase group with visually distinct status treatments

### Requirement: Archived changes as a collapsed done band
The view SHALL present archived (completed) changes as a collapsed "done" band that can be expanded, keeping history visible without crowding active work.

#### Scenario: Archived changes collapsed by default
- **WHEN** the roadmap model includes archived changes
- **THEN** the view shows them in a collapsed done band that the user can expand

### Requirement: Live reaction to daemon pushes
The view SHALL update to reflect a newly pushed roadmap model without a manual page refresh.

#### Scenario: View updates on push
- **WHEN** the daemon pushes an updated roadmap model
- **THEN** the view re-renders to match the new model without the user reloading the page

### Requirement: Node detail inspection
The view SHALL let the user inspect an individual change node to see its key roadmap facts (its phase, status, and the capabilities it adds or modifies).

#### Scenario: Inspect a change node
- **WHEN** the user selects a change node
- **THEN** the view shows that change's phase, status, and its new/modified capabilities

### Requirement: Mark changes involved in a conflict
The view SHALL visually mark every change node that participates in a detected conflict (e.g. a warning treatment), distinct from normal phase/status rendering.

#### Scenario: Conflicted node is marked
- **WHEN** the roadmap model includes a conflict involving a change
- **THEN** the view marks that change's node with a conflict treatment

### Requirement: Show the offending relationship
The view SHALL convey the nature of each conflict — the cycle path or the unsatisfied dependency — so the user can see what to fix, while keeping the rest of the roadmap readable.

#### Scenario: Cycle relationship shown
- **WHEN** a cycle conflict is present
- **THEN** the view shows the relationship between the changes forming the cycle

#### Scenario: Unsatisfied dependency shown
- **WHEN** a dangling-dependency conflict is present
- **THEN** the view indicates the change and the capability that is unsatisfied

