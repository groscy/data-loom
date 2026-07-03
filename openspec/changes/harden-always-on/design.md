## Context

`data-loom start` spawns the daemon detached and forgets it ([lifecycle.ts](../../../src/lifecycle.ts)); the login items created by `autostart enable` ([autostart.ts](../../../src/autostart.ts)) fire once per login with no supervision, and they bake `process.execPath` + `process.argv[1]` into the registration. Three consequences: a crashed daemon stays dead until the next login, Node version-manager churn breaks the registration silently, and upgrades are a manual npm command plus a manual restart. The tray icon (add-tray-icon) makes daemon liveness visible but does nothing to restore it.

## Goals / Non-Goals

**Goals:**
- A daemon that crashes is restarted automatically, per-user, with no admin rights.
- A daemon that is stopped deliberately stays stopped until the user starts it (or logs in again).
- Autostart registrations survive Node version switches and npm package relocations.
- One verb (`data-loom update`) upgrades, restarts, and re-heals registrations.
- The existing `autostart enable|disable|status` and `start|stop|restart|status` CLI surface is unchanged.

**Non-Goals:**
- A custom watchdog process of our own — the OS supervisor does the restarting.
- System-level (all-users) services, elevation, or Windows Services.
- Self-update without npm (that belongs to a future packaging change, if ever).
- Changing the single-instance guard, ports, or the daemon's runtime behavior.

## Decisions

### 1. The supervisor owns the daemon process directly

Restart-on-failure only works if the supervised process *is* the daemon. Today's chain (login item → `data-loom start` → detached child, launcher exits) makes the supervisor watch a process that exits immediately by design. So the supervised registration runs a **foreground** daemon invocation with `DATA_LOOM_DETACHED=1` semantics (no browser, log-file output): the Scheduled Task / LaunchAgent / systemd unit executes the daemon itself and watches that PID.

- *Alternative — keep `start` and have the supervisor poll the port:* rejected; none of the three OS mechanisms supervise anything but their own child.
- Manual `data-loom start` keeps today's detach behavior unchanged — supervision applies to the login-registered path (which is where always-on users live).

### 2. Per-OS mechanisms

- **Windows**: per-user Scheduled Task (logon trigger, `-RestartCount 3 -RestartInterval (1min)`, run whether on batteries or not), created via the same spawn-PowerShell approach as the current `.lnk` writer (`Register-ScheduledTask` in the `\` folder under the user's own principal — no admin needed for a non-elevated logon task). Task failure = daemon non-zero exit or kill → restart; exit 0 → done.
- **macOS**: keep the LaunchAgent, add `KeepAlive: {SuccessfulExit: false}`. launchd then restarts on crash only; `SIGTERM`-clean exit (code 0) stays stopped. This is a three-line plist change.
- **Linux**: a systemd **user** unit (`~/.config/systemd/user/data-loom.service`, `Restart=on-failure`, `WantedBy=default.target`), enabled with `systemctl --user enable --now`. When `systemctl --user` is unavailable (no systemd, no user session bus), fall back to the current XDG autostart entry and report that supervision is not available on this host.

### 3. Clean stop must exit 0

All three mechanisms distinguish crash from intent by exit code. The daemon's shutdown path (SIGTERM/SIGINT handler, tray Stop) already calls `process.exit(0)` — this becomes a spec-level guarantee: `data-loom stop` results in a supervisor-visible *successful* exit, so nothing restarts it. On Linux, `stop` additionally uses `systemctl --user stop` when the supervised unit is active, so systemd never sees the termination as a failure.

### 4. Stable launch target via a state-dir launcher

Registrations invoke a tiny launcher script written to the DataLoom state dir (`daemon.cmd` on Windows, `daemon.sh` elsewhere). The launcher resolves `data-loom` from `PATH` at launch time and falls back to the absolute paths recorded at enable-time. `autostart enable` and `data-loom update` (re)write the launcher. This decouples the OS registration (stable path, never changes) from the Node/package location (volatile).

- *Alternative — register the npm shim path directly:* better than today but still breaks when the npm prefix moves (nvm switches prefixes per Node version).

### 5. `update` composes existing steps

`data-loom update` = `npm install -g @lyric_dev/data-loom@latest` → if a daemon is running, `restart` → if autostart is enabled, re-run the registration write (launcher + task/plist/unit). No version-check service, no auto-update; the verb is explicit and reports each step. If npm fails, nothing else runs.

### 6. Migration is folded into enable/disable

`enable` deletes a legacy Startup `.lnk` / non-supervised plist / plain XDG entry if present, then writes the supervised form (idempotent). `disable` removes both generations. No separate migration command; upgrading users run `data-loom update` or re-run `enable` once.

## Risks / Trade-offs

- [Scheduled Task creation is more finicky than a `.lnk`] → Mitigation: use `Register-ScheduledTask` with the user's own principal and no elevation flags; on failure, fall back to the Startup-folder shortcut and say so (autostart still works, just unsupervised).
- [A crash-looping daemon (e.g. port conflict at login) could restart-spin] → Mitigation: bounded restart counts (Windows `RestartCount=3`; systemd default `StartLimitBurst`; launchd throttles to 10s intervals natively); the single-instance guard makes a duplicate start exit cleanly (exit 0), which does not trigger a restart.
- [Supervised foreground mode bypasses `lifecycle.start`, so the PID file is not written by the launcher] → Mitigation: the daemon writes its own PID file on boot when running supervised, keeping `status`/`stop` working identically.
- [systemd user sessions vary across distros] → Mitigation: capability-probe `systemctl --user` and degrade to XDG with a clear notice.
- [`update` assumes a global npm install] → Mitigation: detect an `npx`/non-global invocation and print the correct manual command instead of guessing.

## Open Questions

- Windows restart parameters: 3 restarts / 1-minute interval is proposed; adjust after real-world crash data.
- Should `status` report the supervision mechanism in use (task/agent/unit/legacy)? Leaning yes — one extra line, useful for debugging.
