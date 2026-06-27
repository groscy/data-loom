## Why

data_loom needs a running foundation before it can show anything: a local process that reads the OpenSpec workspace, turns it into a phased roadmap, and keeps a browser view in sync. This change builds that foundation — the daemon, the derivation logic, and the "WHAT do I develop?" roadmap view — so the later MCP-topology work has something to attach to. Without it there is no dashboard, only a spec folder.

## What Changes

- Introduce a long-running local Node **daemon** that serves a browser SPA over `localhost` and pushes updates over a websocket. It is the single source of runtime truth; the browser is a thin reactive view.
- Read the OpenSpec workspace through the `openspec` CLI's JSON output (`openspec list/show --json`) rather than hand-parsing markdown.
- **Derive** a change-level dependency DAG: a change that lists a capability under *Modified Capabilities* depends on whatever change listed that capability under *New Capabilities* (or on a capability already present in `specs/`). Compute **phases** as the topological layers of that DAG. Ordering is derived on every read and never stored.
- Track a second, independent **status** axis from each change's `tasks.md` progress (draft / in-progress / done; archived changes are done).
- Render the **WHAT tab**: an interactive phase × status roadmap where each node is exactly one OpenSpec change.
- **Watch** the `openspec/` directory and recompute + push the roadmap whenever a change is added, edited, or archived, so the view is always live.

Out of scope for this change (handled by later, dependent changes): the MCP topology tab, and detection/surfacing of dependency cycles or dangling/out-of-order dependencies.

## Capabilities

### New Capabilities
- `roadmap-daemon`: The local Node process. Serves the SPA on `localhost`, holds the websocket connection to the browser, watches the `openspec/` directory, and pushes recomputed roadmap state on change. Single source of runtime truth.
- `roadmap-derivation`: Pure logic that reads OpenSpec data (via CLI JSON), builds the change-level dependency DAG from New/Modified capability declarations, computes topological phases, and joins each change to its `tasks.md`-derived status. Produces the phase × status model the view renders.
- `roadmap-view`: The browser "WHAT do I develop?" tab. Renders the derived model as an interactive phased roadmap — nodes are changes, laid out by phase (order) and colored by status — and reacts live to daemon pushes.

### Modified Capabilities
<!-- None. This is the foundational change; the project has no existing specs yet. -->

## Impact

- **New project scaffolding**: introduces a Node-based daemon + browser SPA where the repository currently holds only OpenSpec artifacts. Establishes the toolchain (Node runtime, websocket, a frontend build) the rest of data_loom builds on.
- **Runtime dependency** on the `openspec` CLI being available on the host for JSON queries.
- **Filesystem watching** of `openspec/` while the daemon runs.
- Defines the `roadmap-daemon` and `roadmap-derivation` capabilities that the later `add-mcp-topology` and `add-roadmap-conflict-detection` changes will modify — i.e. this change is Phase 1 of the data_loom roadmap.
