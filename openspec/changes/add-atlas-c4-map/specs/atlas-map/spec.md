## ADDED Requirements

### Requirement: The atlas opens on a navigable map
The atlas view SHALL open on a map of the settled system rather than on the documentation prose, and that map SHALL be the primary means of navigating the atlas. The map SHALL be derived entirely from the atlas model, SHALL be strictly read-only, and SHALL present no control that edits a spec, a proposal, or any workspace content. When the workspace has no settled capabilities the map SHALL show the same empty state the atlas shows today rather than an empty canvas.

#### Scenario: Atlas tab opens on the map
- **WHEN** the user selects the atlas view
- **THEN** the map is shown, framed by the workspace overview, rather than the scrolling documentation

#### Scenario: Map reflects a live push
- **WHEN** the daemon pushes an updated atlas model
- **THEN** the map re-renders to match without the user reloading the page

#### Scenario: Empty workspace
- **WHEN** the atlas model carries no building blocks
- **THEN** the view shows the atlas empty state instead of an empty map canvas

#### Scenario: No edit affordance on the map
- **WHEN** the user interacts with any node, edge, or control on the map
- **THEN** no control offered would write to the workspace

### Requirement: Drill-down through nested levels
The map SHALL present the system as nested levels in the manner of a C4 diagram, where each level shows the contents of a single node of the level above: a system level whose nodes are the atlas model's domain groups, a domain level whose nodes are the building blocks of one opened group, and a capability level whose nodes are the requirements of one opened building block. Activating a node SHALL descend to the level that node contains. The view SHALL show the current position as a breadcrumb trail from the system level down, SHALL allow returning to any ancestor level from that trail, and SHALL allow ascending one level by keyboard. Each level SHALL open fitted to the viewport so the whole of the arriving level is visible before the user navigates it.

#### Scenario: Descending from system to domain
- **WHEN** the user activates a domain-group node at the system level
- **THEN** the map shows that group's building blocks as its nodes, and the breadcrumb names the group

#### Scenario: Descending from domain to capability
- **WHEN** the user activates a building-block node at the domain level
- **THEN** the map shows that block's requirements as its nodes, and the breadcrumb names the group and the block

#### Scenario: Ascending by breadcrumb
- **WHEN** the user activates an ancestor entry in the breadcrumb trail
- **THEN** the map returns to that level

#### Scenario: Ascending by keyboard
- **WHEN** the user presses Escape below the system level
- **THEN** the map ascends exactly one level

#### Scenario: Each level opens fitted
- **WHEN** the user arrives at any level
- **THEN** that level's whole content is fitted within the viewport rather than inheriting the previous level's pan and zoom

#### Scenario: A group holding one block
- **WHEN** the user opens a singleton group that contains exactly one building block
- **THEN** the domain level renders that single block legibly rather than as a degenerate or empty layout

### Requirement: Handoff from the map into the atlas document
Descending below the capability level SHALL hand off to the atlas documentation for the building block in question, positioned at that block and — when the descent started from a requirement node — with that requirement's detail opened. The documentation SHALL remain the existing atlas document, unchanged in what it presents. The view SHALL offer a way back to the map at the level the user left, so the map and the document read as one navigation trail rather than two disconnected views.

#### Scenario: Requirement node opens its documentation
- **WHEN** the user activates a requirement node at the capability level
- **THEN** the atlas document is shown, positioned at that requirement's building block, with that requirement's normative text and scenarios expanded

#### Scenario: Building block opens its documentation
- **WHEN** the user chooses to open a building block's documentation from the domain level
- **THEN** the atlas document is shown, positioned at that building block

#### Scenario: Returning from the document to the map
- **WHEN** the user returns from the document
- **THEN** the map is shown at the level the user left it

#### Scenario: Document navigation still works
- **WHEN** the user is in the document and uses its existing navigation, such as the recency summary links or expanding a requirement
- **THEN** those behave as they did before the map was introduced

### Requirement: Relations drawn between the parts
The map SHALL draw the capability relations carried by the atlas model as connections between nodes: at the domain level between the building blocks of the opened group, and at the system level between domain groups, aggregating the relations that cross group boundaries. The visual weight of a connection SHALL reflect the relation's weight. Because these relations record that capabilities changed together rather than that one depends on another, they SHALL be presented as undirected — without direction indicators — and SHALL be described to the user in those terms rather than as dependencies, so they cannot be mistaken for the roadmap's ordering edges. When the model carries no relations the map SHALL render without connections and SHALL omit any legend for them, rather than presenting an empty or misleading affordance.

