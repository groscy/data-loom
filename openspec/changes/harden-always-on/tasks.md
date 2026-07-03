## 1. Supervised run mode and stable launcher

- [ ] 1.1 Add a supervised foreground mode to the daemon: browser suppressed, output to the background log file, PID file written by the daemon itself on boot (keeps `status`/`stop` working when no `start` launcher wrote it)
- [ ] 1.2 Ensure every deliberate shutdown path (SIGTERM/SIGINT handler, tray Stop) exits with code 0, and add a comment-level guarantee that supervisors rely on it
- [ ] 1.3 Add launcher-script generation to `src/paths.ts`/`src/autostart.ts`: write `daemon.cmd` (Windows) / `daemon.sh` (POSIX) into the state dir, resolving `data-loom` from PATH with recorded absolute-path fallback

## 2. Per-OS supervised registrations (src/autostart.ts)

- [ ] 2.1 Windows: replace the Startup `.lnk` writer with `Register-ScheduledTask` (logon trigger, user principal, no elevation, RestartCount 3 / 1-minute interval) invoking the launcher; keep the `.lnk` path as fallback when task creation fails, with a clear notice
- [ ] 2.2 macOS: add `KeepAlive: {SuccessfulExit: false}` to the LaunchAgent plist and point it at the launcher
- [ ] 2.3 Linux: write and enable a systemd user unit (`Restart=on-failure`) via `systemctl --user enable --now`; probe availability and fall back to the XDG entry with a "no supervision" notice
- [ ] 2.4 Migration: `enable` removes any legacy registration before writing the supervised one; `disable` removes both generations; `isEnabled` recognizes both

## 3. Lifecycle integration (src/lifecycle.ts, src/index.ts)

- [ ] 3.1 Make `stop` supervision-aware: on Linux use `systemctl --user stop` when the unit is active; verify on all platforms that a stopped daemon is not restarted
- [ ] 3.2 Extend `status` to report the supervision mechanism in use (scheduled task / launch agent / systemd unit / legacy / none)
- [ ] 3.3 Implement `data-loom update`: npm global upgrade → conditional `restart` → conditional registration + launcher rewrite; abort on upgrade failure; print manual guidance for non-global installs; add the verb to CLI dispatch

## 4. Verification and docs

- [ ] 4.1 Windows end-to-end: enable → kill the daemon process → verify automatic restart; `data-loom stop` → verify it stays stopped; re-login → verify launch
- [ ] 4.2 Verify a crash-loop is bounded (occupy the port with a foreign process, confirm retries stop) and that the single-instance guard exits 0
- [ ] 4.3 Verify registration survives a simulated package relocation (move the install, rely on PATH resolution)
- [ ] 4.4 Update README ("Run it always-on"): supervision guarantee, `update` verb, migration note for existing users
