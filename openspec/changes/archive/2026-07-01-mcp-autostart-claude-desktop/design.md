## Context

DataLoom is a single-user, local-first Node daemon (`dist/index.js`, launched via the `data-loom` bin) that serves a dashboard SPA and hosts an HTTP MCP server at `/mcp`, both bound to `127.0.0.1:4317`. Its entry point (`src/index.ts`) currently: checks for the `openspec` CLI, resolves an initial project, starts the server, opens the browser, and blocks in the foreground handling `SIGINT`/`SIGTERM`.

Two gaps motivate this change (see [proposal.md](./proposal.md)):
1. The daemon is foreground-only — it must be re-launched by hand and dies with its terminal or on reboot, which is wrong for something meant to be an always-available MCP registration.
2. Only Claude Code is wired up. Claude Desktop, which launches **stdio** MCP servers from `claude_desktop_config.json`, has no supported path to the daemon's HTTP endpoint.

Constraints that shape the design: local-first and per-user (no admin/root, no services requiring elevation); Windows is the primary target OS (macOS/Linux covered but secondary); the daemon's serving/derivation core and its loopback-only + Host/Origin security posture must not change; prefer deriving/reusing over storing new state.

## Goals / Non-Goals

**Goals:**
- Run the existing daemon detached in the background with a single-instance guard and a log file, controlled by `start`/`stop`/`restart`/`status`.
- Register the background daemon to auto-launch on user login, per-OS, via `autostart enable|disable|status`, idempotently and without elevation.
- Let Claude Desktop reach the *same* running daemon's tools by editing `claude_desktop_config.json` to add a stdio↔HTTP bridge, additively and reversibly.
- Keep the foreground invocation and all current behavior unchanged.

**Non-Goals:**
- No system-wide/multi-user service, no elevation, no Windows Service / systemd *system* unit.
- No change to the MCP tools, the roadmap/derivation core, or the security model.
- No auto-start of a *second* MCP process — Claude Desktop reuses the one daemon.
- No auto-launch of the daemon by the desktop bridge; if the daemon is down, connection fails with guidance (a launcher would violate DataLoom's "mirror, never launcher" principle for MCP).
- No packaging/installer work beyond the CLI commands and README.

## Decisions

### CLI shape: subcommands layered over the existing positional path
`data-loom [project-path]` stays foreground. A first-token dispatch recognizes reserved verbs — `start`, `stop`, `restart`, `status`, `autostart <enable|disable|status>`, `connect claude-desktop`, `disconnect claude-desktop` — and otherwise falls through to today's behavior (treat token as a project path). `start` accepts an optional trailing project path exactly like the bare form.
- *Why:* additive and backward-compatible; no flag soup. A path that happens to collide with a verb name is vanishingly unlikely and can be disambiguated by the bare form still accepting any path.
- *Alternative considered:* a `--detach` flag on the bare command. Rejected — `stop`/`status`/`autostart` need verbs anyway, so one consistent verb surface is cleaner.

### Backgrounding: self-relaunch as a detached child
`start` spawns the same Node binary with an internal marker (e.g. env var `DATA_LOOM_DETACHED=1` or a hidden `__run` token) using `child_process.spawn(process.execPath, [...], { detached: true, stdio: ['ignore', logFd, logFd] })` then `child.unref()` and exit the parent. The child runs the normal `main()` but skips `openBrowser` and treats stdout/stderr as the log.
- *Why:* reuses the entire existing daemon; no daemonization library; works on Windows (no `fork`/double-fork needed). The already-present `DATA_LOOM_NO_OPEN` suppression maps naturally onto detached mode.
- *Alternative:* a supervisor process. Overkill for single-user local.

### Single-instance guard: the port is the lock, PID file is advisory
The authoritative "is it running?" test is *does something answer on the loopback port* (attempt an MCP/HTTP probe, or catch `EADDRINUSE` on bind). A PID file in the state dir is written on start and used for `stop` (signal the PID) and to report in `status`, but a stale PID file never blocks a start — if nothing answers the port, start proceeds.
- *Why:* the daemon already binds a fixed port, so the OS already enforces single-listener; the port probe recovers cleanly from crash-without-cleanup. Avoids PID-reuse false positives being authoritative.
- *`stop`:* read PID, send `SIGTERM` (Windows: `taskkill`/`process.kill`), verify the port frees.

### State directory & log location
Use a per-user, OS-appropriate state dir: Windows `%LOCALAPPDATA%\data-loom\`, macOS `~/Library/Application Support/data-loom/` (or `~/Library/Logs`), Linux `${XDG_STATE_HOME:-~/.local/state}/data-loom/`. Holds `daemon.pid` and `daemon.log`. `status` prints the log path.
- *Why:* conventional, discoverable, avoids polluting the project dir.

### Autostart: native per-user login mechanisms, no elevation
A small `autostart` module abstracts three back-ends behind `enable()/disable()/status()`:
- **Windows (primary):** write a `.lnk` (or a `.cmd`/`.vbs` wrapper) into the per-user Startup folder (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\data-loom.lnk`) that runs `data-loom start`. Shortcut creation via a tiny PowerShell `WScript.Shell` one-liner (no native dep).
- **macOS:** a `~/Library/LaunchAgents/dev.lyric.data-loom.plist` with `RunAtLoad`, loaded via `launchctl`.
- **Linux:** an XDG `~/.config/autostart/data-loom.desktop` entry.
The registration invokes `data-loom start` (background mode) so login-launch and manual start share one path. `enable` overwrites any existing entry (idempotent); `disable` deletes it (idempotent); unsupported platform → clear error.
- *Why:* per-user, no admin; each is the OS-blessed "run at login" hook. Reusing `start` keeps single-instance + logging behavior identical whether launched by hand or by login.
- *Alternative:* Windows `HKCU\...\Run` registry key. Viable but the Startup folder is easier to inspect/remove by hand and needs no registry writes.