#### Scenario: Relations shown between building blocks
- **WHEN** the user opens a group whose building blocks are related in the model
- **THEN** the map draws a connection between those blocks

#### Scenario: Relations aggregated at the system level
- **WHEN** relations exist between capabilities that belong to different domain groups
- **THEN** the system level draws a connection between those groups whose visual weight reflects the combined weight of the crossing relations

#### Scenario: Stronger coupling reads as stronger
- **WHEN** one relation has a higher weight than another on the same level
- **THEN** its connection is drawn with greater visual weight

#### Scenario: Relations described honestly
- **WHEN** the user inspects a connection
- **THEN** it is described as the capabilities having changed together across a number of archived changes, not as a dependency, and it carries no direction indicator

#### Scenario: A workspace with no archive
- **WHEN** the atlas model carries no relations
- **THEN** the map renders its nodes without connections and shows no relations legend

### Requirement: Recency marks carried onto the map
The map SHALL mark nodes whose content changed since the user's last visit, using the same last-visit reference and the same distinction between newly introduced and merely modified content that the atlas document uses. A node SHALL be marked when anything it contains is marked, so the system level answers what moved before the user drills into it. The map SHALL NOT introduce a second, separate last-visit reference, and viewing the map SHALL update the existing reference exactly as viewing the atlas does today.

#### Scenario: A group is marked from its contents
- **WHEN** a requirement inside a building block inside a domain group changed since the last visit
- **THEN** that group's node is marked at the system level, its block is marked at the domain level, and the requirement is marked at the capability level

#### Scenario: New distinguished from modified
- **WHEN** the map marks nodes
- **THEN** a node whose content was introduced since the last visit is rendered distinctly from one whose content was merely modified since then

#### Scenario: Marks clear once seen
- **WHEN** the user has viewed the atlas, or used the document's "mark all read"
- **THEN** the map's marks clear on the same terms as the document's, and the cleared state survives a reload

#### Scenario: First visit marks nothing
- **WHEN** the user opens the atlas with no stored last-visit reference
- **THEN** the map marks no node as changed

### Requirement: Map navigation matches the other boards
The map SHALL be navigated by the same pan, zoom and fit contract as the roadmap and MCP topology boards: dragging SHALL pan, the wheel SHALL pan with a modifier zooming, on-screen controls SHALL zoom in, zoom out and fit, and keyboard control SHALL pan with the arrow keys, zoom with plus and minus, and fit with zero. Zooming out SHALL always be able to reach the whole of the current level, and panning SHALL always keep part of the canvas on screen. Where a level's content exceeds the viewport, an overview minimap SHALL be offered that reflects that level's nodes and the current viewport, and SHALL be hidden when the whole level already fits. A level SHALL grow its canvas as its node count grows rather than compressing its nodes to fit a fixed area.

#### Scenario: Pan and zoom by pointer
- **WHEN** the user drags the map background, or uses the wheel with and without the zoom modifier
- **THEN** the map pans and zooms as the roadmap and topology boards do

#### Scenario: Keyboard navigation
- **WHEN** the map has keyboard focus and the user presses an arrow key, plus, minus, or zero
- **THEN** the map pans, zooms in, zooms out, or fits the current level respectively

#### Scenario: The whole level is always reachable
- **WHEN** a level's content is larger than the viewport and the user zooms out fully
- **THEN** the whole level is visible, and panning cannot leave the viewport blank

#### Scenario: Minimap appears only when useful
- **WHEN** a level's content exceeds the viewport
- **THEN** the minimap is shown reflecting that level's nodes and the current viewport, and it is hidden again on a level that fits entirely

#### Scenario: Many nodes grow the canvas
- **WHEN** a level contains many more nodes than another
- **THEN** its canvas is larger rather than its nodes being drawn smaller

#### Scenario: Map first rendered while hidden
- **WHEN** the atlas model arrives while the atlas view is not the selected view, and the user then selects it
- **THEN** the map is laid out and fitted for the now-visible viewport rather than left unfitted or mis-measured
