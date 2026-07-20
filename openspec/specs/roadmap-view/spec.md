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

### Requirement: Live reaction to daemon pushes
The view SHALL update to reflect a newly pushed roadmap model without a manual page refresh.

#### Scenario: View updates on push
- **WHEN** the daemon pushes an updated roadmap model
- **THEN** the view re-renders to match the new model without the user reloading the page

### Requirement: Node detail inspection
The view SHALL let the user inspect an individual change node to see its key roadmap facts (its phase, status, and the capabilities it adds or modifies), and SHALL additionally present that change's full task list grouped by section, keeping the existing task progress summary. Completed tasks SHALL be visually marked as complete and distinguishable from incomplete tasks. The task list SHALL be read-only — the view SHALL NOT provide any affordance to change task state. When a change has no tasks (no task list attached, e.g. an archived change or one without a `tasks.md`), the detail SHALL omit the task list without error, consistent with how the progress summary is already omitted.

#### Scenario: Inspect a change node
- **WHEN** the user selects a change node
- **THEN** the view shows that change's phase, status, and its new/modified capabilities

#### Scenario: Task list shown grouped by section
- **WHEN** the user inspects a change whose model carries a grouped task list
- **THEN** the detail shows every task under its section heading, preserving the sections' order, in addition to the existing progress summary

#### Scenario: Completed tasks are marked
- **WHEN** a shown task list contains both completed and incomplete tasks
- **THEN** the completed tasks are rendered with a completion treatment (e.g. checked and struck through) that is visually distinct from the incomplete tasks

#### Scenario: Task list is read-only
- **WHEN** the task list is displayed in the detail
- **THEN** the view presents no control that would toggle or edit a task's completion state

#### Scenario: No task list when the change has none
- **WHEN** the user inspects a change that carries no task list (an archived change, or one with no `tasks.md`)
- **THEN** the detail renders without a task list and without error

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
The roadmap SHALL render phases as horizontally-arranged columns in ascending phase order, where each phase column occupies a fixed, phase-count-independent horizontal footprint. Phase frames and change cards SHALL NOT shrink, overlap, or clip as the number of phases grows, so a plan with many phases stays as legible as a plan with few. This governs the canvas *layout*, which SHALL remain a pure function of the model. A zoom level chosen by the reader is a view transform applied uniformly to the whole canvas: it SHALL NOT change the layout, nor the relative size of any element within it.

#### Scenario: Many phases do not overlap
- **WHEN** the roadmap renders a plan with more phases than fit the viewport width
- **THEN** each phase column keeps its full fixed width and its change cards remain fully visible without overlapping or clipping neighbouring phases

#### Scenario: Card size is independent of phase count
- **WHEN** two plans differ only in how many phases they contain, viewed at the same zoom level
- **THEN** an individual change card is rendered at the same width in both

#### Scenario: Zoom does not reflow the layout
- **WHEN** the reader changes the zoom level
- **THEN** every phase column and change card scales by the same factor and none reflows, shrinks relative to the others, or changes position on the canvas

### Requirement: Pan the roadmap canvas without scrollbars
The roadmap canvas SHALL grow in both axes with the plan — wider as phases are added, taller as a phase stacks more changes — and SHALL be presented inside a fixed viewport that clips it. The view SHALL provide panning on both axes so any part of the canvas can be brought into view, and SHALL NOT present a scrollbar on either axis. When the whole canvas fits within the viewport it SHALL remain centered. Dependency connectors SHALL align with their change cards at every pan position and zoom level.

#### Scenario: Wide roadmap pans horizontally
- **WHEN** the combined width of all phase columns exceeds the viewport width
- **THEN** the user can pan sideways to reach later phases, and no horizontal scrollbar is shown

#### Scenario: Tall phase pans vertically
- **WHEN** a phase stacks more change cards than fit the viewport height
- **THEN** the user can pan vertically to reach the off-screen cards, and no vertical scrollbar is shown

#### Scenario: Small roadmap stays centered
- **WHEN** the whole canvas fits within the viewport
- **THEN** the roadmap is centered and no scrollbar is shown on either axis

#### Scenario: Dependency edges track the canvas
- **WHEN** the roadmap is panned or zoomed and a change depends on one in an earlier phase
- **THEN** the dependency connector is drawn between the two cards at their actual canvas positions, staying anchored to them

### Requirement: Pan and zoom the roadmap canvas
The view SHALL let the user pan the roadmap canvas by dragging it and by wheel or trackpad gesture, and SHALL let the user zoom the canvas between a minimum and a maximum scale. Zooming SHALL keep the point under the pointer stationary, so the canvas grows and shrinks around what the user is looking at rather than around an arbitrary origin. Panning SHALL be constrained so at least part of the canvas always remains within the viewport — the canvas SHALL NOT be pannable entirely out of sight. Dragging a change card SHALL NOT move that card: card positions are derived from the model and are never edited by the view.

