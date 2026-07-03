## Why

DataLoom's MCP tools are only reachable while the daemon happens to be running, so a user who skipped (or broke) the always-on setup gets the worst failure mode: Claude reports the tools as silently unreachable. An on-demand launch path makes the daemon materialize the moment a client first needs it, removing "remember to start DataLoom" as a failure class and making autostart optional polish rather than a prerequisite.

This is deliberately captured alongside `harden-always-on` as a complementary (partly alternative) strategy: always-on serves the ambient dashboard, on-demand serves the tools. Recording both lets the dependency review weigh them explicitly.

## What Changes

- New **stdio shim** subcommand (`data-loom mcp-shim`): a thin MCP stdio endpoint that, when spawned by a client, ensures the daemon is running — starting it detached via the existing lifecycle path when the loopback port is dead — then proxies MCP traffic to the daemon's HTTP `/mcp` endpoint for the life of the session.
- The shim never becomes a second server: all tools, sessions, and project resolution stay in the daemon; the shim only launches (if needed) and forwards.
- **`connect claude-code --on-demand`**: registers the shim as a stdio server (user scope) instead of the HTTP endpoint, giving Claude Code sessions self-starting DataLoom tools. The default registration remains the native HTTP endpoint.
- Clear failure surface: when the daemon cannot be started (e.g. missing openspec CLI), the shim reports an instructive MCP error naming the fix, instead of hanging or dying silently.
- The daemon it starts is a normal detached daemon — dashboard, tray, single-instance guard, and `stop` all behave exactly as today.

## Capabilities

### New Capabilities

- `on-demand-launch`: a client-spawned stdio shim that starts the daemon when it is not running and proxies MCP stdio traffic to the daemon's loopback HTTP endpoint, with instructive errors when launch fails.

### Modified Capabilities

- `claude-code-integration`: `connect claude-code` gains an `--on-demand` mode that registers the stdio shim instead of the HTTP endpoint (and `disconnect` removes whichever form is present).

## Impact

- **Code**: new `src/mcpShim.ts` (stdio↔HTTP proxy using the MCP SDK's stdio server transport + streamable-HTTP client transport), `src/index.ts` (verb dispatch), `src/claudeCode.ts` (`--on-demand` registration form), reuse of `lifecycle.isRunning`/`start`.
- **Interaction with always-on**: independent at runtime (the shim no-ops its launch step when a daemon is already running); the product decision of which registration `up`/`autostart enable` should default to is left to those capabilities and the dependency review.
- **Claude Desktop**: unchanged here; its existing `--bridge` mode could later point at the same shim, noted as a follow-up.
- **No new npm dependencies** (the MCP SDK is already a dependency).
