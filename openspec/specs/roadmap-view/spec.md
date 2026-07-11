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

### Requirement: Prepare the weave command from the review banner
When the view shows the dependency-review indicator (at least one open change has a `pending` dependency-review state), it SHALL present an action that copies the project-wide weave command (`/loom:weave`) to the clipboard for the user to run in Claude Code. The action SHALL take no change argument.

#### Scenario: Weave action offered when proposals need review
- **WHEN** the roadmap model includes one or more changes with a `pending` dependency-review state
- **THEN** the view presents an action that, when triggered, copies `/loom:weave` to the clipboard

#### Scenario: No weave action when nothing needs review
- **WHEN** every open change has a `declared` dependency-review state
- **THEN** the review indicator and its weave action are not shown

### Requirement: Prepare per-change apply and archive commands
For an open change the view SHALL present — on both the change's roadmap card and its detail inspection — an apply action that copies `/opsx:apply <change-name>` when that change is ready to implement (not archived, `ready` readiness, and not already complete); and an archive action that copies `/opsx:archive <change-name>` when that change is complete (not archived, with tasks present and all complete). Each command SHALL embed that change's own name. The apply and archive actions SHALL be mutually exclusive for a given change, and the card and detail SHALL offer the same action for the same change. Triggering the action from the card SHALL copy the command without also selecting the card or opening its detail.

#### Scenario: Apply command offered for a ready, incomplete change
- **WHEN** a ready, not-yet-complete open change is shown on a card or inspected in detail
- **THEN** that surface presents an action that copies `/opsx:apply <change-name>` with the change's name embedded

#### Scenario: Archive command offered for a completed change
- **WHEN** an open change whose tasks are all complete is shown on a card or inspected in detail
- **THEN** that surface presents an action that copies `/opsx:archive <change-name>` with the change's name embedded, and does not present an apply action

#### Scenario: Card action does not select the card
- **WHEN** the user triggers a change's apply or archive action from its card
- **THEN** the view copies the command and does not select the card or open its detail

#### Scenario: No command actions for an archived change
- **WHEN** a change is archived
- **THEN** neither its card nor its detail presents an apply or archive action

### Requirement: Confirm a copied command
When the user triggers a command action, the view SHALL write the exact command text to the clipboard and give an at-a-glance confirmation of what was copied. If the clipboard write fails, the view SHALL tell the user and surface the command text so it can be copied manually.

#### Scenario: Confirmation shown on copy
- **WHEN** the user triggers a command action and the clipboard write succeeds
- **THEN** the view shows a brief confirmation naming the command that was copied

#### Scenario: Manual fallback on copy failure
- **WHEN** the user triggers a command action and the clipboard write fails
- **THEN** the view tells the user the copy failed and shows the command text for manual copying

### Requirement: Command actions only prepare, never execute
The view's command actions SHALL only place command text on the clipboard for the user to run in Claude Code. The view SHALL NOT execute the weave, apply, or archive workflows, and triggering an action SHALL NOT cause the dashboard to run an agent or perform daemon-side work on the user's behalf.

#### Scenario: Triggering an action performs no execution
- **WHEN** the user triggers any command action
- **THEN** the dashboard only copies the command text and confirms it, and does not itself run the corresponding workflow

