## 1. Claude Code integration module (claude-code-integration)

- [x] 1.1 Create `src/claudeCode.ts` exposing `connect()` and `disconnect()`, shelling out to the `claude` CLI with `shell: process.platform === "win32"` (reuse the invocation idiom in `src/openspecClient.ts`).
- [x] 1.2 `connect()`: run `claude mcp remove --scope user data-loom` (ignore a "not found" result), then `claude mcp add --transport http --scope user data-loom http://127.0.0.1:<port>/mcp` — an idempotent upsert leaving exactly one current entry. Use `mcpUrl()` from `paths.ts` for the endpoint.
- [x] 1.3 `disconnect()`: run `claude mcp remove --scope user data-loom`; idempotent — report removed vs. "nothing to remove" when absent.
- [x] 1.4 Detect an unavailable `claude` CLI (spawn `ENOENT` / non-zero `--version`); on absence, `connect()` prints the manual `claude mcp add --transport http --scope user data-loom http://127.0.0.1:<port>/mcp` line and exits without a hard failure.
- [x] 1.5 Do NOT read or write `~/.claude.json` from this module — registration goes only through the `claude` CLI.

## 2. CLI dispatch

- [x] 2.1 Extend `runConnect` in `src/index.ts` to branch on the first argument: `claude-desktop` (existing) vs. `claude-code` (new → `claudeCode.connect()`); update the usage message.
- [x] 2.2 Extend `runDisconnect` similarly for `disconnect claude-code` → `claudeCode.disconnect()`.
- [x] 2.3 Print a post-connect message mirroring Desktop's: start a new Claude Code session (or reconnect) to pick up the user-scope registration, and the daemon must be running for the tools to resolve.

## 3. Autostart wiring (startup-autolaunch)

- [x] 3.1 In `runAutostart` (`src/index.ts`), after the existing `lifecycle.start()` step in `enable`, call `claudeCode.connect()` as a **best-effort** step: catch/log failures (e.g. `claude` absent) and continue so the login item and daemon still succeed.
- [x] 3.2 Add a `--no-connect` flag to `autostart enable` that skips the connect step, paralleling the existing `--no-start`; update the usage string.

## 4. Docs & verification

- [x] 4.1 Update README: present `data-loom connect claude-code` alongside the manual `claude mcp add` command; note that `autostart enable` now also registers Claude Code (with `--no-connect`), and that `disconnect claude-code` reverses it.
- [x] 4.2 Ensure the "Everything is reversible" list includes `data-loom disconnect claude-code`.
- [x] 4.3 Manually verify on Windows: with the daemon running, `data-loom connect claude-code` → a new Claude Code session lists DataLoom's tools; `disconnect claude-code` removes them; `connect claude-code` twice leaves a single entry; with `claude` off PATH, `connect claude-code` prints the manual command and exits cleanly.
- [x] 4.4 Verify `autostart enable` performs register-at-login + start + connect, `--no-connect` skips only the connect, and `enable` still succeeds when `claude` is unavailable.
- [x] 4.5 `npm run build` passes with no TypeScript errors.
