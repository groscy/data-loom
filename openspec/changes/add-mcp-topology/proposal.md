## Why

Once the roadmap answers "what do I develop?", the other half of the workflow is "how / with what do I develop?" — the local MCP setup. A spec-driven session depends on MCP servers (ComfyUI, Blender, browser tooling, project bridges) being reachable, but their config is scattered across Claude Code's config files and nothing shows, at a glance, what exists and what is actually up. This change adds the HOW tab: a hub-and-spoke topology of the local MCP setup with passive availability state, so the user can see what's reachable and start whatever is missing.

This change builds on the daemon and view foundation from `scaffold-roadmap-daemon` (Phase 1); it is Phase 2.

## What Changes

- Extend the daemon to **discover** MCP servers by merging Claude Code config sources — `~/.claude.json` (global `mcpServers` plus per-project `mcpServers`) and `~/.claude/.mcp.json` — and de-duplicating scope-duplicated entries. Server scope (global vs project) is retained as a visible property.
- Add **passive, transport-aware availability** checks. The dashboard is a MIRROR, never a launcher — it MUST NOT spawn or start any application:
  - URL servers (http / sse / streamable-http): connect to the already-listening endpoint; available = it answers.
  - stdio servers: nothing is listening, so state is "on-demand", with best-effort "already-running" only if a matching process is found in the OS process table. Never spawn it.
  - Availability is checked on demand (per server), result cached with a last-checked timestamp; never auto-launched.
- Add the **topology view (HOW tab)**: hub-and-spoke with Claude Code as the single hub at the center, servers as spokes, scope shown via edge styling, and liveness state per server (e.g. available / unreachable / needs-auth / on-demand / already-running / unknown).
- Extend the daemon to serve this second tab alongside the existing roadmap tab and push availability results over the same websocket.

## Capabilities

### New Capabilities
- `mcp-discovery`: Merge and de-duplicate MCP server definitions from Claude Code config sources into a single scoped server list (global vs project), generic across all transport types.
- `mcp-availability`: Passive, transport-aware availability checking that never launches anything — connect for URL servers, on-demand/process-detect for stdio servers — producing a per-server liveness state with a last-checked timestamp.
- `topology-view`: The browser "HOW / with what?" tab — hub-and-spoke topology centered on Claude Code, rendering scope and liveness state per server.

### Modified Capabilities
- `roadmap-daemon`: The daemon gains responsibility for reading MCP config sources, running passive availability checks on demand, serving the topology tab, and pushing availability results over the existing websocket — in addition to its roadmap duties.

## Impact

- Reads (read-only) the user's Claude Code config files: `~/.claude.json` and `~/.claude/.mcp.json`.
- Performs outbound localhost/endpoint connections for URL-based servers and OS process-table inspection for stdio servers; performs no process spawning.
- Depends on `scaffold-roadmap-daemon` (modifies its `roadmap-daemon` capability) — this is the dependency edge placing this change in Phase 2.
