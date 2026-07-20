# DataLoom

A fully-local dashboard for spec-driven development. It turns your [OpenSpec](https://github.com/Fission-AI/OpenSpec) workspace into a live view of three things — your **roadmap** (changes by dependency phase and status), an **architecture atlas** of the settled system, and your local **MCP setup**. Everything runs on `localhost`; nothing leaves your machine.

## Install

Requires [Node.js](https://nodejs.org) ≥ 20 and the **OpenSpec CLI**, which DataLoom does not bundle:

```
npm install -g openspec
```

Install DataLoom globally and point it at any project that has an `openspec/` workspace:

```
npm install -g @lyric_dev/data-loom
data-loom up "C:\path\to\your\project"
```

`data-loom up` starts a background daemon, registers it to launch at login, connects it to Claude Code, and prints the dashboard URL. It's safe to re-run. Then open <http://127.0.0.1:4317>.

**Just want a quick look?** Run it in the foreground instead — it stops when you close the terminal (no argument uses the current directory):

```
npx @lyric_dev/data-loom "C:\path\to\your\project"
```

Manage the background daemon any time:

```
data-loom status     # running? where are the logs?
data-loom update     # upgrade to the latest release and restart
data-loom restart
data-loom stop
```

## Use

Open <http://127.0.0.1:4317>. The daemon watches your `openspec/` workspace, so the dashboard updates live as you edit — no refresh.

- **Project selector** (top-right) — switch which project is shown. The list is your Claude Code projects that contain an `openspec/` workspace.
- **Roadmap** — changes laid out by dependency phase and coloured by status, on a canvas you drag to pan and pinch to zoom; a minimap appears once the plan outgrows the window. Click a node to inspect it. Dependency cycles and dangling dependencies surface as conflicts. Archived work isn't shown here — it's in the Atlas.
- **Atlas** — the settled system as living, Arc42-flavored documentation derived from your specs: capabilities grouped by domain, each with its requirements, behavior, and the changes that shaped it. Whatever changed since your last visit is marked, so you can jump straight to what's new.
- **MCP Topology** — your local MCP servers around the Claude Code hub. Click **check** to passively probe one; DataLoom only reports what's reachable — it never starts a server.

### Plan proposal dependencies with Claude

The daemon also hosts an MCP server, so your own Claude session can order interdependent proposals for you. In any project, run **`/loom:weave`** — Claude reviews the open proposals, proposes which should come after which, and writes the order back once you confirm. The roadmap recomputes automatically.

---

How it's built: [ARCHITECTURE.md](ARCHITECTURE.md) · Security model: [SECURITY.md](SECURITY.md) · Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
