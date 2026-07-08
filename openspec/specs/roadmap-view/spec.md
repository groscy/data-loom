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

### Requirement: Dependencies remain visible in the band layout
In the stacked-band layout the roadmap SHALL continue to show dependency relationships as connectors between the specific change cards involved.

#### Scenario: Dependency connector shown across bands
- **WHEN** a change in a later phase depends on a change in an earlier phase
- **THEN** the roadmap draws a connector between those two cards

### Requirement: Surface proposals needing dependency review
The view SHALL indicate which open changes have a `pending` dependency-review state, including an at-a-glance count of how many proposals still need review, so the user knows to ask their agent to review them. The view SHALL only display this state; it SHALL NOT infer or write dependencies.

#### Scenario: Pending proposals are indicated
- **WHEN** the roadmap model includes one or more changes with a `pending` dependency-review state
- **THEN** the view shows how many proposals need dependency review and marks which change nodes they are

#### Scenario: No indicator when all declared
- **WHEN** every open change has a `declared` dependency-review state
- **THEN** the view shows no needs-review indicator

### Requirement: Phase columns keep a fixed footprint at any depth
The roadmap SHALL render phases as horizontally-arranged columns in ascending phase order, where each phase column occupies a fixed, phase-count-independent horizontal footprint. Phase frames and change cards SHALL NOT shrink, overlap, or clip as the number of phases grows, so a plan with many phases stays as legible as a plan with few.

#### Scenario: Many phases do not overlap
- **WHEN** the roadmap renders a plan with more phases than fit the viewport width
- **THEN** each phase column keeps its full fixed width and its change cards remain fully visible without overlapping or clipping neighbouring phases

#### Scenario: Card size is independent of phase count
- **WHEN** two plans differ only in how many phases they contain
- **THEN** an individual change card is rendered at the same width in both

### Requirement: Horizontal scrolling for wide roadmaps
The roadmap canvas width SHALL grow with the number of phases. When the total width exceeds the available viewport width, the view SHALL provide horizontal scrolling so every phase can be panned into view. When the roadmap fits within the viewport, it SHALL remain centered with no horizontal scrollbar. Dependency connectors SHALL align with their change cards across the full scrollable width.

#### Scenario: Wide roadmap scrolls horizontally
- **WHEN** the combined width of all phase columns exceeds the viewport width
- **THEN** the roadmap becomes horizontally scrollable and later phases can be reached by scrolling sideways

#### Scenario: Narrow roadmap stays centered
- **WHEN** all phase columns fit within the viewport width
- **THEN** the roadmap is centered and shows no horizontal scrollbar

#### Scenario: Dependency edges track the full width
- **WHEN** the roadmap is wider than the viewport and a change depends on one in an earlier phase
- **THEN** the dependency connector is drawn between the two cards at their actual positions across the full scrollable width

