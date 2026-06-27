# topology-view Specification

## Purpose
TBD - created by archiving change add-mcp-topology. Update Purpose after archive.
## Requirements
### Requirement: Hub-and-spoke centered on Claude Code
The topology view SHALL render a hub-and-spoke layout with Claude Code as the single hub at the center and each discovered MCP server as a spoke.

#### Scenario: Claude Code is the center
- **WHEN** the topology view renders the discovered servers
- **THEN** Claude Code appears as the central hub and each server radiates from it

### Requirement: Scope shown per spoke
The topology view SHALL visually distinguish global servers from project-scoped servers (e.g. via edge styling), so the user can see why a given server is or is not attached in the current context.

#### Scenario: Global vs project spokes distinguishable
- **WHEN** the server list contains both global and project-scoped servers
- **THEN** the view renders their spokes with a distinguishable treatment for scope

### Requirement: Liveness state per server
The topology view SHALL display each server's availability state (e.g. available / unreachable / needs-auth / on-demand / already-running / unknown) and its last-checked time when known.

#### Scenario: State shown on each server
- **WHEN** an availability result exists for a server
- **THEN** the view shows that server's state and last-checked time

#### Scenario: Unknown before first check
- **WHEN** a server has not yet been checked
- **THEN** the view shows it in an unknown state rather than implying it is down

### Requirement: User-triggered availability check
The topology view SHALL let the user trigger an availability check for a server on demand, and SHALL update that server's displayed state when the result arrives. It SHALL NOT offer to start or launch servers.

#### Scenario: Check on demand updates state
- **WHEN** the user triggers a check for a server
- **THEN** the view requests the check and updates that server's state when the daemon returns the result

