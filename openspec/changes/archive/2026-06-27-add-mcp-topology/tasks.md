## 1. MCP discovery

- [x] 1.1 Add MCP model types (server entry: name, transport, scope, redacted command/url, liveness state, lastChecked)
- [x] 1.2 Read Claude Code config sources: `~/.claude.json` global `mcpServers`, `~/.claude.json` `projects[<repoRoot>].mcpServers`, and `~/.claude/.mcp.json` (tolerate both `{mcpServers:{}}` and bare-map shapes)
- [x] 1.3 Merge and de-duplicate by server name across scopes and path-variant project keys; retain scope (global vs project)
- [x] 1.4 Detect transport (command → stdio; url/type → http/sse) and produce a sanitized server list
- [x] 1.5 Redact secrets at the boundary: never include tokens, headers, or env values in the model

## 2. Passive availability

- [x] 2.1 URL check: single short-timeout HTTP request — any answer ⇒ available, 401/403 ⇒ needs-auth, refused/timeout ⇒ unreachable (never an MCP initialize, never a launch)
- [x] 2.2 stdio check: scan the OS process table for a process matching the server command/args ⇒ already-running, else on-demand; never spawn the server
- [x] 2.3 Per-server, on-demand checking with an in-memory cache and a lastChecked timestamp (no auto-probe-all)

## 3. Daemon endpoints

- [x] 3.1 `GET /api/mcp` returns the discovered servers with their cached liveness
- [x] 3.2 `POST /api/mcp/check` runs a passive check for one named server, returns the result, and broadcasts it over the existing websocket
- [x] 3.3 Wire MCP discovery + availability into the daemon startup alongside the roadmap

## 4. Topology view (HOW tab)

- [x] 4.1 Enable the second tab and switch views between Roadmap (WHAT) and MCP Topology (HOW)
- [x] 4.2 Render hub-and-spoke: Claude Code at center, servers on a ring, with server name and transport
- [x] 4.3 Encode scope via edge styling (global vs project) and liveness via node badge/color; show lastChecked
- [x] 4.4 Per-server "check" action calling `POST /api/mcp/check`; update the node on result. No start/launch affordance
- [x] 4.5 Reflect pushed availability updates live without a manual refresh

## 5. Verification

- [x] 5.1 Confirm `GET /api/mcp` lists this host's real servers (e.g. global `comfyui`) with correct scope and transport, and no secrets in the payload
- [x] 5.2 Check a stdio server ⇒ on-demand or already-running (verify nothing is spawned); check an unreachable URL ⇒ unreachable
- [x] 5.3 Confirm the topology renders with the hub centered and liveness visible, and that checks update nodes live
