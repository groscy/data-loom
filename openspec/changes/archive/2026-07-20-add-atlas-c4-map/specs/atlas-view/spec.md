## MODIFIED Requirements

### Requirement: Separate atlas subpage
The view SHALL present the atlas as a distinct subpage, selectable alongside the roadmap and MCP topology views, and SHALL render only the documentation sections the workspace populates (overview, building blocks, decisions) rather than a fixed full template. Within that subpage the atlas SHALL be structured as a navigable map of the settled system and the documentation it leads into: selecting the atlas SHALL open the map, and the documentation SHALL be reached by drilling into a building block from the map. The documentation SHALL continue to present the same sections it presents today, and SHALL remain reachable and fully readable — including its own scrolling, its section anchors and its recency summary — once entered.

#### Scenario: Atlas selectable as its own view
- **WHEN** the user selects the atlas from the view navigation
- **THEN** the view shows the atlas subpage in place of the roadmap and topology views

#### Scenario: Only populated sections shown
- **WHEN** the atlas model has no content for a section (e.g. no decisions)
- **THEN** that section is omitted rather than rendered as an empty heading

#### Scenario: The map is the subpage's entry point
- **WHEN** the user selects the atlas
- **THEN** the map of the settled system is what the subpage shows first, with the documentation reached by drilling into a building block

#### Scenario: The documentation remains fully readable
- **WHEN** the user reaches the documentation from the map
- **THEN** it scrolls, expands and links within the atlas subpage exactly as it did when it was the subpage's only content

### Requirement: Building-block page layout
When the user opens a building block, the view SHALL present it as an outline of its requirement titles that expand on demand, so that a capability with one requirement and a capability with many requirements both read well without a fixed, density-blind layout. Each requirement SHALL be expandable to its normative text and its behavior scenarios. Requirements marked as changed since the user's last visit SHALL be expanded by default, while unchanged requirements SHALL remain collapsed to their titles, so the new material is what the reader sees first. When the user enters the documentation targeting a specific requirement, that requirement SHALL be expanded and brought into view regardless of whether it is marked as changed. The view SHALL also present, per capability, a "shaping decisions and history" section listing the archived changes that introduced or modified the capability's requirements — newest first, each with its rationale (its proposal "Why" and design decisions) — and each requirement SHALL link to the entry for the change that shaped it.

#### Scenario: Requirement outline expands on demand
- **WHEN** the user opens a building block with many requirements
- **THEN** the view shows the requirement titles as an outline, and expanding one reveals that requirement's normative text and behavior scenarios

#### Scenario: Small and large capabilities both read well
- **WHEN** the user opens a capability with a single requirement and later one with many
- **THEN** each renders legibly under the same outline layout, the small one effectively fully shown and the large one scannable by title

#### Scenario: Changed requirements are expanded first
- **WHEN** a building block contains requirements changed since the last visit alongside unchanged ones
- **THEN** the changed requirements are expanded by default and the unchanged ones remain collapsed to their titles

#### Scenario: A targeted requirement is expanded on entry
- **WHEN** the user enters the documentation targeting a specific requirement that is not marked as changed
- **THEN** that requirement is expanded and scrolled into view

#### Scenario: Shaping history with rationale
- **WHEN** the user views a capability's "shaping decisions and history" section
- **THEN** the archived changes that shaped it are listed newest first, each showing its rationale, and a requirement links to the change that shaped it
