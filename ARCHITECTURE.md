# DataLoom architecture

DataLoom is a single local **daemon** (a Node HTTP + WebSocket server) with a thin browser view. The daemon is the single source of truth; everything else is either a source it reads, a consumer it feeds, or a CLI that manages it.

![DataLoom architecture: three external sources feed a loopback daemon that serves a browser dashboard and MCP clients, with a write-back loop to the workspace and a CLI/lifecycle layer that manages the daemon](docs/architecture.svg)

## The three tiers

### External sources — what the daemon reads

| Source | Role |
| --- | --- |
| `openspec` CLI | The roadmap data provider. **Not bundled** — the daemon invokes your installed `openspec` and exits with install guidance if it's missing. |
| `openspec/` workspace | The project's `proposal.md`, `specs/`, and `changes/archive/` files. Read for derivation **and written back** by the dependency tools (see the live loop below). |
| Claude MCP config | `~/.claude.json` and `~/.claude/.mcp.json` — read to discover your MCP server topology and the list of selectable projects. |

### The daemon — a single loopback process

Bound to `127.0.0.1:4317`, it holds four subsystems:

- **Roadmap derivation** — `watch → derive → model`. A pure function of the workspace ([`derive.ts`](src/derive.ts)): it builds a dependency DAG from capability ownership plus explicit `## Depends On` edges, assigns each change a phase by longest-path depth, and surfaces cycles and dangling dependencies as conflicts. Nothing about ordering is stored — a [file watcher](src/watcher.ts) recomputes it on every change.
- **MCP discovery** — merges the Claude configs into one de-duplicated, **secret-free** server list ([`discovery.ts`](src/mcp/discovery.ts)) and checks liveness **passively** ([`availability.ts`](src/mcp/availability.ts)): connect to already-listening URLs, scan the process table for stdio servers. It never launches a server.
- **HTTP + WebSocket server** ([`server.ts`](src/server.ts)) — serves the SPA, pushes live model / MCP / project state over WebSocket, and enforces the loopback Host + Origin guard (the DNS-rebinding / CSRF defense).
- **MCP server** ([`mcpServer.ts`](src/mcpServer.ts)) — the *same* daemon also hosts an MCP endpoint over Streamable-HTTP, exposing dependency tools and the `weave` prompt. One registration serves every project; the target is resolved per call.

### Consumers — what the daemon feeds

- **Browser dashboard** ([`public/`](public/)) — a thin, live-updating SPA with a roadmap tab (changes by phase × status), an atlas tab (the settled system, opening on a C4-style map that drills into the documentation) and an MCP topology tab. All three are pan/zoom canvases driven by one shared controller. It only renders daemon state.
- **MCP clients** — Claude Code / Claude Desktop, over `/mcp`, or via the on-demand [stdio shim](src/mcpShim.ts) that starts the daemon and proxies to it.

## The live loop

The dashed return arrow is the signature flow. When your Claude calls `set_dependency`, the daemon's MCP server **writes a `## Depends On` entry into the workspace's `proposal.md`** → the file watcher fires → derivation recomputes deterministically → the new roadmap is pushed to the browser over WebSocket. The workspace is therefore both a source and a write target, and the roadmap updates with no manual refresh.

## The management layer

Orthogonal to the request path, [`index.ts`](src/index.ts) dispatches the CLI verbs (`up`, `start` / `stop` / `restart` / `status`, `autostart`, `connect` / `disconnect`, `update`) that install, run, supervise, and register the daemon with Claude — the always-on plumbing rather than part of the data flow.

## Module map

| File | Responsibility |
| --- | --- |
| [`src/index.ts`](src/index.ts) | Daemon entry point + CLI verb dispatch; session and project-selection state |
| [`src/server.ts`](src/server.ts) | HTTP + WebSocket server, static assets, REST API, loopback guard, MCP session hosting |
| [`src/derive.ts`](src/derive.ts) | Pure roadmap derivation: DAG, phases, readiness, conflict detection |
| [`src/atlas.ts`](src/atlas.ts) | Pure atlas derivation: building blocks, provenance, decisions, co-change relations |
| [`src/openspecClient.ts`](src/openspecClient.ts) | Wrapper around the `openspec` CLI + proposal-metadata parsing |
| [`src/watcher.ts`](src/watcher.ts) | Debounced `openspec/` file watcher that triggers recompute |
| [`src/projects.ts`](src/projects.ts) | Discover selectable OpenSpec projects from Claude's known projects |
| [`src/mcp/discovery.ts`](src/mcp/discovery.ts) | Merge + redact MCP server definitions from Claude config |
| [`src/mcp/availability.ts`](src/mcp/availability.ts) | Passive liveness probing (URL connect, process-table scan) |
| [`src/mcpServer.ts`](src/mcpServer.ts) | MCP server: dependency tools + `weave` prompt |
| [`src/mcpShim.ts`](src/mcpShim.ts) | On-demand stdio ↔ HTTP proxy that ensures the daemon is up |
| [`src/lifecycle.ts`](src/lifecycle.ts) | Detached daemon start / stop / status / restart / update |
| [`src/autostart.ts`](src/autostart.ts) | Per-user login item + crash supervision (Task Scheduler / launchd / systemd) |
| [`src/claudeCode.ts`](src/claudeCode.ts) · [`src/claudeDesktop.ts`](src/claudeDesktop.ts) | Register / unregister the MCP endpoint with each client |
| [`src/weaveAlias.ts`](src/weaveAlias.ts) | Provision the `/loom:weave` command |
| [`src/tray.ts`](src/tray.ts) | Ambient system-tray indicator for the detached daemon |
| [`public/`](public/) | Browser SPA: roadmap, atlas (map + documentation) and MCP topology views |

## Design principles

- **Derived, not stored** — phase and order are a pure function of the OpenSpec files, recomputed on every change.
- **Mechanical dependencies** — an edge is "change B modifies a capability that change A introduces"; no NLP, no guessing.
- **Mirror, never launcher** — MCP liveness is observed passively; the dashboard never spawns anything.
- **openspec stays external** — DataLoom ships the app, not the `openspec` CLI; it invokes your installed copy.
- **Loopback only** — the daemon binds to `127.0.0.1`, validates Host + Origin, redacts secrets, and holds no credentials. See [README § Security](README.md#security).

> The diagram is [`docs/architecture.svg`](docs/architecture.svg) — a self-contained, light/dark-aware SVG. Edit it there to keep this page current.
