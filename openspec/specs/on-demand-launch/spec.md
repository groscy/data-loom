# on-demand-launch Specification

## Purpose
TBD - created by archiving change on-demand-daemon. Update Purpose after archive.
## Requirements
### Requirement: Stdio shim launches the daemon on demand
The `data-loom` CLI SHALL provide an MCP stdio shim subcommand intended to be spawned by an MCP client. On startup the shim SHALL check whether the daemon answers on the loopback port; when it does not, the shim SHALL start the daemon through the existing detached lifecycle path and wait, bounded in time, for the port to answer. The launched daemon SHALL be a normal daemon in every respect (dashboard, single-instance guard, log file, tray). When two shims race to launch, the single-instance guard SHALL result in exactly one daemon serving both.

#### Scenario: Cold start on first use
- **WHEN** an MCP client spawns the shim while no daemon is running
- **THEN** the shim starts the daemon detached, waits for the loopback port to answer, and completes the client's MCP handshake against the running daemon

#### Scenario: Running daemon is reused
- **WHEN** an MCP client spawns the shim while a daemon is already running
- **THEN** the shim starts nothing and proxies to the existing daemon

#### Scenario: Concurrent shims yield one daemon
- **WHEN** two MCP clients spawn shims at the same time with no daemon running
- **THEN** exactly one daemon results and both shims complete their handshakes against it

### Requirement: Shim is a pure proxy
The shim SHALL forward MCP traffic between its stdio transport and the daemon's loopback HTTP MCP endpoint without defining tools, prompts, or sessions of its own — the daemon remains the single MCP server and source of truth, including per-call project resolution. The shim SHALL exit when its client session ends and SHALL NOT stop the daemon.

#### Scenario: Tools are the daemon's tools
- **WHEN** a client lists tools through the shim
- **THEN** the result is exactly what the daemon's MCP endpoint serves, with no shim-added or shim-altered entries

#### Scenario: Daemon outlives the session
- **WHEN** the client session ends and the shim process exits
- **THEN** the daemon keeps running and remains reachable for the dashboard and other clients

### Requirement: Instructive failure when launch is impossible
When the daemon cannot be brought up (for example the openspec prerequisite is missing or the port never answers within the bounded wait), the shim SHALL fail the MCP handshake with an instructive error that names the concrete next step (the prerequisite install command when identifiable, otherwise where to find `data-loom status` and the daemon log). The shim SHALL NOT hang indefinitely and SHALL NOT exit silently before responding.

#### Scenario: Missing prerequisite is surfaced
- **WHEN** the shim's launch attempt fails because the openspec CLI is missing
- **THEN** the client receives an error naming the openspec install command rather than a generic transport failure

#### Scenario: Bounded wait, then diagnosis
- **WHEN** the daemon does not answer on the port within the shim's bounded wait
- **THEN** the shim responds with an error pointing at `data-loom status` and the log location, then exits
