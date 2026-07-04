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

## Run it always-on (background + autostart)

The command above runs in the foreground and stops when you close the terminal. Since the daemon also hosts the MCP endpoint, you usually want it always running. Manage a detached background daemon with:

```
data-loom start [C:\path\to\project]   # launch detached; returns immediately
data-loom status                       # is it running? where are the logs?
data-loom stop                         # stop the background daemon
data-loom restart [path]               # stop then start
```

There is at most one instance: `start` while one is already running is a no-op that just reports it. Background output goes to a log file (path shown by `status`) since there's no attached console — on Windows, `%LOCALAPPDATA%\data-loom\daemon.log` (macOS `~/Library/Application Support/data-loom/`, Linux `${XDG_STATE_HOME:-~/.local/state}/data-loom/`).

To have it launch automatically when you log in — and restart itself if it ever crashes:

```
data-loom autostart enable    # register a per-user login item AND start it now
data-loom autostart status    # is autostart registered?
data-loom autostart disable   # remove the login item (does not stop a running daemon)
```

`enable` also starts the daemon immediately **and registers DataLoom with Claude Code** (the same as `data-loom connect claude-code`), so the always-on path both hosts the MCP endpoint and points Claude Code at it in one command. Pass `--no-start` to only register for next login, or `--no-connect` to skip the Claude Code registration. The Claude Code step is best-effort — if the `claude` CLI isn't found, `enable` warns and still sets up the login item and daemon.

The login item is per-user and needs no admin rights, and it **supervises** the daemon so a crash restarts it automatically (a deliberate `data-loom stop` stays stopped) — a per-user Scheduled Task on Windows, a LaunchAgent with `KeepAlive` on macOS, a systemd user unit with `Restart=on-failure` on Linux. `data-loom status` reports which mechanism is registered and whether it's supervised. If the supervising mechanism can't be created on your host (e.g. Task Scheduler unavailable, no systemd user session), `enable` falls back to a plain login-item shortcut and tells you supervision isn't available — autostart still works, it just won't self-heal from a crash.

**Upgrading from an earlier version?** Re-running `data-loom autostart enable` migrates an existing plain login item to the supervised form automatically — no separate migration step. Or use the single command below, which upgrades and re-registers in one step:

```
data-loom update   # upgrade the global install, restart a running daemon, refresh autostart
```

`update` upgrades the globally-installed package, restarts the daemon if one is running, and rewrites the autostart registration (including migrating to the supervised form) if autostart is enabled — reporting each step. It only works for a global npm install; if you run DataLoom via `npx`, it tells you so instead of guessing.

Everything is reversible: `data-loom stop`, `data-loom autostart disable`, `data-loom disconnect claude-code`, and `data-loom disconnect claude-desktop` (below) undo each side effect, and each is idempotent.

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

The running daemon also **hosts an MCP server** over HTTP, so your own Claude session determines and applies the order of interdependent proposals — DataLoom holds no API key and the reasoning runs under your authenticated Claude. One registration serves **every** project; the target project is resolved per call (an explicit `project` argument, falling back to whatever the dashboard has selected).

1. Register it once, globally — no per-project setup. The easy way:

   ```
   data-loom connect claude-code
   ```

   This registers DataLoom's loopback endpoint with Claude Code at user scope via Claude Code's own CLI (it runs `claude mcp add` for you; DataLoom never edits `~/.claude.json` itself) **and** provisions the `/loom:weave` command (see step 3) — one command, one reload, both the tools and `/loom:weave` are available. Remove both any time with `data-loom disconnect claude-code`. If the `claude` CLI isn't on your PATH, the command prints the manual line to run instead:

   ```
   claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp
   ```

   Either way, if you enable always-on autostart (below), `data-loom autostart enable` already runs this registration for you — so a fresh install can be one command.

   The MCP server lives in the daemon, so **DataLoom must be running** for the tools to be reachable (start it with `data-loom start` or `npx @lyric_dev/data-loom "C:\path\to\your\project"`). It binds to loopback only.

   **Prefer not to think about starting DataLoom at all?** Register the on-demand form instead:

   ```
   data-loom connect claude-code --on-demand
   ```

   This registers a stdio server that runs `data-loom mcp-shim` instead of pointing at the HTTP endpoint directly. Claude Code spawns that shim per session; it starts the daemon itself (through the same detached path as `data-loom start`) if it isn't already running, waits for it to come up, then transparently forwards MCP traffic to it — the shim adds no tools of its own, it just gets the real daemon running. Pick this when you don't run `autostart enable` and don't want to remember to `data-loom start` first; keep the default HTTP form when you're already running the dashboard always-on, since it's one less process per session. Only one form is ever registered — switching re-runs the same command with `--on-demand` (or without it, to switch back), and it reports the switch. `data-loom disconnect claude-code` removes whichever form is present.

   **Claude Desktop** reaches the same daemon — register it with:

   ```
   data-loom connect claude-desktop
   ```

   This adds a `data-loom` entry to Claude Desktop's `claude_desktop_config.json` (additively — your other servers are untouched), pointing at the same loopback endpoint via Claude Desktop's native remote-MCP support. Restart Claude Desktop to pick it up. On older Claude Desktop versions without native remote support, pass `--bridge` to register a stdio↔HTTP bridge (`npx mcp-remote`) instead. Remove it any time with `data-loom disconnect claude-desktop`. As with Claude Code, the daemon must be running for the tools to appear.

