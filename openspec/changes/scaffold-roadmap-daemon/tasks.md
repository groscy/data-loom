## 1. Project scaffolding

- [x] 1.1 Initialize a Node project for the daemon (package.json, TypeScript config, scripts for dev/run)
- [x] 1.2 Add a minimal browser SPA entry (build/bundle wired to a `dev` and `build` script)
- [x] 1.3 Add a single `data-loom` start command that launches the daemon and serves the SPA on localhost

## 2. OpenSpec data access

- [x] 2.1 Implement a wrapper that invokes the `openspec` CLI JSON commands (list changes, show change capabilities, status) and returns typed results
- [x] 2.2 Validate the `openspec` CLI is present at startup; fail with a clear, actionable message if missing
- [x] 2.3 Normalize CLI output into an internal model: per change → { name, newCapabilities[], modifiedCapabilities[], taskProgress, archived }

## 3. Roadmap derivation

- [x] 3.1 Build the capability index: which change ADDs each capability, and which capabilities already exist under `openspec/specs/`
- [x] 3.2 Derive dependency edges (Modified-X depends on the change that Added-X; baseline specs satisfy without an edge; disjoint additions are independent)
- [x] 3.3 Compute topological phases (depth = one deeper than deepest dependency; no-dep changes = Phase 1)
- [x] 3.4 Derive status per change from `tasks.md` progress (draft / in-progress / done; archived = done) as an independent axis
- [x] 3.5 Make derivation defensive: dangling dependencies stay unsatisfied and cycles still return a model (no crash)
- [x] 3.6 Emit the phase × status roadmap model the view consumes

## 4. Daemon runtime

- [x] 4.1 Serve the SPA bound to a loopback interface only (not a public interface)
- [x] 4.2 Establish a websocket channel; send the current roadmap model to each client on connect
- [x] 4.3 Watch the `openspec/` directory for add/edit/archive events
- [x] 4.4 Debounce bursts of filesystem events into a single recompute
- [x] 4.5 On change, recompute the model and push it to all connected clients

## 5. Roadmap view (WHAT tab)

- [x] 5.1 Render change nodes grouped and ordered by phase
- [x] 5.2 Draw dependency relationships between nodes
- [x] 5.3 Convey status as a visual treatment distinct from phase position
- [x] 5.4 Show archived changes in a collapsed, expandable "done" band
- [x] 5.5 Re-render live on daemon push without a manual refresh
- [x] 5.6 Add node inspection: selecting a change shows its phase, status, and new/modified capabilities

## 6. End-to-end verification

- [x] 6.1 Run against this repo's own `openspec/` and confirm the three in-flight changes render (scaffold-roadmap-daemon in Phase 1; the two dependents in Phase 2)
- [x] 6.2 Edit a change on disk and confirm the view updates live within ~1s
- [x] 6.3 Archive a change and confirm it moves into the collapsed done band
