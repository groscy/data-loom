# data_loom

A fully-local dashboard for spec-driven development. Two views of the same workflow:

- **WHAT do I develop?** — an interactive, phased [OpenSpec](https://github.com/Fission-AI/OpenSpec) roadmap. Changes are laid out by derived dependency phase and coloured by status, with archived work in a done-band and dependency cycles / dangling deps surfaced as conflicts.
- **HOW / with what?** — a topology of your local MCP setup: a hub-and-spoke graph centred on Claude Code, with passive, never-launch liveness for each server.

It runs as a small local daemon (a Node HTTP + WebSocket server) and a browser view on `localhost`. The daemon is the single source of truth; the page is a thin, live-updating view.

## Prerequisite

data_loom reads your workspace through the **OpenSpec CLI**, which is **not bundled**. Install it separately:

```
npm install -g openspec
```

(The executable invokes your installed `openspec`; if it's missing, it exits with this guidance instead of showing a blank dashboard.)

## Get it (recommended): download the executable

1. Download the latest `data-loom.exe` from the repository's [**Releases**](../../releases) page. It's a standalone executable — no Node install, no build.
2. Run it, pointing at a project (any directory containing an `openspec/` workspace):

   ```
   data-loom.exe "C:\path\to\your\project"
   ```

   With no argument it uses the current directory. Then open <http://127.0.0.1:4317>.

> Releases are built automatically by CI on version tags (`vX.Y.Z`) via GitHub Actions and published as a downloadable asset.

## Run from source (development)

Requires Node.js ≥ 20.

```
npm install
npm start            # serves the current directory's project
# or: npm start -- "C:\path\to\project"
```

Build the executable yourself with `npm run package` → `build/data-loom.exe`.

## Using the dashboard

- **Project selector** (top-right): switch which project is displayed. The list is your Claude Code known projects that contain an `openspec/` workspace, plus the active one. Switching re-scopes the roadmap, the file-watching, and the MCP project-scope live.
- **Roadmap tab**: changes by phase × status. Click a node to inspect its phase, status, and the capabilities it adds/modifies. A conflicts banner appears if the dependency graph has a cycle or a dangling dependency.
- **MCP Topology tab**: your servers around the Claude Code hub. Click **check** on a server to passively probe it — data_loom never starts a server or its backing app; it only reports what's reachable so you know what to start yourself.

## Design principles

- **Derived, not stored** — phase/order is a pure function of the OpenSpec files, recomputed on every change. Nothing about ordering is persisted.
- **Mechanical dependencies** — an edge is "change B modifies a capability that change A introduces"; no NLP, no guessing.
- **Mirror, never launcher** — MCP liveness is observed passively (connect to listening URLs; scan the process table for stdio servers). The dashboard never spawns anything.
- **openspec stays external** — the executable bundles the runtime and the app, but not openspec.

## Built with itself

data_loom was specified and built with OpenSpec; its own `openspec/` workspace is in this repo, and early in development the dashboard rendered its own build plan.