#### Scenario: Drag to pan
- **WHEN** the user presses on empty canvas and drags
- **THEN** the canvas follows the pointer and the view shows the newly revealed region

#### Scenario: Zoom keeps the pointer anchored
- **WHEN** the user zooms with the pointer over a particular change card
- **THEN** the scale changes and that card stays under the pointer

#### Scenario: Zoom is bounded
- **WHEN** the user keeps zooming in or out past the supported range
- **THEN** the scale stops at the maximum or minimum bound and the canvas stays legible

#### Scenario: Canvas cannot be lost off-screen
- **WHEN** the user pans far past the edge of the canvas
- **THEN** panning stops with part of the canvas still visible in the viewport

#### Scenario: Cards are not draggable
- **WHEN** the user presses on a change card and drags
- **THEN** the card does not move from its derived position

### Requirement: Minimap overview of the whole roadmap
The view SHALL present a minimap: a scaled overview of the entire canvas showing every phase column and every change card in its true relative position, together with an indicator of which region the viewport currently shows. The minimap SHALL be shown whenever the roadmap has more than one phase, or the canvas is larger than its viewport in either axis. It SHALL be hidden only when a single-phase roadmap already fits within the viewport, where it would merely restate what is on screen. The minimap SHALL be a navigation control — clicking or dragging within it SHALL move the viewport to the corresponding region of the canvas. The minimap SHALL stay in sync as the user pans, zooms, and as the daemon pushes a new model.

#### Scenario: Minimap shown for a multi-phase roadmap
- **WHEN** the roadmap has more than one phase, even if the whole canvas currently fits within the viewport
- **THEN** the view shows a minimap depicting the whole canvas with every phase column and change card

#### Scenario: Minimap appears for an oversized canvas
- **WHEN** the roadmap canvas is larger than the viewport in either axis
- **THEN** the view shows a minimap depicting the whole canvas with every phase column and change card

#### Scenario: Minimap hidden for a single-phase roadmap that fits
- **WHEN** the roadmap has exactly one phase and the whole canvas fits within the viewport
- **THEN** no minimap is shown

#### Scenario: Viewport indicator reflects the current view
- **WHEN** the user pans or zooms the canvas
- **THEN** the minimap's viewport indicator moves and resizes to match the region now shown

#### Scenario: Click the minimap to jump
- **WHEN** the user clicks or drags a position within the minimap
- **THEN** the canvas viewport moves to show the corresponding region of the roadmap

#### Scenario: Minimap follows a pushed model
- **WHEN** the daemon pushes a roadmap model that changes the canvas contents or extent
- **THEN** the minimap re-renders to depict the new canvas

### Requirement: Viewport controls and keyboard navigation
The view SHALL provide explicit controls to zoom in, zoom out, and fit the whole roadmap to the viewport, and SHALL support the same navigation from the keyboard so the canvas is usable without a pointing device: arrow keys pan, `+` / `-` zoom, and `0` fits the roadmap to the viewport. On first render of a project's roadmap, and whenever the user switches projects, the view SHALL fit the roadmap to the viewport so the plan is seen whole before it is explored.

#### Scenario: Fit to view
- **WHEN** the user triggers the fit control
- **THEN** the zoom and pan adjust so the entire canvas is visible within the viewport

#### Scenario: Initial render is fitted
- **WHEN** a project's roadmap is rendered for the first time, or the user switches to another project
- **THEN** the canvas opens fitted to the viewport

#### Scenario: Keyboard panning and zooming
- **WHEN** the roadmap canvas has keyboard focus and the user presses an arrow key, `+`, `-`, or `0`
- **THEN** the canvas pans, zooms in, zooms out, or fits to the viewport respectively

### Requirement: Viewport survives board re-renders
The reader's pan position and zoom level SHALL survive every re-render of the roadmap board within a project — whether triggered by a daemon model push, by selecting a change, or by closing the detail panel — so neither a background file change nor an ordinary interaction resets the view. The only cases that SHALL reset the viewport are the first render of a project's roadmap and a switch to another project, where fitting the plan to the viewport is the intended behavior.

#### Scenario: Pan and zoom preserved on push
- **WHEN** the user has panned and zoomed to a region of the roadmap and the daemon pushes an updated model for the same project
- **THEN** the roadmap re-renders with the user's pan position and zoom level intact

#### Scenario: Pan and zoom preserved when selecting a change
- **WHEN** the user has panned and zoomed and then selects a change node or closes the detail panel
- **THEN** the board re-renders with the user's pan position and zoom level intact

#### Scenario: Project switch refits
- **WHEN** the user switches to a different project
- **THEN** the previous viewport is discarded and the new project's roadmap opens fitted

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

