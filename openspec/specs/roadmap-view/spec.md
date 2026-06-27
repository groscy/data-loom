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

### Requirement: Project selector control
The view SHALL present a project selector showing the currently active project and the available candidate projects, and selecting a candidate SHALL switch the displayed project so both the roadmap and the MCP topology reflect the new selection.

#### Scenario: Selector shows current and candidates
- **WHEN** the view loads
- **THEN** it shows the active project and lists the candidate projects

#### Scenario: Selecting a project switches the dashboard
- **WHEN** the user picks a different project from the selector
- **THEN** the dashboard switches to that project and both tabs reflect it

### Requirement: Vertically stacked phase bands
The roadmap SHALL render phases as vertically stacked bands ordered by ascending phase (the earliest phase on top), where each band is a visually bounded container holding that phase's change cards in a row, and consecutive bands are connected by a downward phase-progression indicator.

#### Scenario: Phases stack top to bottom
- **WHEN** the roadmap renders changes across multiple phases
- **THEN** each phase appears as its own band, ordered earliest-on-top, with that phase's changes laid out in a row inside the band

#### Scenario: Phase progression is indicated
- **WHEN** the roadmap shows more than one phase
- **THEN** a downward indicator connects each band to the next, conveying phase order

### Requirement: Dependencies remain visible in the band layout
In the stacked-band layout the roadmap SHALL continue to show dependency relationships as connectors between the specific change cards involved.

#### Scenario: Dependency connector shown across bands
- **WHEN** a change in a later phase depends on a change in an earlier phase
- **THEN** the roadmap draws a connector between those two cards

