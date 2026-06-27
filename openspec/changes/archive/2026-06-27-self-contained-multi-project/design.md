## Context

data_loom currently: requires Node + `npm install` + `npm run build`, and binds to `cwd` for its one project. It already shells out to an external `openspec` CLI, already takes a `repoRoot`, and already reads `~/.claude.json` (which lists the user's projects). This change removes the *runtime* friction for end users by shipping a standalone executable, and makes the displayed project selectable. `openspec` deliberately stays external — the executable invokes the user's own install.

## Goals / Non-Goals

**Goals:**
- A single Windows `.exe` that embeds the Node runtime, app, and static assets — no end-user Node install, no `npm install`, no build to run.
- Launch against any project via an argument; switch the displayed project at runtime from the UI, live.
- Project switch re-scopes everything: roadmap derivation, file-watching, and MCP project-scoped discovery.
- A README that makes prerequisites and usage obvious.

**Non-Goals:**
- Bundling `openspec` into the executable. It stays a separately-installed prerequisite, invoked at runtime.
- Publishing to npm.
- Watching multiple projects simultaneously — one active project at a time.
- Cross-compiling for non-Windows targets in this change (the build can be extended later).

## Decisions

### D1 — openspec stays external; keep the fail-loud check
The executable does not contain `openspec`. The daemon continues to invoke `openspec` from PATH and, on startup or if invocation fails, exits with a clear message instructing the user to install it (e.g. `npm i -g openspec`). This is the existing availability check, with the message made explicit about the prerequisite. No bundling, no local-resolution fallback.

### D2 — Standalone executable via Node SEA
Produce the exe with Node's Single Executable Applications support:
1. Bundle the ESM app to one CJS file with esbuild (`--bundle --platform=node --format=cjs`), pulling in the `ws` dependency.
2. Embed the static `public/` files as SEA assets (declared in the SEA config).
3. Generate the SEA blob (`node --experimental-sea-config`) and inject it into a copy of the Node binary with `postject`, producing `data-loom.exe`.
`@yao-pkg/pkg` is a viable fallback if SEA asset handling proves fiddly. A `npm run package` script wraps the steps; CI/users get a ready exe.

### D3 — Serve assets from the embedded bundle when packaged
`server.ts` currently reads `public/` from disk. When running as a SEA, it reads the embedded assets via `node:sea` (`getAsset`) instead. A small abstraction picks the source: filesystem in dev, embedded assets in the packaged exe. Same routes, same MIME handling.

### D4 — Selectable project as daemon state
Replace the fixed `repoRoot` constant with a mutable `currentProject`, seeded from the launch argument (`data-loom.exe [path]`), then `DATA_LOOM_ROOT`, then `cwd`. A single `switchProject(path)` owns the transition:
1. validate the path contains an `openspec/` directory (reject otherwise),
2. stop the existing watcher,
3. recompute the roadmap and re-run MCP discovery for the new path,
4. start a fresh watcher on the new `openspec/`,
5. broadcast the new roadmap, MCP model, and active-project state.
The `OpenSpecClient` is recreated per project; derivation and discovery already accept a path.

### D5 — Project discovery
Candidates come from `~/.claude.json` `projects` keys, filtered to directories that contain an `openspec/` folder (so the picker only offers viewable projects), de-duplicated by normalized path, plus the currently active project. The UI also accepts a manually entered path. Reuses the Claude Code config already read for MCP discovery.

### D6 — Endpoints, push, and selector UI
- `GET /api/projects` → `{ current, candidates[] }`; `POST /api/project/select?path=...` → switch (4xx on invalid), broadcasting `project` + `model` + `mcp`. On ws connect, also send the current `project`.
- A compact dropdown in the header shows the active project and lists candidates; choosing one POSTs the selection. Both tabs then reflect the chosen project.

### D7 — README
A top-level `README.md`: one-paragraph pitch (WHAT vs HOW); **prerequisite** (install `openspec`); download the exe from GitHub Releases and run it (plus the from-source dev path); usage + project selection; the two tabs; and the core principles (derived-not-stored ordering, passive never-launch MCP mirror).

### D8 — Build and release in CI
A GitHub Actions workflow (`.github/workflows/release.yml`) triggers on version tags (`v*`), runs on `windows-latest`, sets up Node 22, installs dependencies, and runs `npm run package`. It then publishes `data-loom.exe` to a GitHub Release for the tag (e.g. via `softprops/action-gh-release`, which creates the release and uploads the asset). Users download the prebuilt exe from the repo's Releases page; the from-source path remains for development. The release job needs only the default `GITHUB_TOKEN` with `contents: write`.

## Risks / Trade-offs

- **SEA is experimental / asset embedding is fiddly** → wrap the steps in one `package` script; keep `@yao-pkg/pkg` as a documented fallback; the from-source run path always works.
- **Packaged exes trip antivirus / SmartScreen** → expected for unsigned local tools; document it. Signing is out of scope.
- **openspec not on PATH for the exe** → the exe inherits the user's PATH; the fail-loud check (D1) makes the missing prerequisite obvious with install guidance.
- **Watcher leak on rapid switching** → `switchProject` always tears down the previous watcher before starting a new one; switches are serialized.
- **Selected path without `openspec/`** → validated up front; the API returns an error and the UI keeps the previous project.

## Migration Plan

Additive. Running from source (`npm start` in a project dir) keeps working for development — `cwd` is still the default project. The exe is the new end-user artifact. No data migration. Rollback = drop the packaging step; the source path is unchanged.

## Open Questions

- **Persist the last-selected project** across restarts (a tiny local state file) — deferred; default seeding (arg → env → cwd) is enough for v1.
- **Cross-platform exes** (macOS/Linux builds) — deferred; the SEA/pkg step generalizes when needed.
