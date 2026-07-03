## Why

The always-on story currently ends at login: the daemon is spawned detached and forgotten, so a crash at any point during the session leaves the dashboard and the MCP endpoint silently dead until the next reboot — the worst failure mode for a component other tools (Claude Code, Claude Desktop, `/loom:weave`) depend on being reachable. In addition, the login registrations pin absolute paths to the current `node` binary and script (`process.execPath` + `process.argv[1]`), so a Node version-manager switch or an npm upgrade that relocates the package silently breaks autostart, and there is no built-in way to upgrade DataLoom and heal those registrations.

## What Changes

- Replace the fire-and-forget login items with the native **per-user supervisor** on each OS, so a crashed daemon is restarted automatically:
  - Windows (primary target): a per-user **Scheduled Task** with a logon trigger and restart-on-failure, replacing the Startup-folder shortcut.
  - macOS: the existing LaunchAgent gains `KeepAlive` with `SuccessfulExit: false` (restart on crash, stay stopped after a clean exit).
  - Linux: a **systemd user unit** with `Restart=on-failure`, falling back to the current XDG autostart entry where systemd is unavailable.
- Supervised launches run the daemon as a child the supervisor owns (foreground form, browser suppressed, output to the log), because restart-on-failure must watch the daemon process itself — not a launcher that exits immediately.
- A **clean stop stays stopped**: `data-loom stop` (and the tray's Stop) exits cleanly and is not restarted by the supervisor; only failures trigger a restart.
- **Stable launch target**: registrations stop pinning `node` + script paths and instead invoke a small launcher that resolves the `data-loom` command at launch time, so version-manager switches and npm upgrades no longer break autostart.
- New **`data-loom update`** verb: upgrades the npm package, restarts a running daemon, and rewrites the autostart registration when one exists.
- **Migration**: `autostart enable` upgrades any legacy registration (Startup `.lnk` / plain XDG entry) to the supervised form; `disable` removes both forms.

## Capabilities

### New Capabilities

<!-- None — this hardens existing capabilities rather than introducing a new area. -->

### Modified Capabilities

- `startup-autolaunch`: the per-OS registration mechanism becomes a supervising one (Scheduled Task / LaunchAgent KeepAlive / systemd user unit); new requirements for automatic restart after failure, clean-stop-stays-stopped semantics, a stable launch target, and legacy-registration migration.
- `daemon-lifecycle`: adds the `update` subcommand (upgrade package, restart daemon, rewrite autostart registration).

## Impact

- **Code**: `src/autostart.ts` (per-OS mechanisms rewritten), `src/lifecycle.ts` (supervised-run mode, update verb plumbing), `src/index.ts` (CLI verb dispatch, `update`), `src/paths.ts` (launcher script location in the state dir).
- **Behavior**: `autostart enable/disable/status` keep their exact CLI surface; only the underlying mechanism changes. `stop` semantics are preserved (a stopped daemon stays stopped).
- **Docs**: README "Run it always-on" section gains the update verb and the supervision guarantee.
- **No new npm dependencies** — Scheduled Task and LaunchAgent management use the same spawn-PowerShell / write-plist approach as today.
