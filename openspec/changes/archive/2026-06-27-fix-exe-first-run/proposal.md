## Why

The v0.1.0 `DataLoom.exe` is unusable the way people actually run a downloaded app: double-clicked from a folder like `Downloads`, it finds no `openspec/` workspace in its working directory, prints an error, and exits — the console flashes and closes, so it looks like nothing runs. And even when launched in a valid project, it never opens a browser, so there's no visible result. The exe works only from a terminal with a project argument, which isn't how a downloaded executable is used.

This change makes the first run friendly so a double-clicked exe opens the dashboard.

## What Changes

- **Resilient launch**: launching without a valid project no longer exits. The daemon starts the dashboard anyway — using the launch project if it's valid, otherwise the first **discovered** project (from the Claude Code list), otherwise a "no project selected" state with the picker — so the user can choose a project in the UI.
- **Auto-open the browser**: on startup the app opens the default browser to the dashboard URL (suppressible via an env var for headless/dev use).
- **No-active-project state**: the dashboard serves and presents the project selector (and an empty roadmap prompt) when no project is active, rather than requiring one up front.
- The `openspec` prerequisite check is unchanged (still fails loudly with install guidance if openspec is missing).

This is additive robustness on settled capabilities, so it is a Phase 1 change.

## Capabilities

### New Capabilities
<!-- None. This refines existing launch and project-selection behavior. -->

### Modified Capabilities
- `self-contained-launch`: Launching without a valid project starts the dashboard (discovered project or picker state) instead of exiting; the app opens the browser to the dashboard on startup (suppressible).
- `project-selection`: The dashboard operates with no active project — presenting the picker and an empty state — until the user selects one.

## Impact

- **`src/index.ts`**: launch resolves to a valid/discovered project or a null (no-project) session instead of exiting; adds a browser-open step (gated by an env var).
- **`src/server.ts` / `public/`**: serve and render a no-active-project state (selector present, empty roadmap prompt); the project model tolerates a null current.
- **Release**: rebuild and publish `v0.1.1` with the fixed exe.
- No change to roadmap derivation or MCP behavior.
