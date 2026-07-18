# atlas-view Specification

## Purpose
TBD - created by archiving change add-system-atlas. Update Purpose after archive.
## Requirements
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
When the user opens a building block, the view SHALL present it as an outline of its requirement titles that expand on demand, so that a capability with one requirement and a capability with many requirements both read well without a fixed, density-blind layout. Each requirement SHALL be expandable to its normative text and its behavior scenarios. Requirements marked as changed since the user's last visit SHALL be expanded by default, while unchanged requirements SHALL remain collapsed to their titles, so the new material is what the reader sees first. The view SHALL also present, per capability, a "shaping decisions and history" section listing the archived changes that introduced or modified the capability's requirements — newest first, each with its rationale (its proposal "Why" and design decisions) — and each requirement SHALL link to the entry for the change that shaped it.

#### Scenario: Requirement outline expands on demand
- **WHEN** the user opens a building block with many requirements
- **THEN** the view shows the requirement titles as an outline, and expanding one reveals that requirement's normative text and behavior scenarios

#### Scenario: Small and large capabilities both read well
- **WHEN** the user opens a capability with a single requirement and later one with many
- **THEN** each renders legibly under the same outline layout, the small one effectively fully shown and the large one scannable by title

#### Scenario: Changed requirements are expanded first
- **WHEN** a building block contains requirements changed since the last visit alongside unchanged ones
- **THEN** the changed requirements are expanded by default and the unchanged ones remain collapsed to their titles

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

### Requirement: Since-last-visit recency overlay
The view SHALL mark what changed since the user's last visit at both capability and requirement granularity — the building blocks and their enclosing groups, and the individual requirements within a block — using the change provenance carried in the atlas model. It SHALL distinguish items newly introduced since the last visit from items merely modified since then. The view SHALL present a summary that links directly to the changed building blocks and the changed requirements within them. The last-visit reference SHALL be persisted locally to the user's browser and SHALL NOT be written to the workspace. Viewing the atlas SHALL update that reference, and the view SHALL also provide an explicit "mark all read", so marks clear once seen. On the first visit, with no prior reference, the view SHALL establish the baseline such that existing content is not shown as changed.

#### Scenario: Changed capability and requirement marked
- **WHEN** a requirement's provenance shows it was introduced or modified by a change dated after the user's last visit
- **THEN** the view marks that requirement, and marks its enclosing building block and group as changed

#### Scenario: New distinguished from modified
- **WHEN** the overlay marks changed items
- **THEN** an item introduced since the last visit is rendered distinctly from an item merely modified since then, at both the block and the requirement level

#### Scenario: Summary links to the changed parts
- **WHEN** one or more requirements are marked as changed
- **THEN** the view shows a summary count that links directly to the changed building blocks and requirements

#### Scenario: Marks clear once seen
- **WHEN** the user views the atlas or activates "mark all read"
- **THEN** the last-visit reference advances and the change marks clear, and the cleared state survives a reload

#### Scenario: First visit shows nothing as stale
- **WHEN** the user opens the atlas with no stored last-visit reference
- **THEN** the view establishes the baseline and marks no existing content as changed

#### Scenario: Nothing changed since last visit
- **WHEN** no change has been archived since the user's last visit
- **THEN** the view marks nothing and shows no outstanding-changes summary

