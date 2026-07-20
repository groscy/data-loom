# atlas-derivation Specification

## Purpose
TBD - created by archiving change add-system-atlas. Update Purpose after archive.
## Requirements
### Requirement: Derived architecture-atlas model
The daemon SHALL assemble an architecture-atlas model as a pure function of the OpenSpec workspace, recomputed on every relevant file change and never stored. The model SHALL include an overview derived from the project's `openspec/config.yaml` context, one building block per settled capability under `openspec/specs/` (carrying that capability's requirement text and its behavior scenarios), and a decisions section derived from archived changes' `design.md` and proposal rationale.

#### Scenario: Model assembled from the workspace
- **WHEN** the daemon derives the atlas for a project with `config.yaml` context, settled `specs/`, and archived changes
- **THEN** the model carries an overview, one building block per settled capability with its requirements and scenarios, and a decisions section

#### Scenario: Recomputed on change, never stored
- **WHEN** a `specs/`, `changes/archive/`, or `config.yaml` file changes
- **THEN** the daemon recomputes the atlas model from the files, persisting no atlas state of its own

#### Scenario: A removed source leaves the model
- **WHEN** a source (a spec, a decision file) is removed from the workspace
- **THEN** the next derived model no longer contains it, because the model is derived rather than accumulated

### Requirement: Per-capability change history
For each building block the daemon SHALL derive a change history from the dated archive folders crossed with each archived proposal's new and modified capabilities: the date and change that introduced the capability, and the dates and changes that later modified it.

#### Scenario: Introduced date and change
- **WHEN** a capability was added by exactly one archived change
- **THEN** its history records that change and the change's archive date as the introduction

#### Scenario: Modification history accumulates
- **WHEN** later archived changes modify a capability
- **THEN** its history lists each modifying change with that change's archive date, in addition to the introduction

#### Scenario: Capability untouched by any change
- **WHEN** a settled capability has no archived change that adds or modifies it (e.g. a baseline-only spec)
- **THEN** its history is empty and the derivation does not error

### Requirement: Per-requirement change provenance
For each requirement within a settled capability, the daemon SHALL derive which archived change introduced it and which later changes modified it, by matching the requirement's title across the archived spec deltas — a title appearing under a change's `## ADDED Requirements` marks introduction, under `## MODIFIED Requirements` marks a modification — crossed with each change's archive date. A requirement whose title matches no archived delta SHALL carry an empty provenance without error.

#### Scenario: Requirement introduction identified
- **WHEN** a settled requirement's title appears under `## ADDED Requirements` in exactly one archived change's delta for that capability
- **THEN** its provenance records that change and the change's archive date as the introduction

#### Scenario: Requirement modification history
- **WHEN** a settled requirement's title later appears under `## MODIFIED Requirements` in one or more archived changes
- **THEN** its provenance lists each such change with that change's archive date, in addition to the introduction

#### Scenario: Requirement with no matching delta
- **WHEN** a settled requirement's title matches no archived spec delta (e.g. it predates the archive or its title was later renamed)
- **THEN** its provenance is empty and the derivation does not error

### Requirement: Loopback atlas content channel
The daemon SHALL serve the atlas model — including capability and decision prose — to the browser over the loopback interface, subject to the same Host and Origin validation as the rest of the daemon. The channel SHALL be read-only and SHALL expose only the project's own workspace content, carrying no secrets.

#### Scenario: Atlas served on loopback
- **WHEN** the loopback browser requests the atlas
- **THEN** the daemon responds with the assembled atlas model

#### Scenario: Non-loopback request rejected
- **WHEN** a request for the atlas arrives with a non-loopback Host or a non-loopback Origin
- **THEN** the daemon rejects it, consistent with its other endpoints

#### Scenario: Read-only channel
- **WHEN** the atlas channel is used
- **THEN** it offers no operation that writes to the workspace

### Requirement: Tolerant derivation
The atlas derivation SHALL degrade gracefully: a missing or empty `config.yaml` context, a capability whose `Purpose` is an unfilled placeholder, a change with no `design.md`, or an empty archive SHALL each reduce the corresponding part of the model without failing the whole.

#### Scenario: Missing overview source
- **WHEN** the project's `config.yaml` has no usable context
- **THEN** the model omits the overview and still carries the building blocks and decisions

#### Scenario: Placeholder capability purpose
- **WHEN** a capability's `Purpose` is the unfilled archive placeholder
- **THEN** its building block is still assembled from its requirement titles and scenarios

#### Scenario: Empty archive
- **WHEN** the project has no archived changes
- **THEN** the model carries building blocks with empty histories and no decisions section, without error

### Requirement: Derived capability relations from co-change coupling
The daemon SHALL derive relations between settled capabilities mechanically from the archived changes, with no natural-language analysis and no reading of project source code: two capabilities SHALL be related when one or more archived changes added or modified both, and each relation SHALL carry a weight equal to the number of such changes together with the names of those changes. Relations SHALL be undirected — a pair SHALL yield exactly one relation regardless of the order the capabilities appear in — and SHALL be recomputed with the rest of the model rather than stored. A change that touches more than a small bounded number of capabilities SHALL be excluded from relation derivation, because a workspace-wide change couples every capability to every other and carries no distinguishing signal.

#### Scenario: Two capabilities changed together are related
- **WHEN** an archived change lists both `atlas-view` and `atlas-derivation` among the capabilities it adds or modifies
- **THEN** the model carries one relation between those two capabilities, whose weight counts that change and whose change list names it

#### Scenario: Weight accumulates across changes
- **WHEN** several archived changes each touch the same pair of capabilities
- **THEN** the relation's weight equals the number of those changes and its change list names each of them

#### Scenario: Relations are undirected and deduplicated
- **WHEN** archived changes list a pair of capabilities in differing orders
- **THEN** the model carries a single relation for that pair rather than one per ordering

#### Scenario: A sweeping change is excluded
- **WHEN** an archived change touches more capabilities than the derivation's fan-out bound
- **THEN** that change contributes no relations, and relations derived from other changes are unaffected

#### Scenario: A change touching one capability relates nothing
- **WHEN** an archived change adds or modifies exactly one capability
- **THEN** it contributes no relation, and the derivation does not error

#### Scenario: An empty archive yields no relations
- **WHEN** the project has no archived changes
- **THEN** the model carries an empty relation set and the building blocks are still assembled