2. In any project, ask Claude something like *"review DataLoom's open proposals and set the dependencies."* On connect, the server asks Claude to surface any proposal that hasn't been reviewed for dependencies yet, propose the edges, and **confirm with you before writing**. It exposes these tools:
   - `list_projects` — the selectable OpenSpec workspaces plus the current selection (read-only), to discover/confirm a `project` path.
   - `list_open_proposals(project?)` — the open changes with their proposal text, current phase/readiness, and dependency-review state (read-only; proposal text only, no secrets).
   - `set_dependency(from, to, project?)` — writes a `## Depends On` entry into a proposal.
   - `mark_independent(change, project?)` — records that a proposal genuinely depends on nothing, by writing an empty `## Depends On` block.
   - `install_weave_skill` — fallback installer for the `/loom:weave` command (see below); unnecessary if you registered with `connect claude-code`, which already provisions it.

   Each write is an explicit, reviewable `## Depends On` edit; the roadmap then recomputes deterministically. Proposals that still need a dependency decision are flagged in the roadmap with a **"needs review"** badge, and DataLoom appears as a server in its own MCP Topology tab once registered.

3. **One command for it all: `/loom:weave`.** The whole review workflow — list, propose, confirm, apply — is served by the daemon itself as an MCP prompt named `weave`, so it always matches the running version. `data-loom connect claude-code` provisions a thin `/loom:weave` alias for it automatically (no separate install step); from then on, `/loom:weave` in any project fetches and runs the workflow, passing that project explicitly. If you registered another way, ask Claude to *"install the weave skill"* (it calls `install_weave_skill`) to add the alias yourself, then reload. (The alias needs the daemon running and registered; if unreachable it tells you to run `data-loom status` / `data-loom start` / `data-loom connect claude-code`.) Other MCP clients that support the prompts capability — e.g. Claude Desktop's prompt picker — can invoke the `weave` prompt directly, with no alias needed.

> **Upgrading from an earlier version?** The MCP server used to be a per-project stdio registration (`claude mcp add data-loom -- npx … mcp "<path>"`). That mode is gone. Remove any old per-project `data-loom` registrations and add the single user-scope HTTP one above.

## Security

DataLoom runs entirely on `127.0.0.1` and is built for a single local user.

- **Loopback only** — the daemon (dashboard, WebSocket, and MCP endpoint) binds to the loopback interface and is never exposed to the network.
- **Host + Origin validated** — every HTTP request and WebSocket upgrade is checked: requests with a non-loopback `Host` (DNS-rebinding) or a non-loopback `Origin` (cross-site requests from a web page) are rejected. Native MCP clients (which send no `Origin`) are allowed. This is what keeps a random website you visit from driving the daemon.
- **No secrets** — the MCP tools carry only proposal text and change names; the topology view redacts server commands/args and shows scheme+host only. No API keys or config are read or returned, and the daemon holds no credential.
- **Bounded** — request bodies are capped (4 MB) and MCP sessions are capped and idle-evicted, so a local client can't exhaust memory.

The MCP tools can read and write any OpenSpec workspace path you point them at (this is intentional, so the tool can stay LLM-provider-independent). That means: treat the daemon as you would any local dev server — fine for your own machine, not something to run on a shared/multi-user host.

## Design principles

- **Derived, not stored** — phase/order is a pure function of the OpenSpec files, recomputed on every change. Nothing about ordering is persisted.
- **Mechanical dependencies** — an edge is "change B modifies a capability that change A introduces"; no NLP, no guessing.
- **Mirror, never launcher** — MCP liveness is observed passively (connect to listening URLs; scan the process table for stdio servers). The dashboard never spawns anything.
- **openspec stays external** — data-loom ships the app, but not openspec; it invokes your installed `openspec` CLI.

## Built with itself

DataLoom was specified and built with OpenSpec; its own `openspec/` workspace is in this repo, and early in development the dashboard rendered its own build plan.
