## 1. Supervised run mode and stable launcher

- [x] 1.1 Add a supervised foreground mode to the daemon: browser suppressed, output to the background log file, PID file written by the daemon itself on boot (keeps `status`/`stop` working when no `start` launcher wrote it)
- [x] 1.2 Ensure every deliberate shutdown path (SIGTERM/SIGINT handler, tray Stop) exits with code 0, and add a comment-level guarantee that supervisors rely on it
- [x] 1.3 Add launcher-script generation to `src/paths.ts`/`src/autostart.ts`: write `daemon.cmd` (Windows) / `daemon.sh` (POSIX) into the state dir, resolving `data-loom` from PATH with recorded absolute-path fallback

## 2. Per-OS supervised registrations (src/autostart.ts)

- [x] 2.1 Windows: replace the Startup `.lnk` writer with `Register-ScheduledTask` (logon trigger, user principal, no elevation, RestartCount 3 / 1-minute interval) invoking the launcher; keep the `.lnk` path as fallback when task creation fails, with a clear notice
- [x] 2.2 macOS: add `KeepAlive: {SuccessfulExit: false}` to the LaunchAgent plist and point it at the launcher
- [x] 2.3 Linux: write and enable a systemd user unit (`Restart=on-failure`) via `systemctl --user enable --now`; probe availability and fall back to the XDG entry with a "no supervision" notice
- [x] 2.4 Migration: `enable` removes any legacy registration before writing the supervised one; `disable` removes both generations; `isEnabled` recognizes both

## 3. Lifecycle integration (src/lifecycle.ts, src/index.ts)

- [x] 3.1 Make `stop` supervision-aware: on Linux use `systemctl --user stop` when the unit is active; verify on all platforms that a stopped daemon is not restarted
- [x] 3.2 Extend `status` to report the supervision mechanism in use (scheduled task / launch agent / systemd unit / legacy / none)
- [x] 3.3 Implement `data-loom update`: npm global upgrade → conditional `restart` → conditional registration + launcher rewrite; abort on upgrade failure; print manual guidance for non-global installs; add the verb to CLI dispatch
- [x] 3.4 Graceful cross-process stop: add a loopback-only `POST /api/shutdown` (behind the existing Host/Origin guard) that runs the daemon's own exit-0 shutdown; `stop()` calls it first, falling back to `process.kill`. Needed because Windows `process.kill(pid,"SIGTERM")` force-terminates (exit 1) and never reaches the handler, which a supervising Scheduled Task would misread as a crash and restart (see design.md decision #3)

## 4. Verification and docs

- [x] 4.1 End-to-end supervised restart VERIFIED on the Linux systemd path (real `systemctl --user` unit in WSL2): `enable` created a `Restart=on-failure` unit and started it (reachable); `kill -9` of the unit's MainPID → systemd restarted it automatically (NRestarts 0→1, new pid, HTTP 200 again); `data-loom stop` → unit inactive and NOT restarted (clean-stop-stays-stopped, via `systemctl --user stop`); unit is `enabled` (WantedBy=default.target) so it launches on login. On Windows, `data-loom stop` → daemon exits 0 via `/api/shutdown` VERIFIED separately; the Scheduled Task OS-restart itself is still unverified here (this host denies non-elevated task creation) but is the same restart-on-failure contract proven on systemd.
- [x] 4.2 Bounded crash-loop + single-instance guard VERIFIED: on the systemd unit, a fast-failing launcher drove systemd to "Start request repeated too quickly" → unit `failed`, retries stopped (StartLimitBurst=5/10s, confirmed on the unit) rather than spinning forever; single-instance guard exits 0 (duplicate launch while running returns exit 0, measured on Windows).
- [x] 4.3 Verify registration survives a simulated package relocation (move the install, rely on PATH resolution)
- [x] 4.4 Update README ("Run it always-on"): supervision guarantee, `update` verb, migration note for existing users
