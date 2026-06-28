## MODIFIED Requirements

### Requirement: Expose open proposals as a tool
The server SHALL provide a tool that returns the open (non-archived) changes with their name, proposal content (Why / What Changes / Capabilities), current derived dependencies, phase, and readiness, and each change's dependency-review state (`pending` when its proposal has no `## Depends On` heading, `declared` when that heading is present). This tool SHALL be read-only.

#### Scenario: Open proposals returned
- **WHEN** the client calls the list-open-proposals tool
- **THEN** the server returns each open change's name, proposal content, current dependencies/phase/readiness, and its dependency-review state, and modifies no files

#### Scenario: Pending review state surfaced
- **WHEN** an open change's proposal has no `## Depends On` heading
- **THEN** the tool reports that change's dependency-review state as `pending`

## ADDED Requirements

### Requirement: Guide dependency review on connect
The server SHALL advertise connect-time instructions that direct the connecting agent, when any open proposal's dependency-review state is `pending`, to read those proposals, propose dependency edges (or independence) to the user, and obtain the user's confirmation before writing any declaration. The server SHALL NOT itself infer dependencies and holds no model with which to do so.

#### Scenario: Connect-time instructions advertise the review workflow
- **WHEN** an MCP client completes the handshake with the server
- **THEN** the server's advertised instructions tell the agent to review pending proposals and to confirm with the user before writing any declaration

#### Scenario: Server performs no inference of its own
- **WHEN** one or more proposals are pending review
- **THEN** the server neither computes nor writes any dependency on its own, and a declaration is written only when the agent calls a write tool

### Requirement: Declare a change independent as a tool
The server SHALL provide a tool that, given one open change name, records that the change depends on nothing by writing an empty `## Depends On` declaration into that change's proposal — moving its dependency-review state from `pending` to `declared` without adding any dependency edge. It SHALL validate that the change is a known open change, and SHALL be idempotent so that declaring an already-declared change writes nothing new.

#### Scenario: Independence written as an empty declaration
- **WHEN** the client calls the mark-independent tool with a valid open change
- **THEN** an empty `## Depends On` section is written into that change's proposal, its review state becomes `declared`, and no dependency edge is added

#### Scenario: Unknown change rejected
- **WHEN** the client calls mark-independent with a name that is not a known open change
- **THEN** the tool rejects the call and writes nothing
