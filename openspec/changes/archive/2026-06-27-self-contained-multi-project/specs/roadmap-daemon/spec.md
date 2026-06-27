## ADDED Requirements

### Requirement: Runtime-selectable target project
The daemon SHALL treat the target project as runtime state rather than a value fixed at startup. On a project switch it SHALL stop watching the previous project's `openspec/` directory, recompute the roadmap and MCP discovery for the newly selected project, and begin watching the new project's `openspec/` directory — all without a restart.

#### Scenario: Watcher re-points on project switch
- **WHEN** the active project is switched
- **THEN** the daemon stops watching the previous `openspec/` directory and watches the new project's `openspec/` directory

#### Scenario: Recompute on switch
- **WHEN** the active project is switched to a valid project
- **THEN** the daemon recomputes the roadmap for the new project and pushes it to connected clients
