## ADDED Requirements

### Requirement: Separate atlas subpage
The view SHALL present the atlas as a distinct subpage, selectable alongside the roadmap and MCP topology views, and SHALL render only the documentation sections the workspace populates (overview, building blocks, decisions) rather than a fixed full template.

#### Scenario: Atlas selectable as its own view
- **WHEN** the user selects the atlas from the view navigation
- **THEN** the view shows the atlas subpage in place of the roadmap and topology views

#### Scenario: Only populated sections shown
- **WHEN** the atlas model has no content for a section (e.g. no decisions)
- **THEN** that section is omitted rather than rendered as an empty heading

### Requirement: Building blocks grouped by the project's own domain
The view SHALL group building blocks using the project's own domain rather than any DataLoom-specific taxonomy: the `config.yaml` overview SHALL frame the domains, and capabilities SHALL cluster by shared name affinity, with capabilities that share no group standing on their own. The grouping SHALL contain no hardcoded, project-specific category names.

#### Scenario: Capabilities sharing a name prefix grouped together
- **WHEN** several capabilities share a leading name token (e.g. `roadmap-view`, `roadmap-derivation`)
- **THEN** the view renders them together under that shared domain

#### Scenario: An unshared capability stands alone
- **WHEN** a capability shares no multi-member name prefix with any other
- **THEN** the view renders it as its own block rather than forcing it into an unrelated group

#### Scenario: No hardcoded groups
- **WHEN** the atlas renders a project whose capability names differ from DataLoom's
- **THEN** the groups follow that project's own names, with no DataLoom-specific category baked in

### Requirement: Building-block page layout
When the user opens a building block, the view SHALL present it as an outline of its requirement titles that expand on demand, so that a capability with one requirement and a capability with many requirements both read well without a fixed, density-blind layout. Each requirement SHALL be expandable to its normative text and its behavior scenarios. The view SHALL also present, per capability, a "shaping decisions and history" section listing the archived changes that introduced or modified the capability's requirements — newest first, each with its rationale (its proposal "Why" and design decisions) — and each requirement SHALL link to the entry for the change that shaped it.

#### Scenario: Requirement outline expands on demand
- **WHEN** the user opens a building block with many requirements
- **THEN** the view shows the requirement titles as an outline, and expanding one reveals that requirement's normative text and behavior scenarios

#### Scenario: Small and large capabilities both read well
- **WHEN** the user opens a capability with a single requirement and later one with many
- **THEN** each renders legibly under the same outline layout, the small one effectively fully shown and the large one scannable by title

#### Scenario: Shaping history with rationale
- **WHEN** the user views a capability's "shaping decisions and history" section
- **THEN** the archived changes that shaped it are listed newest first, each showing its rationale, and a requirement links to the change that shaped it

### Requirement: Live, read-only atlas
The atlas SHALL update to reflect a newly pushed atlas model without a manual page refresh, and SHALL be strictly read-only — presenting no affordance to edit specs, proposals, or any workspace content — consistent with DataLoom's mirror-never-launcher stance.

#### Scenario: Atlas updates on push
- **WHEN** the daemon pushes an updated atlas model (a spec edited, or a change archived)
- **THEN** the atlas re-renders to match without the user reloading the page

#### Scenario: No edit affordance
- **WHEN** the user views any part of the atlas
- **THEN** the view presents no control that would edit a spec, a proposal, or any workspace content
