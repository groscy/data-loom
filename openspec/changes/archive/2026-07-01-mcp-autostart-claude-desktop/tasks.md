## 1. CLI dispatch & shared foundations

- [x] 1.1 Add a first-token verb dispatcher in `src/index.ts` that recognizes `start`, `stop`, `restart`, `status`, `autostart`, `connect`, `disconnect`, and otherwise falls through to the current foreground `[project-path]` behavior (unchanged).
- [x] 1.2 Add a `paths.ts` helper resolving the per-user state dir (`%LOCALAPPDATA%\data-loom` / `~/Library/Application Support/data-loom` / `${XDG_STATE_HOME:-~/.local/state}/data-loom`) and the `daemon.pid` / `daemon.log` paths; create the dir on demand.
- [x] 1.3 Detect detached mode via an internal marker (env `DATA_LOOM_DETACHED=1`) and, when set, skip `openBrowser` and treat stdout/stderr as the log.

## 2. Background lifecycle (daemon-lifecycle)

- [x] 2.1 Implement `start [project-path]`: probe the loopback port; if a live daemon answers, report "already running" and exit; otherwise spawn `process.execPath` detached (`detached: true`, `windowsHide: true`, `stdio` → log fd), `unref()`, write `daemon.pid`, and exit the parent.
- [x] 2.2 Implement the single-instance guard: port probe is authoritative; a stale `daemon.pid` never blocks a start.
- [x] 2.3 Implement `stop`: read `daemon.pid`, signal it (SIGTERM; Windows `process.kill`/`taskkill`), verify the port frees, remove the PID file; report "nothing to stop" when not running (no error).
- [x] 2.4 Implement `status`: report running/not-running via port probe, and when running print the loopback URL and the log-file path.
- [x] 2.5 Implement `restart`: `stop` if running, then `start` with the same optional project path.
- [x] 2.6 Ensure detached daemon appends startup/error/lifecycle output to `daemon.log`.

## 3. Login autostart (startup-autolaunch)

- [x] 3.1 Create `src/autostart.ts` with `enable()`, `disable()`, `status()` dispatching by `process.platform`; unsupported platform → clear error.
- [x] 3.2 Windows back-end: create/remove a per-user Startup-folder shortcut (`Startup\data-loom.lnk`) that runs `data-loom start`, via a PowerShell `WScript.Shell` one-liner; run minimized/hidden.
- [x] 3.3 macOS back-end: write/remove `~/Library/LaunchAgents/dev.lyric.data-loom.plist` with `RunAtLoad`; `launchctl load/unload`.
- [x] 3.4 Linux back-end: write/remove `~/.config/autostart/data-loom.desktop`.
- [x] 3.5 Wire `autostart enable|disable|status` into the CLI dispatcher; make `enable`/`disable` idempotent (single registration; no error when already in target state).
- [x] 3.6 Make `autostart enable` also start the daemon immediately (invoke `start` now), with a `--no-start` opt-out.

## 4. Claude Desktop integration (claude-desktop-integration)

- [x] 4.1 Create `src/claudeDesktop.ts` that resolves `claude_desktop_config.json` per-OS (Windows `%APPDATA%\Claude`, macOS `~/Library/Application Support/Claude`).
- [x] 4.2 Implement `connect claude-desktop`: parse-or-create the config, additively merge only the `data-loom` `mcpServers` entry, preserving all other entries; update in place if present; fail clearly on malformed existing JSON.
- [x] 4.2a Default the entry to the native remote/HTTP form (`{ "type": "http", "url": "http://127.0.0.1:<port>/mcp" }`); fall back to the stdio bridge (`npx -y mcp-remote http://127.0.0.1:<port>/mcp`) when native remote isn't supported, and add a `--bridge` flag to force the bridge form.
- [x] 4.3 Implement `disconnect claude-desktop`: remove only the `data-loom` key; idempotent (report "nothing to remove" when absent).
- [x] 4.4 Verify no secrets are written — entry carries only the loopback endpoint and bridge command/args.

## 5. Docs & verification

- [x] 5.1 Update README with the always-on install path (`data-loom autostart enable`, `data-loom connect claude-desktop`) and the lifecycle commands, alongside the existing manual `npx`/foreground usage.
- [x] 5.2 Document the state dir, log-file location, and how to fully reverse every side effect (`stop`, `autostart disable`, `disconnect claude-desktop`).
- [x] 5.3 Manually verify each flow on Windows: `start` → `status` shows running → close terminal, still running → Claude Desktop lists DataLoom tools while daemon up → `stop` → `status` shows stopped; `autostart enable` creates a Startup entry, `disable` removes it.
- [x] 5.4 `npm run build` passes with no TypeScript errors.
