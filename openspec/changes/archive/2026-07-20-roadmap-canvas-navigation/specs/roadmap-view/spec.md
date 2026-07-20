## MODIFIED Requirements

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

## RENAMED Requirements

### Requirement: Pan the roadmap canvas without scrollbars
- FROM: `### Requirement: Horizontal scrolling for wide roadmaps`
- TO: `### Requirement: Pan the roadmap canvas without scrollbars`

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Archived changes as a collapsed done band
**Reason**: Superseded by the System Atlas. The Atlas's *Decisions & rationale* section lists every archived change chronologically with its date and recorded rationale, and each settled capability and requirement carries provenance linking back to the archived change that introduced or modified it — so history is read where it carries meaning. The roadmap band was a bare list of change names occupying space that the active plan now uses.

**Migration**: Read archived changes in the Atlas view. No data changes: the roadmap model still carries archived changes (derivation and the Atlas both depend on them); only the roadmap band is removed. The roadmap tab now shows open changes exclusively.
