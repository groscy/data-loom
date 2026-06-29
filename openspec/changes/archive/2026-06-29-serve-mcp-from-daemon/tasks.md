## 1. Daemon HTTP MCP endpoint

- [x] 1.1 Add a `StreamableHTTPServerTransport` to the daemon: mount a `/mcp` route on the existing `createServer` in `src/server.ts`, bound to the same `127.0.0.1` loopback, reusing the SDK `Server` from `src/mcpServer.ts`
- [x] 1.2 Inject daemon project context into the MCP layer: pass `getCurrentProject()` (the dashboard selection from `index.ts`) and the existing `discoverProjects`/`isViewableProject` into the MCP server factory, so there is one source of project truth
- [x] 1.3 Remove the `data-loom mcp <project>` stdio entry point (the `process.argv[2] === "mcp"` branch in `src/index.ts` and the stdio-only wiring in `runMcpServer`); the daemon HTTP endpoint is the only transport

## 2. Per-call project resolution

- [x] 2.1 Stop closing over a single `OpenSpecClient`/`changesDir` in `runMcpServer`; build (or cache) a client per resolved project
- [x] 2.2 Add an optional `project` (absolute path) argument to `list_open_proposals`, `set_dependency`, and `mark_independent`; resolution order = explicit arg → dashboard selection → instructive error
- [x] 2.3 Validate the resolved path with `isViewableProject` before any read or write; reject with a clear error naming `list_projects` when it is not an openspec workspace
- [x] 2.4 Echo the resolved absolute project path in each tool result for auditability
- [x] 2.5 Add a `list_projects` tool that returns `discoverProjects` (valid openspec workspaces + the current selection), read-only

## 3. weave command + connect instructions

- [x] 3.1 Update the embedded `WEAVE_COMMAND` to resolve the session's working directory and pass it as `project` to every tool call (deterministic, multi-session safe)
- [x] 3.2 Make the command detect a missing/unreachable server (tools absent or connection failure) and tell the user to start DataLoom and register the user-scope HTTP server, then stop
- [x] 3.3 Update `INSTRUCTIONS` and `install_weave_skill`'s guidance to reference the single `claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp` registration

## 4. Docs

- [x] 4.1 README: replace the per-project stdio registration with the one-time user-scope HTTP registration; document that the daemon must be running for `/loom:weave`; note the migration (remove old per-project registrations)

## 5. Verification

- [x] 5.1 With the daemon running, register the user-scope HTTP server; confirm `tools/list` over HTTP returns `list_open_proposals`, `set_dependency`, `mark_independent`, `list_projects`, `install_weave_skill`
- [x] 5.2 Call `list_open_proposals` with an explicit `project` for two different projects in one session; confirm each returns that project's open changes and no cross-contamination
- [x] 5.3 Call a read tool with no `project`; confirm it falls back to the dashboard's current selection, and that switching the selection changes the fallback target
- [x] 5.4 Call a write tool (`set_dependency`) with an explicit `project`; confirm the `## Depends On` edit lands in that project's proposal and the result echoes the resolved path
- [x] 5.5 Call a tool with a `project` that is not an openspec workspace; confirm it is rejected with the instructive error and writes nothing
- [x] 5.6 Stop the daemon and run `/loom:weave`; confirm the command reports the daemon is down with start guidance rather than a raw transport error
- [x] 5.7 Confirm tools still carry only proposal text + change names over HTTP (no config, env, or secrets) — no-secrets guarantee preserved
- [x] 5.8 Confirm the `data-loom mcp <project>` stdio entry point is gone (the CLI no longer accepts the `mcp` subcommand) and no stdio transport remains
