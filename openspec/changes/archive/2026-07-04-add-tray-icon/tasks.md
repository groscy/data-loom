## 1. Tray helper approach (zero-dependency, Windows-first)

<!-- Resolves the design's open question: chosen a bundled PowerShell NotifyIcon
     helper over `systray2` — no native-binary dependency, and the icon is drawn
     at runtime so no rasterized asset needs shipping. -->

- [x] 1.1 Use a hidden PowerShell `NotifyIcon` helper spawned by the daemon (no `systray2`/native-binary dependency added).
- [x] 1.2 Draw the DataLoom woven-lattice mark in the helper via GDI+ at runtime (no rasterized icon asset to ship or add to `package.json` `files`).
- [x] 1.3 Report menu clicks from the helper to the daemon over stdout (`open` / `copy` / `stop`).

## 2. Tray module

- [x] 2.1 Create `src/tray.ts` exporting `initTray({ url, onOpen, onCopy, onStop, log })` that returns a `dispose()` disposer.
- [x] 2.2 Guard init so a missing PowerShell / non-Windows / headless host / `DATA_LOOM_NO_TRAY` is a no-op (spawn wrapped in try/catch; returns a no-op disposer, logs once).
- [x] 2.3 Render the icon with a tooltip that reports running status and the loopback URL (e.g. `DataLoom - running - http://127.0.0.1:4317`).
- [x] 2.4 Build the context menu: **Open Dashboard**, **Copy URL**, **Stop DataLoom**, emitting each as a stdout event wired to the injected callbacks.
- [x] 2.5 Implement best-effort **Copy URL** clipboard helper (`clip` on Windows; `pbcopy`/`xclip` elsewhere; silent skip otherwise).
- [x] 2.6 Ensure `dispose()` is idempotent and the icon is removed cleanly (helper watches the parent daemon and disposes its own NotifyIcon on parent exit, avoiding a ghost icon).

## 3. Daemon lifecycle integration

- [x] 3.1 In `src/index.ts` `main()`, after `startServer(...)` resolves, call `initTray` with the resolved loopback URL without blocking startup.
- [x] 3.2 Wire **Open Dashboard** to a browser launch that works even in detached mode (`launchBrowser`) and **Stop DataLoom** to the existing `shutdown()`.
- [x] 3.3 Register the tray `dispose()` inside `shutdown()` so `SIGINT`, `SIGTERM`, `data-loom stop`, and the tray Stop action all remove the icon through one path.
- [x] 3.4 Honor a `DATA_LOOM_NO_TRAY` env opt-out (mirroring `DATA_LOOM_NO_OPEN`); when set, skip tray init entirely.
- [x] 3.5 Keep the tray DataLoom-only — the fixed three-item menu exposes no action that starts/stops any MCP server or external app (mirror principle).

## 4. Verify

- [x] 4.1 Icon lifecycle validated on Windows: the helper starts, draws the mark, shows the icon, and disposes it cleanly (setup + teardown confirmed; stderr clean after suppressing PowerShell's benign progress noise). Live menu-click confirmation needs an interactive desktop session.
- [x] 4.2 Shutdown paths route through one `dispose()`; the helper self-cleans within ~150ms of the parent exiting, so no stale icon remains after `stop`/signal/exit. Detached `data-loom start` uses the same `main()` path (tray not gated by `DATA_LOOM_DETACHED`).
- [x] 4.3 Degradation verified: `DATA_LOOM_NO_TRAY=1` and non-Windows return a no-op tray with no spawn; init failures are caught and non-fatal.
- [x] 4.4 `npm run build` passes; no runtime errors in the tray helper output.
