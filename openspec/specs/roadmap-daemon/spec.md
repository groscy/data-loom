# roadmap-daemon Specification

## Purpose
TBD - created by archiving change scaffold-roadmap-daemon. Update Purpose after archive.
## Requirements
### Requirement: Local SPA serving
The daemon SHALL serve the data_loom browser SPA over `localhost` only, and SHALL NOT bind to a public network interface.

#### Scenario: SPA reachable on localhost
- **WHEN** the daemon is running and a browser requests the served page on `localhost`
- **THEN** the daemon returns the SPA

#### Scenario: Not exposed externally
- **WHEN** the daemon starts
- **THEN** it binds only to a loopback interface and does not accept connections from other hosts

### Requirement: Live push channel
The daemon SHALL maintain a websocket connection to the browser and SHALL push the current roadmap model to connected clients whenever that model changes. The browser SHALL receive derived state and SHALL NOT compute the roadmap itself.

#### Scenario: Client receives initial state on connect
- **WHEN** a browser opens a websocket connection to the daemon
- **THEN** the daemon sends the current roadmap model as the first message

#### Scenario: Client receives updates on change
- **WHEN** the roadmap model changes while a client is connected
- **THEN** the daemon pushes the updated model to that client without the client polling

### Requirement: OpenSpec workspace watching
The daemon SHALL watch the `openspec/` directory and SHALL trigger a recompute of the roadmap model when a change is added, edited, or archived. Rapid successive filesystem events SHALL be debounced into a single recompute.

#### Scenario: Edit triggers recompute and push
- **WHEN** a file under `openspec/changes/` is created or modified
- **THEN** the daemon recomputes the roadmap model and pushes it to connected clients

#### Scenario: Burst of edits coalesces
- **WHEN** multiple `openspec/` files change within the debounce window
- **THEN** the daemon performs a single recompute rather than one per file event

### Requirement: OpenSpec CLI availability check
The daemon SHALL verify the `openspec` CLI is available at startup and SHALL fail with a clear, actionable message if it is missing, rather than serving an empty roadmap.

#### Scenario: Missing CLI fails loudly
- **WHEN** the daemon starts and the `openspec` CLI cannot be invoked
- **THEN** the daemon reports a clear error identifying the missing CLI and does not start serving a blank roadmap

### Requirement: Read MCP config sources
The daemon SHALL read (read-only) the Claude Code MCP configuration sources needed for discovery — `~/.claude.json` and `~/.claude/.mcp.json` — without modifying them.

#### Scenario: Config read without mutation
- **WHEN** the daemon gathers MCP servers for the topology
- **THEN** it reads the Claude Code config sources and does not write to them

### Requirement: Serve topology tab and push availability
The daemon SHALL serve the topology (HOW) tab alongside the existing roadmap (WHAT) tab, accept user-triggered availability-check requests, and push availability results to connected clients over the existing websocket channel.

#### Scenario: Availability result pushed to clients
- **WHEN** an availability check completes for a server
- **THEN** the daemon pushes the result over the websocket to connected clients

#### Scenario: Both tabs served by one daemon
- **WHEN** a client connects
- **THEN** the daemon serves both the roadmap tab and the topology tab from the same local process

