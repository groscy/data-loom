# DataLoom

A fully-local dashboard for spec-driven development. Two views of the same workflow:

- **WHAT do I develop?** — an interactive, phased [OpenSpec](https://github.com/Fission-AI/OpenSpec) roadmap. Changes are laid out by derived dependency phase and coloured by status, with archived work in a done-band and dependency cycles / dangling deps surfaced as conflicts.
- **HOW / with what?** — a topology of your local MCP setup: a hub-and-spoke graph centred on Claude Code, with passive, never-launch liveness for each server.

It runs as a small local daemon (a Node HTTP + WebSocket server) and a browser view on `localhost`. The daemon is the single source of truth; the page is a thin, live-updating view.

## Prerequisite

DataLoom reads your workspace through the **OpenSpec CLI**, which is **not bundled**. Install it separately:

```
npm install -g openspec
```

(data-loom invokes your installed `openspec`; if it's missing, it exits with this guidance instead of showing a blank dashboard.)

## Get it (recommended): install from npm

Requires [Node.js](https://nodejs.org) ≥ 20.

Run it directly with `npx` (no install), pointing at a project (any directory containing an `openspec/` workspace):

```
npx @lyric_dev/data-loom "C:\path\to\your\project"
```

Or install it globally and run the `data-loom` command:

```
npm install -g @lyric_dev/data-loom
data-loom "C:\path\to\your\project"
```

With no argument it uses the current directory. Then open <http://127.0.0.1:4317>.

> Published to npm automatically by CI on version tags (`vX.Y.Z`) via GitHub Actions.

## Run from source (development)

Requires Node.js ≥ 20.

```
npm install
npm start            # serves the current directory's project
# or: npm start -- "C:\path\to\project"
```

(The npm package is `@lyric_dev/data-loom` — unscoped `data-loom` is blocked by npm as too similar to an existing package; the product is branded **DataLoom** and installs a `data-loom` command.)

## Using the dashboard

- **Project selector** (top-right): switch which project is displayed. The list is your Claude Code known projects that contain an `openspec/` workspace, plus the active one. Switching re-scopes the roadmap, the file-watching, and the MCP project-scope live.
- **Roadmap tab**: changes by phase × status. Click a node to inspect its phase, status, and the capabilities it adds/modifies. A conflicts banner appears if the dependency graph has a cycle or a dangling dependency.
- **MCP Topology tab**: your servers around the Claude Code hub. Click **check** on a server to passively probe it — DataLoom never starts a server or its backing app; it only reports what's reachable so you know what to start yourself.

## Plan dependencies with your Claude (MCP server)

DataLoom can also run as an **MCP server**, so your own Claude session determines and applies the order of interdependent proposals — DataLoom holds no API key and the reasoning runs under your authenticated Claude.

1. Register it in Claude Code (stdio server):

   ```
   claude mcp add data-loom -- npx @lyric_dev/data-loom mcp "C:\path\to\your\project"
   ```

   (From source: `node dist/index.js mcp "C:\path\to\project"`.)

2. In that project, ask Claude something like *"review DataLoom's open proposals and set the dependencies."* On connect, the server asks Claude to surface any proposal that hasn't been reviewed for dependencies yet, propose the edges, and **confirm with you before writing**. It exposes three tools:
   - `list_open_proposals` — the open changes with their proposal text, current phase/readiness, and dependency-review state (read-only; proposal text only, no secrets).
   - `set_dependency(from, to)` — writes a `## Depends On` entry into a proposal.
   - `mark_independent(change)` — records that a proposal genuinely depends on nothing, by writing an empty `## Depends On` block.
   - `install_weave_skill` — installs the `/loom:weave` shortcut command (one-time setup, see below).

   Each write is an explicit, reviewable `## Depends On` edit; the roadmap then recomputes deterministically. Proposals that still need a dependency decision are flagged in the roadmap with a **"needs review"** badge, and DataLoom appears as a server in its own MCP Topology tab once registered.

3. **One command for it all: `/loom:weave`.** Ask Claude to *"install the weave skill"* (it calls `install_weave_skill`). That writes a `/loom:weave` slash command into your global Claude config (`~/.claude/commands/loom/weave.md`); reload Claude Code, and from then on `/loom:weave` runs the whole review — list, propose, confirm, apply — in any project where DataLoom is registered.

## Design principles

- **Derived, not stored** — phase/order is a pure function of the OpenSpec files, recomputed on every change. Nothing about ordering is persisted.
- **Mechanical dependencies** — an edge is "change B modifies a capability that change A introduces"; no NLP, no guessing.
- **Mirror, never launcher** — MCP liveness is observed passively (connect to listening URLs; scan the process table for stdio servers). The dashboard never spawns anything.
- **openspec stays external** — data-loom ships the app, but not openspec; it invokes your installed `openspec` CLI.

## Built with itself

DataLoom was specified and built with OpenSpec; its own `openspec/` workspace is in this repo, and early in development the dashboard rendered its own build plan.
