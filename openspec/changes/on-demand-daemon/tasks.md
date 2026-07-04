## 1. Shim implementation

- [x] 1.1 Create `src/mcpShim.ts`: pair the MCP SDK stdio server transport with a streamable-HTTP client transport to the daemon's `/mcp`, forwarding messages both ways with no shim-defined tools or sessions
- [x] 1.2 Add the launch step: `lifecycle.isRunning()` check, `lifecycle.start()` when down, bounded port poll (~10s) before completing the handshake
- [x] 1.3 Implement instructive handshake failure: detect the missing-openspec case (daemon log tail / start error), otherwise point at `data-loom status` and the log path; never hang, never exit silently pre-response
- [x] 1.4 Ensure the shim exits with its client session and never stops the daemon

## 2. CLI and registration

- [x] 2.1 Add the shim verb to `src/index.ts` dispatch (excluded from the project-path fallthrough)
- [x] 2.2 Extend `src/claudeCode.ts` with the `--on-demand` registration form (stdio, user scope, via `claude mcp add`), form-mismatch detection/reporting, and form-agnostic `disconnect`

## 3. Verification and docs

- [x] 3.1 Verify cold start: no daemon, fresh Claude Code session → tools list and calls succeed, daemon (with tray) is up afterward
- [x] 3.2 Verify warm path (daemon already running) and the two-sessions race → exactly one daemon
- [x] 3.3 Verify session end leaves the daemon running; verify missing-openspec produces the instructive error in the client
- [x] 3.4 Document the on-demand mode in the README next to the default HTTP registration, including when to prefer which
