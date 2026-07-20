## MODIFIED Requirements

### Requirement: Hub-and-spoke centered on Claude Code
The topology view SHALL render a hub-and-spoke layout with Claude Code as the single hub at the center and each discovered MCP server as a spoke. The vertical spacing between adjacent servers SHALL never fall below a minimum legible pitch. While the servers fit the canvas at its base size they SHALL be distributed across it; once distributing them would breach that minimum, the pitch SHALL hold and the canvas SHALL grow instead, so servers never overlap, clip, or become unreadable as the count rises. The layout SHALL stay centered on the canvas at every count.

#### Scenario: Claude Code is the center
- **WHEN** the topology view renders the discovered servers
- **THEN** Claude Code appears as the central hub and each server radiates from it

#### Scenario: Many servers do not overlap
- **WHEN** the topology renders more servers than the canvas holds at its base size
- **THEN** the canvas grows and every server card stays fully visible and separated from its neighbours

#### Scenario: Spacing never falls below the minimum
- **WHEN** the topology renders any number of servers
- **THEN** the vertical gap between adjacent server cards is at least the minimum legible pitch

#### Scenario: Small topologies are unchanged
- **WHEN** the servers still fit the canvas at its base size
- **THEN** they are distributed across it exactly as they were before the canvas could grow, and the canvas keeps its base size

## ADDED Requirements

### Requirement: Pan and zoom the topology canvas
The topology canvas SHALL be presented inside a fixed viewport that clips it, and SHALL NOT present a scrollbar on either axis. The view SHALL let the user pan the canvas by dragging it and by wheel or trackpad gesture, and zoom it between a minimum and a maximum scale. Zooming SHALL keep the point under the pointer stationary. Panning SHALL be constrained so at least part of the canvas always remains within the viewport. When the whole canvas fits within the viewport it SHALL remain centered. Dragging a server card SHALL neither move that card nor select it — card positions are derived from the discovered servers and are never edited by the view.

#### Scenario: Oversized canvas pans
- **WHEN** the topology canvas is larger than the viewport in either axis
- **THEN** the user can pan to bring any part of it into view, and no scrollbar is shown on either axis

#### Scenario: Small topology stays centered
- **WHEN** the whole topology canvas fits within the viewport
- **THEN** it is centered and no scrollbar is shown on either axis

#### Scenario: Zoom keeps the pointer anchored
- **WHEN** the user zooms with the pointer over a particular server card
- **THEN** the scale changes and that card stays under the pointer

#### Scenario: Canvas cannot be lost off-screen
- **WHEN** the user pans far past the edge of the canvas
- **THEN** panning stops with part of the canvas still visible in the viewport

#### Scenario: Dragging a card neither moves nor selects it
- **WHEN** the user presses on a server card and drags
- **THEN** the card does not move from its derived position, and releasing the drag does not open that server's detail

#### Scenario: Connections stay anchored
- **WHEN** the topology is panned or zoomed
- **THEN** each server's connection to the hub remains drawn between the hub and that server's card at their actual canvas positions

### Requirement: Minimap overview of the topology
The view SHALL present a minimap: a scaled overview of the entire topology canvas showing the hub and every server card in its true relative position, together with an indicator of which region the viewport currently shows. The minimap SHALL be shown whenever the canvas has grown beyond its base size, or is larger than its viewport in either axis, and SHALL be hidden otherwise. It SHALL be a navigation control — clicking or dragging within it SHALL move the viewport to the corresponding region. It SHALL stay in sync as the user pans, zooms, changes the scope filter, and as the daemon pushes new server state.

#### Scenario: Minimap appears for an oversized canvas
- **WHEN** the topology canvas is larger than the viewport in either axis, or has grown beyond its base size to fit the servers
- **THEN** the view shows a minimap depicting the whole canvas with the hub and every server card

#### Scenario: Minimap hidden for a small topology
- **WHEN** the canvas is at its base size and fits within the viewport
- **THEN** no minimap is shown

#### Scenario: Viewport indicator reflects the current view
- **WHEN** the user pans or zooms the topology
- **THEN** the minimap's viewport indicator moves and resizes to match the region now shown

#### Scenario: Click the minimap to jump
- **WHEN** the user clicks or drags a position within the minimap
- **THEN** the canvas viewport moves to show the corresponding region of the topology

#### Scenario: Minimap follows a scope change
- **WHEN** the user changes the scope filter so a different set of servers is rendered
- **THEN** the minimap re-renders to depict the new canvas

### Requirement: Topology viewport controls and keyboard navigation
The view SHALL provide explicit controls to zoom in, zoom out, and fit the whole topology to the viewport, and SHALL support the same navigation from the keyboard so the canvas is usable without a pointing device: arrow keys pan, `+` / `-` zoom, and `0` fits. On first render of a project's topology, and whenever the user switches projects, the view SHALL fit the topology to the viewport.

#### Scenario: Fit to view
- **WHEN** the user triggers the fit control
- **THEN** the zoom and pan adjust so the entire canvas is visible within the viewport

#### Scenario: Initial render is fitted
- **WHEN** a project's topology is rendered for the first time, or the user switches to another project
- **THEN** the canvas opens fitted to the viewport

#### Scenario: Keyboard panning and zooming
- **WHEN** the topology canvas has keyboard focus and the user presses an arrow key, `+`, `-`, or `0`
- **THEN** the canvas pans, zooms in, zooms out, or fits to the viewport respectively

### Requirement: Topology viewport survives re-renders
The reader's pan position and zoom level SHALL survive every re-render of the topology within a project — whether triggered by a pushed server model, a single server's state update, a liveness check starting or failing, selecting a server, or closing the detail panel. Changing the scope filter SHALL also preserve the viewport, since it is a filter on the same topology rather than a different one. The only cases that SHALL reset the viewport are the first render of a project's topology and a switch to another project.

#### Scenario: Pan and zoom preserved on a server state push
- **WHEN** the user has panned and zoomed and the daemon pushes updated server state for the same project
- **THEN** the topology re-renders with the user's pan position and zoom level intact

#### Scenario: Pan and zoom preserved when selecting a server
- **WHEN** the user has panned and zoomed and then selects a server or closes the detail panel
- **THEN** the topology re-renders with the user's pan position and zoom level intact

#### Scenario: Pan and zoom preserved across a liveness check
- **WHEN** the user triggers an availability check and the result arrives
- **THEN** the topology re-renders with the user's pan position and zoom level intact

#### Scenario: Pan and zoom preserved across a scope change
- **WHEN** the user changes the scope filter
- **THEN** the topology re-renders with the user's pan position and zoom level intact

#### Scenario: Project switch refits
- **WHEN** the user switches to a different project
- **THEN** the previous viewport is discarded and the new project's topology opens fitted
