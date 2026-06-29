## Why

v0.4.0 moved the MCP server from a stdio process (no network surface — only the spawning client could talk to it) to an HTTP listener on `127.0.0.1:4317`. Loopback binding keeps *remote* attackers out, but it does not keep out the two actors that can now reach the daemon: **JavaScript in any web page the user visits**, and **other local processes**. The endpoint has no Host check, no Origin check, and no auth — and the MCP tools are a filesystem read/write primitive (`list_open_proposals(project)` reads proposal text from any OpenSpec workspace on disk; `set_dependency`/`mark_independent` write into them, with `project` gated only by "does `<path>/openspec` exist").

Concretely:
- **DNS rebinding** against `/mcp` (an attacker domain rebound to `127.0.0.1`) becomes same-origin, sidesteps CORS, and yields cross-origin **read and write** of proposals across the machine.
- **CSRF** against `/api/project/select` (a no-preflight "simple" POST) lets a visited page flip the daemon's selected project — which is the fallback write target for no-arg MCP calls.
- No request-body cap and no session cap make trivial local **DoS** (memory exhaustion via a large body or `initialize` spam).

The existing posture is otherwise good and is preserved: loopback-only bind, secret redaction in discovery (`ProbeTarget` stays server-side, the topology model is secret-free), and write-target validation by change name. This change closes the network-surface gap that the transport switch opened.

## What Changes

- **One request guard across the whole HTTP server + WebSocket upgrade** (`/mcp`, `/api/*`, `ws://`), implemented in the daemon's own handler (the SDK's `allowedHosts`/`allowedOrigins` are off by default and now `@deprecated` in favour of external middleware):
  - **Host validation** — reject any request whose `Host` is not the bound loopback host:port (`127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`). Defeats DNS rebinding.
  - **Origin validation** — reject any request that carries an `Origin` header not in that same loopback allowlist. Requests with **no** `Origin` (native MCP clients like Claude Code) are allowed. Defeats browser CSRF.
- **Bounded request bodies** — cap the `/mcp` body size and reject oversized payloads instead of accumulating unboundedly.
- **Bounded MCP sessions** — cap concurrent sessions (32) and evict idle ones (30-min TTL), so `initialize` spam / abandoned sessions can't grow memory without limit.
- **Error hygiene** — internal/unexpected errors returned to clients are generic; absolute host paths and stack detail stay in server logs. (Validation errors that echo client-supplied input are unchanged.)
- **Static asset path containment** — normalize the requested path and assert it stays within `public/` (hardening a pre-existing naive `..` check).

Non-goals (deliberately deferred): a bearer-token / auth scheme on the endpoint (loopback + Host + Origin is judged sufficient for a single-user local tool, and keeps `claude mcp add … http://127.0.0.1:4317/mcp` zero-config); **constraining `project` to an allow-list / discovered set** — that set is Claude-Code-specific (`~/.claude.json`) and data-loom is intended to become LLM-provider-independent, so coupling the trust boundary to one provider is rejected for now (deferred to a provider-neutral mechanism); TLS; multi-user / non-loopback access; CORS support for legitimate cross-origin browser clients (there are none).

## Capabilities

### New Capabilities

_None._ (Hardens existing capabilities.)

### Modified Capabilities

- `roadmap-daemon`: the HTTP/WS server gains Host + Origin validation on every request and the WebSocket upgrade, a request-body size cap, and static-asset path containment.
- `roadmap-mcp-server`: concurrent MCP sessions are bounded with idle eviction; client-facing errors omit host filesystem detail. (Per-call `project` resolution is intentionally left unconstrained — see non-goals.)

## Impact

- **Code**: `src/server.ts` (origin/host guard for the HTTP handler + `ws` `verifyClient`/upgrade; body-size cap in `readJsonBody`; session cap + idle TTL on `mcpTransports`; generic 500s; asset containment); `src/mcpServer.ts` (keep error messages free of unexpected host detail); possibly `src/index.ts` (pass the bound host:port allowlist into the server).
- **No behavioural change to `project` acceptance** — the v0.4.0 arbitrary-workspace contract is preserved by design (provider-independence). The residual risk is documented in the design.
- **No new dependencies.** No change to the registration command or the published transport.
