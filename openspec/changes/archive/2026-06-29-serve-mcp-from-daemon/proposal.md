## Why

Using `/loom:weave` in a new project requires registering the MCP server again, with the project path baked into the launch command (`claude mcp add data-loom -- npx … mcp "<path>"` → `runMcpServer(project)`, frozen at spawn). Reusing the `data-loom` name across projects collides; not reusing it means a growing pile of per-project registrations. Only the `/loom:weave` *command* is genuinely once (it installs to the user-global `~/.claude/commands/`). The server itself is the single-project holdout — even though the dashboard daemon is already multi-project (project selector, `discoverProjects`, `selectProject`).

Setup should be **once per machine**, not once per project. A stdio server can't deliver that: it is spawned by Claude Code, 1:1 with a session, and bound to one project for its lifetime. One server serving every project means an **HTTP-transport server hosted by the daemon** that already runs on `127.0.0.1:4317` — with the target project resolved **per call** instead of at spawn.

## What Changes

- The **daemon hosts an MCP endpoint over Streamable-HTTP** (`StreamableHTTPServerTransport`, `/mcp` on the existing `127.0.0.1:4317` server). The MCP tools move from a per-project stdio process into the long-running daemon, so a single registration serves all projects:
  ```
  claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp
  ```
  The `data-loom mcp <project>` stdio entry point is **removed** in this change (no deprecation window — a new tool with no install base to protect).
- **Project becomes a per-call argument (Option C).** `list_open_proposals`, `set_dependency`, and `mark_independent` accept an optional `project` (absolute path). When omitted, the call falls back to the daemon's **current dashboard selection**. The path is validated as a real openspec workspace before any read or write. The server holds no single frozen `OpenSpecClient`/`changesDir` — it resolves per call.
- A new **`list_projects`** tool re-exposes `discoverProjects` so the agent can discover and confirm a valid workspace path before writing.
- The **`/loom:weave` command body** is updated to resolve the session's working directory and pass it explicitly as `project` (deterministic, multi-session safe), with the dashboard selection only as an interactive fallback.
- **weave now depends on a running daemon.** When the daemon is down, the connection / tools fail with a clear "start DataLoom first" message rather than a confusing transport error.
- README + the connect-time instructions document the single user-scope HTTP registration.

Non-goals (deliberately deferred): keeping the stdio transport as backward-compat (it is cut now); making the dashboard selection a shared cross-session source of truth (writes stay explicit-per-call); a distributable marketplace plugin; auth on the MCP endpoint beyond the existing loopback-only binding; multi-host / non-loopback access.

## Capabilities

### New Capabilities

_None._ (Reshapes the existing MCP-server capability — transport + project resolution.)

### Modified Capabilities

- `roadmap-mcp-server`: the server is hosted by the daemon over HTTP instead of a per-project stdio process; its read/write tools take an optional per-call `project` (defaulting to the dashboard selection) and validate it; a `list_projects` discovery tool is added; the weave command passes the project explicitly and requires a running daemon.

## Impact

- **Code**: `src/server.ts` (add the `/mcp` route + `StreamableHTTPServerTransport` on the existing http server); `src/mcpServer.ts` (stop closing over one project — resolve per call; add `project` arg + validation; add `list_projects`; update embedded `WEAVE_COMMAND` and `INSTRUCTIONS`); `src/index.ts` (wire the daemon's current-project getter into the MCP layer; **remove** the `data-loom mcp <project>` stdio entry point); `README.md` (single user-scope registration; daemon-must-be-running note).
- **Setup migration**: existing users drop their per-project `data-loom` registrations and add one user-scope HTTP registration. The installed `/loom:weave` command is overwritten in place by the next `install_weave_skill`.
- **New runtime coupling**: weave requires the daemon to be up — the thing you start to *see* the roadmap is now also the thing that *weaves* it.
- **No new dependencies** beyond the MCP SDK's HTTP/streamable transport already in `@modelcontextprotocol/sdk`.