### Claude Desktop: native remote/HTTP connector, stdio bridge as fallback
Register DataLoom using Claude Desktop's **native remote MCP support** — a URL-based HTTP entry pointing straight at the daemon's loopback endpoint:
```json
"data-loom": { "type": "http", "url": "http://127.0.0.1:4317/mcp" }
```
The daemon already permits native (no-`Origin`) MCP clients, so the connector reaches it with no server change and no extra process. When the installed Claude Desktop is too old to support a native HTTP/remote entry, `connect claude-desktop` falls back to the stdio bridge:
```json
"data-loom": { "command": "npx", "args": ["-y", "mcp-remote", "http://127.0.0.1:4317/mcp"] }
```
- *Why native first:* no `npx mcp-remote` shim to fetch/run, fewer moving parts, and it keeps *one* daemon as the single source of truth. The bridge remains as a compatibility fallback so older Claude Desktop versions still work.
- *Selecting the form:* prefer the native connector; use the bridge only when native remote support is absent. Expose a flag (e.g. `--bridge`) to force the stdio form if the native entry misbehaves on a given version.
- *Daemon-down behavior:* either form fails to connect when the daemon isn't running — the desired "start DataLoom" signal (no auto-launch).
- *Config editing:* locate `claude_desktop_config.json` per-OS (Windows `%APPDATA%\Claude\`, macOS `~/Library/Application Support/Claude/`), parse-or-create, merge only the `data-loom` key under `mcpServers`, write back preserving everything else. `disconnect` deletes only that key.

### `connect`/`disconnect` naming
Group Claude Desktop under `data-loom connect claude-desktop` / `disconnect claude-desktop`, leaving room for a future `connect claude-code` that scripts the existing `claude mcp add` line.

## Risks / Trade-offs

- **`mcp-remote` is an external, npx-fetched dependency at runtime** → It runs only inside Claude Desktop's own process (not bundled into the daemon), is the de-facto standard bridge, and is pinned by the `-y` npx fetch; document it and allow overriding the bridge command. If unavailable offline, connection fails loudly.
- **Detached child on Windows may still flash/inherit a console** → spawn with `detached: true`, `windowsHide: true`, and `stdio` redirected to the log fd; the Startup shortcut runs minimized.
- **Stale PID file after a crash** → never authoritative; the port probe is the source of truth, so a stale file cannot block `start`; `status`/`stop` tolerate a missing/stale PID.
- **Editing user-owned config files (`claude_desktop_config.json`)** → strictly additive merge touching only the `data-loom` key; write via read-parse-merge-write and back up nothing destructively; malformed existing JSON → fail with a clear message rather than overwrite.
- **Autostart entry left behind after uninstall of the npm package** → documented; `autostart disable` is the reversal, and `status` reveals a dangling entry.
- **Two auto-launch layers (login + already-running)** → the single-instance guard makes a redundant login-launch a reported no-op, not a second daemon.

## Migration Plan

- Purely additive; no data migration. Existing users keep launching foreground or via `npx` unchanged.
- Rollout: ship the CLI verbs; update README with the always-on path (`data-loom autostart enable` then `data-loom connect claude-desktop`).
- Rollback: `data-loom autostart disable`, `data-loom disconnect claude-desktop`, `data-loom stop` fully reverse every side effect; each is idempotent.

## Resolved Decisions

- **Claude Desktop connection form:** use the **native remote/HTTP connector** (URL entry) as the default, with the `npx mcp-remote` stdio bridge as an automatic fallback for older Claude Desktop versions (and a `--bridge` flag to force it).
- **`autostart enable` starts immediately:** enabling login autostart also starts the daemon now (not only next login), with a `--no-start` opt-out.

## Open Questions

- None outstanding.
