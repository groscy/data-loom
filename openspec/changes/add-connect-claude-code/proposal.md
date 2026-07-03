## Why

DataLoom's MCP server is *hosted* by the daemon at `http://127.0.0.1:4317/mcp`, but installing the package and running `start` / `autostart enable` only ever brings that host up — nothing points a Claude Code session at it. Registering the endpoint with Claude Code is still a manual, one-time `claude mcp add …` that a fresh "install + autostart" flow never performs, so the tools silently never appear even though the daemon is running perfectly.

This asymmetry is deliberate but incomplete: Claude Desktop already has an automated registrar (`data-loom connect claude-desktop`), while Claude Code was left to the manual command "leaving room for a future `connect claude-code`" (recorded in the `mcp-autostart-claude-desktop` design). This change builds that missing half and wires it into autostart so the always-on path truly works out of the box.

## What Changes

- Add a **`data-loom connect claude-code`** command that registers DataLoom's loopback HTTP MCP endpoint with Claude Code at user scope, and a **`disconnect claude-code`** that removes it — mirroring the existing `connect`/`disconnect claude-desktop` verbs.
- Register through **Claude Code's own CLI** (`claude mcp add` / `claude mcp remove`), NOT by editing `~/.claude.json` directly — preserving DataLoom's standing rule that it reads that secrets-bearing file read-only and never writes it. When the `claude` CLI is unavailable, fail gracefully by printing the manual `claude mcp add …` command.
- **Wire the registration into `autostart enable`** so enabling always-on autostart now does all three halves — register at login, start the daemon, and point Claude Code at it — with a `--no-connect` opt-out that parallels the existing `--no-start`.
- Update docs (README) to present `data-loom connect claude-code` alongside the manual command, and to note that `autostart enable` now registers Claude Code too.

## Capabilities

### New Capabilities
- `claude-code-integration`: Registering DataLoom's HTTP MCP endpoint with Claude Code (at user scope, via Claude Code's own CLI) so a Claude Code session can reach the daemon's tools, and reporting/removing that registration — reversibly and idempotently, without DataLoom ever writing `~/.claude.json` itself.

### Modified Capabilities
- `startup-autolaunch`: `autostart enable` additionally registers DataLoom with Claude Code (best-effort, `--no-connect` opt-out), so the always-on install path hosts the endpoint *and* points the client at it in one command.

## Impact

- **Code**: new `src/claudeCode.ts` (shell out to the `claude` CLI, `shell:true` on win32 as in `openspecClient.ts`); a sub-branch in `runConnect`/`runDisconnect` in `src/index.ts`; a connect step + `--no-connect` handling in `runAutostart`. No change to the daemon's serving/derivation core.
- **Dependencies**: no new bundled dependency — relies on the user's existing `claude` CLI being on PATH; absence degrades to printed guidance.
- **Files touched at runtime**: DataLoom's `data-loom` entry under `mcpServers` in the user-scope Claude Code config, written by `claude mcp add` (DataLoom does not edit the file directly). Reversible via `disconnect claude-code`.
- **Security**: unchanged posture — loopback-only endpoint, no secrets written; the registration carries only the loopback URL.
- **Docs**: README install/usage sections.

## Depends On
