## 1. MCP server scaffolding

- [x] 1.1 Add `@modelcontextprotocol/sdk`
- [x] 1.2 Branch the entry point: `data-loom mcp [project]` runs a stdio MCP `Server` (project = arg → `DATA_LOOM_ROOT` → cwd); the default entry still runs the HTTP daemon
- [x] 1.3 Reuse `OpenSpecClient(project)` for reads; register the tools and connect a `StdioServerTransport`

## 2. Tools

- [x] 2.1 `list_open_proposals` — return each open change's name, Why / What Changes / Capabilities, and derived dependsOn / phase / readiness (read-only)
- [x] 2.2 `set_dependency({from, to})` — validate both are known open changes and `from != to`; append `to` under a `## Depends On` section in `from`'s proposal (create if absent; no duplicate); return `from`'s resulting dependency list
- [x] 2.3 Ensure tools expose only proposal text + change names — no config/env/MCP secrets

## 3. Docs

- [x] 3.1 README: register data_loom as an MCP server in Claude Code (the `data-loom mcp` command), and the "ask Claude to set the dependencies" workflow

## 4. Verification

- [x] 4.1 Start the MCP server and drive it over stdio (MCP `initialize` → `tools/list`) — confirm the handshake and both tools are listed
- [x] 4.2 Call `list_open_proposals` and confirm it returns the open changes with content + derived state, and contains no secrets
- [x] 4.3 Call `set_dependency` on two open changes and confirm a `## Depends On` entry is written and the roadmap re-derives (the dependent moves to a later phase / becomes blocked)
- [x] 4.4 Confirm `set_dependency` rejects an unknown name and a `from == to` call without writing
