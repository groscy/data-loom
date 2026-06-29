## Context

The MCP server (`add-roadmap-mcp-server`, then `add-dependency-review`, then `add-weave-skill`) runs as a stdio process launched per project: `data-loom mcp <project>` → `runMcpServer(project)`, which closes over one `OpenSpecClient` and one `changesDir` for its whole lifetime. Registration bakes the project path into the launch command. The dashboard daemon, by contrast, has been multi-project since `self-contained-multi-project` (project selector, `discoverProjects`, `selectProject`, live re-scope). This change brings the MCP server up to the daemon's multi-project model so setup is once-per-machine.

## Goals / Non-Goals

**Goals:**
- One registration, at user scope, that works in every project.
- One running server process serving all projects (and concurrent sessions), with the target project resolved per call.
- Keep the credential-free, confirm-before-write model intact.
- Predictable writes: a tool call's target is never an implicit side effect of UI state unless the caller opts in.

**Non-Goals:**
- Making the dashboard's selected project a shared, authoritative cross-session "current project" for writes (it is only a *fallback default*).
- Auth/transport hardening beyond the existing loopback-only binding.
- A marketplace plugin; non-loopback / multi-host access.

## Decisions

### 1. Transport: Streamable-HTTP hosted by the daemon (not stdio)
"One server serving all projects" rules out stdio: a stdio MCP server is spawned by the client, is 1:1 with a session, and is frozen to one project at launch. A single long-lived process that serves every project and multiple concurrent sessions needs an HTTP transport. The daemon is already that long-lived loopback process (`startServer`, `127.0.0.1:4317`), so it hosts the MCP endpoint at `/mcp` using the installed SDK's `StreamableHTTPServerTransport` (`@modelcontextprotocol/sdk` 1.29.0). Streamable-HTTP, not SSE — SSE is the SDK's deprecated transport; `StreamableHTTPServerTransport` is the current one.
- *Alternative — keep stdio, register at user scope with no path, default to `process.cwd()`:* this is "one registration, N processes (spawn-per-session)", not "one server." Rejected per the chosen direction; it also depends on Claude Code spawning the server with cwd = project root.
- *Alternative — a separate standalone persistent MCP process:* that is just the daemon by another name; reuse the daemon.

### 2. Project resolution is per call, explicit-with-fallback (Option C)
Each read/write tool takes an optional `project` (absolute path). Resolution order: explicit `project` arg → daemon's current dashboard selection → error. The path is validated with `isViewableProject` before any read/write.
- *Why not implicit-only (dashboard selection):* two concurrent sessions in different projects would fight over one global "current," and switching a UI tab would silently change where writes land. Convenient in a demo, surprising in use.
- *Why not explicit-only:* a friendly interactive "weave what I'm looking at" is worth keeping; the fallback covers it without compromising the command path.
- **The `/loom:weave` command passes `project` explicitly** (resolves the session's working directory), so the automated path is deterministic and multi-session safe. The fallback is for ad-hoc human use only.

### 3. A `list_projects` discovery tool
Re-expose `discoverProjects` so the agent can enumerate valid openspec workspaces and confirm a path before writing, instead of guessing. Mirrors `/api/projects`.

### 4. The server no longer closes over one project
`runMcpServer` stops capturing a single `OpenSpecClient`/`changesDir`. Tool handlers build (or cache) a client per resolved project. The daemon injects two things into the MCP layer: a `getCurrentProject()` (the dashboard selection) and the same `isViewableProject`/`discoverProjects` it already uses — keeping one source of project truth.

### 5. weave requires a running daemon — fail clearly
Folding MCP into the daemon makes the daemon a prerequisite for weave (today's stdio server is self-contained). When DataLoom isn't running, the registration's endpoint is unreachable; the `/loom:weave` command must detect missing tools / connection failure and tell the user to start DataLoom, rather than surfacing a raw transport error. This is an acceptable, even clarifying, coupling: one process both shows and weaves the roadmap.

### 6. Cut the stdio entry point now
The `data-loom mcp <project>` CLI mode is removed in this change, not deprecated-then-removed. Rationale: it is a brand-new, single-user tool with no install base to protect, and carrying two transports through the same handlers for a release is maintenance and test surface for no real audience. A clean cut keeps one transport, one setup story, and one code path. Existing per-project registrations simply stop resolving and are replaced by the single user-scope HTTP registration.
- *Alternative — keep it one release for backward-compat:* rejected; there is no meaningful install base, and the dual-transport seam costs more than it saves.

## Risks / Trade-offs

- **New runtime dependency: the daemon must be up for weave.** → Mitigation: explicit "start DataLoom" guidance in the command and connect-time instructions; the daemon is already what the user runs to view the roadmap.
- **HTTP transport on loopback widens the surface vs stdio.** → Mitigation: bind stays `127.0.0.1` only; tools still carry only proposal text + change names (no-secrets requirement preserved); no auth added because scope is single-user loopback.
- **Default-to-dashboard-selection could still surprise.** → Mitigation: the command path always passes `project` explicitly; the fallback only triggers when no arg is given.
- **Concurrent writes to the same proposal from two sessions.** → Mitigation: writes are idempotent `## Depends On` edits (existing `addDependsOn`/`ensureDependsOnSection`), so concurrent identical edits converge; last-writer-wins on distinct edits is acceptable for a single-user local tool.
- **Migration friction:** users must re-register, and the stdio mode is cut. → Mitigation: README documents the one-time swap; the tool is new with no real install base, so the breakage is acceptable.

## Migration Plan

1. Ship the daemon-hosted `/mcp` endpoint (Streamable-HTTP) and per-call project resolution; remove the `data-loom mcp <project>` stdio entry point in the same change.
2. Update README + `install_weave_skill` guidance to the single user-scope HTTP registration.
3. Users remove their per-project `data-loom` registrations and add the single user-scope HTTP one; re-run `install_weave_skill` to refresh the command.

## Resolved Questions

- **Transport** — Streamable-HTTP via `StreamableHTTPServerTransport` at `/mcp` (SDK 1.29.0); SSE rejected as deprecated.
- **stdio entry point** — cut now (Decision 6), not kept for a release.
- **No project + no selection** — instructive error naming `list_projects`, not an empty list.
- **Auditability** — each write echoes the resolved absolute project path in its result.
