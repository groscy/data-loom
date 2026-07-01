## Why

Today DataLoom only runs as a foreground process that occupies a terminal, and the MCP endpoint it hosts is only reachable while that terminal stays open — the user has to remember to launch it, and it dies when the shell closes or the machine reboots. That is a poor fit for something meant to be *always-on infrastructure* (a single user-scope MCP registration that "just works" from any project). It also only integrates with Claude Code; Claude Desktop users have no supported way to reach the same tools.

## What Changes

- Add a **background run mode** so the daemon can be started detached from any terminal, with a single-instance guard and a log file (there is no attached console to print to).
- Add **lifecycle subcommands** to the `data-loom` CLI — `start` (detached), `stop`, `restart`, and `status` — layered on top of the existing foreground invocation, which is preserved unchanged.
- Add **login autostart management** — `data-loom autostart enable|disable|status` — that registers/unregisters the background daemon to launch automatically when the user logs in, per-OS (Windows Startup as the primary target; macOS LaunchAgent and Linux XDG autostart covered).
- Add **Claude Desktop integration** — a command that registers DataLoom's loopback HTTP MCP endpoint into Claude Desktop's `claude_desktop_config.json` (via a stdio↔HTTP bridge, since Claude Desktop launches stdio servers), so the same tools that serve Claude Code also serve Claude Desktop from one running daemon.
- Update docs (README) to describe the always-on install path (`autostart enable` + `connect claude-desktop`) alongside the existing manual `npx` launch.

## Capabilities

### New Capabilities
- `daemon-lifecycle`: Running the daemon detached in the background, guarding against a second instance, writing to a log file, and controlling it via `start`/`stop`/`restart`/`status` subcommands.
- `startup-autolaunch`: Registering and unregistering the background daemon as a per-user login item so it starts automatically on OS startup, with per-OS mechanisms and an idempotent enable/disable/status surface.
- `claude-desktop-integration`: Registering DataLoom's HTTP MCP endpoint into Claude Desktop's config so Claude Desktop can reach the daemon's tools, and reporting/removing that registration.

### Modified Capabilities
<!-- The foreground launch (self-contained-launch) and the HTTP MCP server (roadmap-mcp-server) are unchanged at the requirement level: background mode is additive, and Claude Desktop connects as just another loopback MCP client the endpoint already permits. -->

## Impact

- **Code**: `src/index.ts` (CLI argument parsing gains subcommands; detach/relaunch, PID/lock, log redirection). New modules for lifecycle control, per-OS autostart registration, and Claude Desktop config editing. No change to the daemon's serving/derivation core.
- **Dependencies**: introduces a stdio↔HTTP MCP bridge for Claude Desktop (e.g. `mcp-remote` invoked via `npx`); no new runtime dependency bundled into the daemon itself.
- **Files touched at runtime**: a DataLoom state dir (PID + log), an OS login-item entry (Startup shortcut / LaunchAgent / `.desktop`), and `claude_desktop_config.json` — all per-user, all reversible via the corresponding `disable`/`stop`/removal command.
- **Security**: unchanged posture — still loopback-only with Host/Origin validation; Claude Desktop's bridge connects as a native (no-Origin) client, which is already allowed. Documented in README.
- **Docs**: README install/usage sections.
