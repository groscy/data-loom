## 1. Self-contained executable

- [x] 1.1 Add a packaging build that produces a standalone Windows `.exe` via Node SEA: esbuild-bundle the app to one CJS file, embed `public/` as SEA assets, inject into a node binary (`npm run package`)
- [x] 1.2 Serve static assets from the embedded SEA assets when packaged, and from the filesystem in dev (same routes/MIME)
- [x] 1.3 Keep `openspec` external: invoke the installed CLI and exit with clear install guidance if missing (no bundling, no local fallback)
- [x] 1.4 Make the entry point accept a project path argument (default: `DATA_LOOM_ROOT` then `cwd`)

## 2. Project state and switching (roadmap-daemon)

- [x] 2.1 Replace the fixed `repoRoot` with a mutable `currentProject` seeded from arg → env → cwd
- [x] 2.2 Implement `switchProject(path)`: validate the path has an `openspec/` dir, tear down the old watcher, recompute roadmap + MCP discovery for the new path, start a new watcher, broadcast
- [x] 2.3 Recreate/re-point the OpenSpecClient and MCP discovery per active project

## 3. Project discovery (project-selection)

- [x] 3.1 Read `~/.claude.json` `projects` keys and filter to directories containing an `openspec/` workspace
- [x] 3.2 De-duplicate candidates by normalized path and always include the active project
- [x] 3.3 Expose `{ current, candidates[] }` as the project model

## 4. Endpoints and push

- [x] 4.1 `GET /api/projects` returns the current project and candidates
- [x] 4.2 `POST /api/project/select?path=...` switches (or 4xx on invalid), returns the new active project, and broadcasts `project` + `model` + `mcp` updates
- [x] 4.3 On websocket connect, also send the current `project` state

## 5. Selector UI (roadmap-view)

- [x] 5.1 Add a project selector to the header showing the active project and candidates
- [x] 5.2 Selecting a candidate POSTs the selection; both tabs reflect the new project on the pushed updates
- [x] 5.3 Handle the `project` message and keep the selector in sync

## 6. README

- [x] 6.1 Add `README.md`: pitch (WHAT vs HOW), prerequisite (install `openspec`), download the exe from GitHub Releases and run it (plus the from-source dev path), usage + project selection, the two tabs, and the design principles

## 7. Release pipeline

- [x] 7.1 Add `.github/workflows/release.yml` triggered on version tags (`v*`): run on `windows-latest`, set up Node 22, install deps, run `npm run package`
- [x] 7.2 Publish the built `data-loom.exe` as a downloadable asset on a GitHub Release for the tag (e.g. `softprops/action-gh-release`, `contents: write`)

## 8. Verification

- [x] 8.1 Launch with a project path argument and confirm that project is displayed
- [x] 8.2 With `openspec` not installed, confirm the exe exits with clear install guidance (does not serve a blank dashboard)
- [x] 8.3 Select another project in the UI and confirm the roadmap, watched directory, and MCP project-scope all switch live
- [x] 8.4 Select a path without an `openspec/` workspace and confirm it is rejected and the previous project stays active
- [x] 8.5 Build the `.exe` and confirm it runs and serves the dashboard (embedded assets) without a separate Node install or build
- [x] 8.6 Confirm the release workflow is configured to build on a `v*` tag and upload the exe as a release asset
