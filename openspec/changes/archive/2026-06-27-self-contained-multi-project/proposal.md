## Why

Today data_loom is awkward to adopt: you need Node installed, then `npm install` and a build, and the daemon only ever shows the single project it was launched in (its `cwd`). For a "run it locally and glance at your work" tool, that is too much setup and too rigid. This change makes data_loom **self-contained as a runnable executable** (a single `.exe`, no Node install and no build step for the user) and **multi-project** (pick which project's roadmap + MCP topology to display, and switch live) — and documents it in a README the repo currently lacks.

`openspec` stays a separate prerequisite the user installs themselves; it is **not** bundled. The executable invokes the user's installed `openspec` and fails with clear install guidance if it is missing.

This is additive on top of the settled baseline; it has no pending dependencies, so it is a Phase 1 change.

## What Changes

- **Standalone executable**: produce a single Windows `.exe` that embeds the Node runtime, the app, and the static web assets, so a user runs one file — no Node install, no `npm install`, no build. The exe is built by CI (below); running it is one double-click / one command.
- **openspec stays external**: the executable does **not** contain `openspec`. It invokes the separately-installed `openspec` CLI and, if absent, exits with a clear message telling the user to install it.
- **Automated builds + GitHub Releases**: a GitHub Actions workflow builds the `.exe` on a Windows runner and publishes it as a downloadable asset on the repository's GitHub Releases, so users download a prebuilt executable rather than building anything.
- **Target any project**: accept a project path as a launch argument instead of being bound to `cwd`.
- **In-app project selection**: discover candidate projects (Claude Code's known projects that contain an `openspec/` workspace) and let the user pick one — or enter a path — from a selector in the header. Selecting a project re-points the file-watcher, re-derives the roadmap, and re-scopes MCP discovery to that project, live, without restarting.
- **README**: add a README documenting the prerequisite (install openspec), how to download the exe from GitHub Releases and run it, project selection, both tabs, and the design principles.

## Capabilities

### New Capabilities
- `self-contained-launch`: Build and run data_loom as a standalone executable that embeds the Node runtime, app, and static assets — no end-user Node install or build — while keeping `openspec` as an external prerequisite the executable invokes (failing with install guidance if missing). Accepts a target project path at launch.
- `project-selection`: Discover selectable projects (Claude Code known projects with an `openspec/` workspace, plus a manual path) and switch the displayed project at runtime, re-scoping the roadmap, file-watching, and MCP project-scope to the selection.
- `release-pipeline`: Build the standalone executable in GitHub Actions (Windows runner) on a version tag and publish it as a downloadable asset on a GitHub Release.

### Modified Capabilities
- `roadmap-daemon`: The target project becomes runtime-selectable rather than fixed at startup; the daemon re-points its watcher and recomputes on selection.
- `roadmap-view`: Gains a project selector control showing the current project and the available candidates.
- `mcp-discovery`: Project-scoped server discovery follows the currently selected project rather than only the daemon's launch directory.

## Impact

- **Packaging**: adds a build that produces a standalone `.exe` (embedding the static `public/` assets), so the end user needs neither Node nor a manual build. Running from source (`npm start`) still works for development.
- **Prerequisite**: `openspec` remains a separately-installed dependency; the existing startup check stays and gains explicit install guidance. It is never bundled into the exe.
- **Reads** (read-only) `~/.claude.json` `projects` keys to populate the project picker (already read for MCP discovery).
- **New endpoints** for listing/selecting projects and broadcasting the active project.
- **CI/Release**: introduces a GitHub Actions workflow under `.github/workflows/` that builds the exe on a Windows runner and publishes it to GitHub Releases on version tags.
- **Docs**: introduces `README.md`.
- Modifies the baseline `roadmap-daemon`, `roadmap-view`, and `mcp-discovery` capabilities (all settled), so this change is Phase 1 with no pending dependencies.
