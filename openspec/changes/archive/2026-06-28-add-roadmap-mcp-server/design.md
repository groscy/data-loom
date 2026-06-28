## Context

data_loom already has an `OpenSpecClient` that reads the open changes and their proposal content, and `phase-planning` already consumes `## Depends On`. So the MCP server is thin: expose those reads as a tool, expose a `## Depends On` write as a tool, and let an MCP client (the user's authenticated Claude) do the reasoning in between. This inverts the failed "data_loom spawns claude" approach — the client calls data_loom, so there's no subprocess auth and no credential for data_loom to hold.

## Goals / Non-Goals

**Goals:**
- A stdio MCP server exposing `list_open_proposals` (read) and `set_dependency` (write `## Depends On`).
- Hold no credentials; expose only proposal text; apply only via explicit `## Depends On` edits.
- Reuse the existing OpenSpec client and project resolution; the running daemon picks up writes via its watcher.

**Non-Goals:**
- data_loom doing the LLM reasoning itself (the client's Claude does it).
- A networked/HTTP MCP transport — stdio only, the way Claude Code launches local servers.
- Auto-applying anything; the client decides which `set_dependency` calls to make, and each is an explicit, file-visible edit.

## Decisions

### D1 — Stdio MCP server via the official SDK
Add `@modelcontextprotocol/sdk` and implement a stdio `Server` with a `StdioServerTransport`. Entry point: `data-loom mcp [project]` — i.e. `index.ts` branches to MCP mode when the first arg is `mcp` (project = the next arg, else `DATA_LOOM_ROOT`, else cwd), otherwise it runs the HTTP daemon as today. The MCP server reuses `OpenSpecClient(project)`.

### D2 — Tools
- `list_open_proposals` (no args) → for each open (non-archived) change: `{ name, why, whatChanges, capabilities, dependsOn, phase, readiness }`, sourced from the proposal text and the derived model. Read-only.
- `set_dependency` (`{ from, to }`) → validate both are known open changes and `from != to`; append `to` under a `## Depends On` section in `from`'s `proposal.md` (create the section if absent; skip if already present). Returns the resulting dependency list for `from`.

### D3 — No-secrets boundary
The tools return and accept only proposal text and change names. They never read or expose `~/.claude.json`, environment variables, MCP configs, or any host secret. data_loom holds no API key in either mode. The reasoning client supplies its own authentication; data_loom is unaware of it.

### D4 — Determinism preserved
`set_dependency` writes an explicit `## Depends On` line — the same mechanism `phase-planning` already derives from. The MCP server does not touch the roadmap model; the running daemon's file-watcher recomputes it from the edited file. So the client's suggestions only ever enter the model as human-inspectable file edits.

### D5 — Dogfood
Once the user registers `data-loom mcp` in Claude Code, it is itself an MCP server — and shows up as a spoke in data_loom's own MCP topology tab. Nice-to-have, not required by the spec.

## Risks / Trade-offs

- **Two processes** (HTTP daemon for the dashboard, stdio server for Claude) → acceptable; they share the same project files, and the daemon's watcher reflects the server's writes live. Documented.
- **Client writes a bad dependency** (cycle, wrong direction) → surfaced by the existing conflict detection on the roadmap; and each write is an explicit, revertible `## Depends On` edit.
- **No control over the client's model/prompt** → by design; the user's Claude does the reasoning. data_loom only guarantees the read/write tools and validation.
- **Project scoping** → the MCP server is pointed at one project (arg/cwd), like the daemon; the user registers it per project or relies on cwd.

## Migration Plan

Additive. The HTTP daemon and dashboard are unchanged; the MCP server is an opt-in second mode. No data migration.

## Open Questions

- **More tools later** (get full roadmap, list conflicts, remove a dependency) — start with `list_open_proposals` + `set_dependency`; extend if the workflow wants it.
- **One combined process** (daemon also serving MCP) — deferred; stdio servers are spawned by the client, so a separate mode is the natural fit.
