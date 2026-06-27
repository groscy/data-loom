## ADDED Requirements

### Requirement: Discover selectable projects
The system SHALL offer as selectable projects the Claude Code known projects (from `~/.claude.json`) whose directory contains an `openspec/` workspace, de-duplicated by normalized path, and SHALL always include the currently active project even if it is not in that list.

#### Scenario: Only viewable projects offered
- **WHEN** the project candidates are listed
- **THEN** each candidate directory contains an `openspec/` workspace

#### Scenario: Active project always present
- **WHEN** the active project is not among the Claude Code known projects
- **THEN** it still appears as a candidate

### Requirement: Select a project at runtime
The system SHALL allow selecting a different project at runtime, and on selection SHALL re-scope the roadmap derivation, the file-watching, and the MCP project-scoped discovery to the selected project, without requiring a restart.

#### Scenario: Selection re-scopes the dashboard
- **WHEN** the user selects a different valid project
- **THEN** the roadmap, the watched directory, and the MCP project-scope all switch to that project and the clients receive the updated state

### Requirement: Reject an invalid project selection
The system SHALL reject a selection whose path does not contain an `openspec/` workspace, SHALL keep the previously active project, and SHALL report the error.

#### Scenario: Path without an openspec workspace is rejected
- **WHEN** the user selects a path that has no `openspec/` directory
- **THEN** the selection is rejected, the active project is unchanged, and an error is reported

### Requirement: Expose the active project
The system SHALL expose which project is currently active so clients can display it.

#### Scenario: Active project reported to clients
- **WHEN** a client connects or the project changes
- **THEN** the system provides the current active project identity
