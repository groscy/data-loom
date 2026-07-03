## Context

The DataLoom daemon is a long-running local Node process that serves the dashboard and the MCP endpoint on a loopback port. It already supports a detached/background run mode (`src/lifecycle.ts`, `src/autostart.ts`) with a single-instance guard and login autostart, plus `start`/`stop`/`restart`/`status` verbs in `src/index.ts`. In detached mode there is no attached console and no window, so the only way to confirm the daemon is alive is `data-loom status`. `main()` already resolves a loopback URL, calls `openBrowser(url)`, and installs a `shutdown()` handler on `SIGINT`/`SIGTERM`. This change adds a system-tray presence as an ambient liveness indicator that plugs into those existing lifecycle points.

The product is Windows-first, local-only, single-user, and has no GUI runtime today (plain Node — no Electron). The mirror-not-launcher principle applies: DataLoom reflects state and controls only itself.

## Goals / Non-Goals

**Goals:**
- A tray icon whose presence == "the daemon is running", torn down on stop/signals.
- Tooltip showing status + loopback URL; menu with Open Dashboard, Copy URL, Stop.
- Zero new heavyweight runtime (no Electron); lazy, fail-safe integration.
- Fully graceful no-op on headless/unsupported/session-0 hosts.

**Non-Goals:**
- Rendering MCP servers or any external app in the tray (mirror principle).
- Rich tray state variants (e.g. per-project icons, badges) — v1 is binary present/absent.
- A cross-platform GUI framework or replacing the CLI `status`/`stop` verbs.
- Notifications/toasts (separate concern).

## Decisions

**1. Tray via a lightweight, no-Electron library (e.g. `systray2`), loaded lazily.**
`systray2` (a maintained `node-systray` fork) ships a tiny per-platform helper binary and talks to it over stdio, giving a persistent icon + tooltip + click-driven menu without pulling in Electron. It is `import()`-ed lazily *after* the server is listening and wrapped in try/catch so a missing binary or headless host is a no-op.
- *Alternatives considered:* Electron `Tray` (rejected — enormous dependency for one icon); a hand-rolled Windows `NotifyIcon` helper via PowerShell/.NET (zero npm dep but Windows-only and more fragile — kept as a fallback option, see Open Questions); `node-notifier` (rejected — transient notifications, not a persistent tray).

**2. Wire into the existing lifecycle, never blocking startup.**
Initialize the tray fire-and-forget from `main()` right after `startServer(...)` resolves, passing the resolved loopback URL. Registration returns a disposer that `shutdown()` calls, so `SIGINT`/`SIGTERM`, `data-loom stop`, and the tray's own Stop action all remove the icon through one path. Tray init failures are logged (to the background log file in detached mode) and swallowed.
- *Alternative:* a separate tray process — rejected; the icon must live and die with the daemon, so co-hosting is simpler and truthful.

**3. Show the tray in both foreground and detached mode, with an env opt-out.**
The tray is harmless in foreground and essential in detached mode (the only visible signal there). A `DATA_LOOM_NO_TRAY` env var disables it, mirroring the existing `DATA_LOOM_NO_OPEN` convention.
- *Alternative:* detached-only — rejected; consistent behavior is simpler and foreground users also benefit.

**4. Menu actions reuse existing mechanisms.**
Open Dashboard → existing `openBrowser(url)`. Stop → existing `shutdown()`. Copy URL → best-effort clipboard: on Windows pipe the URL to `clip`; on macOS/Linux use `pbcopy`/`xclip` if present, else silently skip. No new clipboard dependency.

**5. Icon asset derived from the existing brand mark.**
Generate a small raster icon (PNG/ICO, base64-embedded for the tray lib) from `public/icon.svg` (the woven-lattice mark). Ship a prebuilt asset under `build/` (or `public/`) so runtime needs no SVG rasterizer; it is included via `package.json` `files`.

## Risks / Trade-offs

- **Bundled native helper enlarges the package and platform matrix** → lazy-load and treat the lib as optional; degrade to no-op if the helper is absent or fails, so a broken/missing binary never breaks the daemon.
- **Detached/session-0 or headless hosts have no interactive tray** → all tray calls are guarded; failure logs once and the daemon serves normally.
- **Antivirus may flag a bundled helper binary** → document it; acceptable for a local dev tool, and the feature is opt-out-able.
- **Clipboard support varies across platforms** → best-effort only; Copy URL failing is non-fatal and never surfaces as a crash.
- **Tray Stop is destructive (kills the daemon)** → it routes through the same guarded `shutdown()` as the CLI stop; labeled clearly ("Stop DataLoom").

## Migration Plan

Additive and reversible. Steps: add the tray dependency (optional/lazy) + `src/tray.ts`; generate the icon asset and add it to `package.json` `files`; call the tray initializer after `startServer` and register its disposer in `shutdown()`. Rollback: the feature is a guarded no-op behind `DATA_LOOM_NO_TRAY`, and removing the initializer call fully disables it — no persisted state, no data migration, no change to the daemon/websocket/MCP contract.

## Open Questions

- ~~Final library choice: `systray2` vs. a Windows-only `NotifyIcon` helper.~~ **Resolved (apply):** chose the zero-dependency Windows `NotifyIcon` helper — a hidden PowerShell process spawned by the daemon that draws the mark via GDI+ (no rasterized asset), shows a tooltip + context menu, reports clicks on stdout, and self-terminates when the parent daemon exits. No npm/native-binary dependency; the `src/tray.ts` disposer seam is as designed.
- Should the tray also reflect "no project selected" as a distinct state, or is present/absent sufficient for v1? (Leaning: sufficient — deferred.)
