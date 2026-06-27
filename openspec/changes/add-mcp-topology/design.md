## Context

Phase 1 shipped the daemon, derivation, and roadmap (WHAT) view, and its three capabilities are now in the spec baseline. This change adds the second half of the workflow — "how / with what do I develop?" — as a hub-and-spoke MCP topology (HOW) tab on the same daemon.

The constraints were settled during exploration and recorded in `openspec/config.yaml`:
- **Mirror, never launcher.** Availability is observed passively; the daemon never spawns or starts any server or backing application.
- **Hub = Claude Code.** The single hub at the center; servers are read by merging Claude Code config sources.
- **Generic across transports.** stdio command servers and URL-based (http / sse / streamable-http) servers must both be represented.

## Goals / Non-Goals

**Goals:**
- Discover MCP servers by merging Claude Code config sources and de-duplicating scope-duplicated entries, retaining scope (global vs project).
- Report a passive, transport-aware liveness state per server, checked on demand, never by launching.
- Render a hub-and-spoke topology centered on Claude Code, with scope and liveness visible, and a per-server "check" action.
- Serve the HOW tab from the existing daemon and push availability results over the existing websocket.

**Non-Goals:**
- Launching, starting, restarting, or configuring servers. The dashboard only reports; the user starts what they need.
- A full MCP client handshake / `tools/list` capability inventory. This change establishes the topology and liveness; deep capability enumeration is out of scope (it would require speaking MCP, and for stdio that means spawning — which is forbidden here).
- Auto-probing all servers on load. Checks are on demand, per server.
- Editing any Claude Code config.

## Decisions

### D1 — Config sources and merge
Read (read-only) and merge, in this precedence: `~/.claude.json` top-level `mcpServers` (global/user) and `~/.claude/.mcp.json` (global/user), plus `~/.claude.json` `projects[<repoRoot>].mcpServers` (project scope for the directory the daemon runs in). De-duplicate by server name; if the same name appears under multiple scopes or path-variant project keys (e.g. `C:/...` vs `C:\\...`), collapse to one entry and keep the most specific scope. The parser tolerates both `{ "mcpServers": {...} }` and a bare `{ name: {...} }` map, since these files differ in shape.

### D2 — Transport detection
A server config with a `command` field is **stdio**. A config with `url` (and/or `type` of `http` / `sse`) is **URL-based**, with transport taken from `type` or inferred as `http`. This drives which availability check runs.

### D3 — Passive availability, per transport
- **URL servers:** issue a single short-timeout HTTP request to the endpoint. Any answer (including 4xx) ⇒ `available` (something is listening). `401/403` ⇒ `needs-auth`. Connection refused / timeout ⇒ `unreachable`. This connects to an already-listening server; it launches nothing.
- **stdio servers:** nothing listens, so the resting state is `on-demand`. Best-effort, scan the OS process table for a process whose command line matches the server's `command`/`args`; a match ⇒ `already-running`. Never spawn the server to find out.
- States: `unknown` (never checked) · `checking` · `available` · `needs-auth` · `unreachable` · `on-demand` · `already-running`. Each result carries a `lastChecked` timestamp and is cached in daemon memory.

### D4 — Secret redaction (hard rule)
`~/.claude.json` contains tokens and `env` secrets. The daemon MUST NOT send secrets to the browser. The MCP model exposed over HTTP/websocket carries only safe metadata: server name, transport, scope, a redacted command (binary name without sensitive args) or URL host, and liveness state. Tokens, headers, and `env` values are never serialized to the client.

### D5 — Daemon surface (extends `roadmap-daemon`)
Add HTTP endpoints `GET /api/mcp` (discovered servers + cached liveness) and `POST /api/mcp/check` (run a passive check for one named server, return + broadcast the result). Reuse the existing websocket to push availability updates so every open client stays in sync. The daemon now serves two tabs from one process.

### D6 — Topology rendering
SVG hub-and-spoke: Claude Code at center, servers as surrounding nodes laid out on a ring. Edge style encodes scope (e.g. solid = global, dashed = project). Node badge/color encodes liveness. Each server node has a "check" action that calls `POST /api/mcp/check`. The view never offers a "start"/"launch" affordance.

## Risks / Trade-offs

- **stdio process matching is heuristic** (many `node`/`python` processes look alike) → match on the full command + distinctive args; treat `already-running` as best-effort and label it as such. Never let a false negative imply "down" — the resting truth for stdio is `on-demand`, not `unreachable`.
- **Leaking secrets to the browser** → enforced redaction at the serialization boundary (D4); the discovery layer returns a sanitized model, and raw config never leaves the daemon.
- **URL check side-effects** → use a plain HTTP HEAD/GET with a tight timeout, not an MCP `initialize` that could trigger work. Connecting ≠ launching.
- **Config shape drift** across Claude Code versions → tolerant parser (D1) and per-source try/catch so a malformed source is skipped, not fatal.
- **Which project's servers to show** → scope to the daemon's `repoRoot` plus global; document that opening data_loom elsewhere changes the project spokes (this is the intended "why isn't this server here" insight).

## Migration Plan

Additive — no migration. New modules under `src/mcp/`, new endpoints, a new tab. Phase 1 behavior is unchanged. Rollback = revert the change; the roadmap tab is unaffected.

## Open Questions

- **Capability inventory later?** A future change could add a real MCP `tools/list` for URL servers (which can be queried without spawning), enriching nodes with their tool counts. Deferred — not needed for topology + liveness.
- **Manual server annotations?** Letting the user annotate a stdio bridge with a health URL/port (so its backing app can be checked passively) is a possible later enhancement. Out of scope here.
