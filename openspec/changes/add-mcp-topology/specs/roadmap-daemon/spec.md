## ADDED Requirements

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
