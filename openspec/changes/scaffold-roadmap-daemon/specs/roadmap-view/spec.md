## ADDED Requirements

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
