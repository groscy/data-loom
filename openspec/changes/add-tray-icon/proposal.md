## Why

The DataLoom daemon now runs detached in the background (no attached console, no window), which means a user has no glanceable way to confirm it is actually running — the only signal today is running `data-loom status` in a terminal. A persistent system-tray icon gives an ambient, always-visible indicator that the daemon (dashboard + MCP endpoint) is alive, plus one-click access to it.

## What Changes

- Add a **system-tray icon** owned by the running daemon. The icon is present while the daemon runs and is removed when it stops, so its mere presence answers "is DataLoom running?".
- The icon's **tooltip** shows the daemon's status and loopback URL (e.g. `DataLoom — running · http://127.0.0.1:4317`).
- A **right-click context menu** offers passive, DataLoom-only actions:
  - **Open Dashboard** — open the loopback URL in the default browser.
  - **Copy URL** — copy the loopback URL to the clipboard.
  - **Stop DataLoom** — terminate this daemon (reuses the existing stop path).
- The tray is shown in the detached/background run mode (and in foreground mode); it is a visual companion to the existing `status`/`stop` lifecycle subcommands, not a replacement.
- **Graceful degradation**: on a host with no available system tray (headless/unsupported environment), the daemon runs exactly as before with no tray and never crashes or blocks on tray failure.
- **Mirror principle preserved**: the tray reflects and controls only DataLoom's own daemon — it never starts, stops, or represents any MCP server or other application.

## Capabilities

### New Capabilities
- `tray-indicator`: a system-tray presence for the running daemon that shows liveness (present = running), surfaces the status/URL via tooltip, offers open/copy/stop actions, and degrades to a no-op where no tray is available.

### Modified Capabilities
<!-- None. The tray is additive; its "Stop" action reuses the existing daemon-lifecycle stop path without changing that capability's requirements. -->

## Impact

- **New dependency**: a lightweight, no-Electron system-tray library for Node (or a small bundled native helper) capable of showing a Windows tray icon with a tooltip and context menu.
- **New module** (e.g. `src/tray.ts`) wired into the daemon's startup and shutdown in `src/index.ts` so the icon appears after the server is listening and is torn down on `SIGINT`/`SIGTERM`/stop.
- **Icon asset**: a tray-sized icon derived from the existing `public/icon.svg` woven-lattice mark (e.g. a `.ico`/`.png` under `public/` or `build/`).
- **Platform**: Windows-first (the stated target host); other platforms and headless environments fall back to no tray.
- No change to the daemon contract, the websocket/model, or the MCP topology.
