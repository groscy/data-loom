## Context

`serve-mcp-from-daemon` (v0.4.0) replaced the stdio MCP transport with a Streamable-HTTP endpoint hosted by the daemon. Security review found that the transport switch moved a trust boundary: a stdio server has no network surface, but an HTTP listener on `127.0.0.1` is reachable by the user's browser (any page, via `fetch`) and by other local processes. The endpoint — and the existing `/api/*` routes and WebSocket — have no Host, Origin, or auth checks, and the MCP tools are a filesystem read/write primitive scoped only by "the path contains `openspec/`."

## Goals / Non-Goals

**Goals:**
- Close the browser-reachable attack surface opened by the HTTP transport (DNS rebinding, CSRF) with the minimum that is actually sufficient for a single-user local tool.
- Reduce the MCP tools' filesystem blast radius to what the daemon already trusts.
- Make trivial local DoS (huge body, session spam) non-trivial.
- Keep registration zero-config (`claude mcp add … http://127.0.0.1:4317/mcp`, no headers/tokens).

**Non-Goals:**
- A bearer-token / auth scheme, TLS, or any multi-user / non-loopback access.
- CORS support for legitimate cross-origin browser clients (none exist; the only browser client is the same-origin SPA).

## Decisions

### 1. One guard, in our own middleware, covering everything
A single origin/host check runs for every HTTP request (`/mcp`, `/api/*`, static) and for the WebSocket upgrade — not just `/mcp`. Rationale: the CSRF on `/api/project/select` is real and interacts with the MCP no-arg write fallback, so partial coverage is a false sense of safety. We implement it ourselves rather than via the SDK's `allowedHosts`/`allowedOrigins`, which are off by default and now `@deprecated` in favour of external middleware.

### 2. Reject foreign Host (DNS rebinding) and foreign Origin (CSRF); allow no-Origin
- **Host**: must equal the bound loopback host:port. Allowlist = `{127.0.0.1, localhost, [::1]}` × the actual bound port (read from config/`PORT`, not hardcoded to 4317). A rebound attacker connects to `127.0.0.1` but sends `Host: attacker.com` → rejected.
- **Origin**: if present, must be in the same loopback allowlist; if **absent**, allow. Native MCP clients (Claude Code) send no browser `Origin`; browsers always attach `Origin` on cross-origin `fetch` and on POST. So "reject any non-loopback Origin, allow none" cleanly separates the SPA + native clients from hostile pages.

This pair is why both checks are needed: CORS preflight already blocks plain JS POSTs to `/mcp` (JSON content-type forces a preflight that fails with no CORS headers), so the residual `/mcp` risk is specifically DNS rebinding → Host check. The `/api` simple-POST CSRF has no preflight → Origin check.

### 3. Do NOT constrain `project` to a discovered/allow set
The MCP tools keep accepting any path that is a valid OpenSpec workspace (the v0.4.0 contract), rather than restricting `project` to Claude Code's known workspaces. Rationale: data-loom is intended to become **LLM-provider-independent**, and the "discovered set" is derived from Claude-Code-specific config (`~/.claude.json`). Hard-wiring the security boundary to that list would couple the trust model to one provider and would break the moment the tool is driven by a non-Claude client. The blast-radius reduction is deferred to a future, provider-neutral mechanism.
- *Consequence:* a fully-connected client — including a hostile *local process*, which sends a clean `Host` and no `Origin` and so passes the request guard — can read/write any OpenSpec workspace on the machine. Accepted residual for the single-user local threat model (see Risks).
- *Alternative — constrain to `discoverProjects` ∪ selection:* the biggest single blast-radius win, but provider-coupled; rejected for now, revisit alongside the provider-independence work and/or the deferred token.

### 4. Bound bodies and sessions
- **Body cap**: `readJsonBody` enforces a **4 MB** max (`4 * 1024 * 1024` — generous for JSON-RPC tool calls) and rejects beyond it instead of growing a string unboundedly.
- **Session cap + idle TTL**: bound the `mcpTransports` map to **32 concurrent sessions** and evict sessions **idle for 30 minutes**; reject new `initialize` past the cap and close evicted sessions' transport/server. Stops `initialize` spam and abandoned-session growth (each session also holds a `Server` instance). Values are constants, tunable later.

### 5. Generic client errors; detail to logs
Unexpected/internal errors returned to clients are generic (no absolute paths, no stack). Expected validation errors that reference client-supplied input (e.g. "X is not a known project") are unchanged — they reveal nothing the caller didn't provide. The resolved-project echo for auditability stays (it is the path the client supplied or the selection it can already see).

### 6. Static asset containment
Normalize the requested path and assert the resolved file is within `public/`, replacing the naive `rel.includes("..")` check. Pre-existing and low-severity (the URL pathname is not percent-decoded, so encoded traversal already fails), included as cheap hardening while we are here.

## Risks / Trade-offs

- **Origin guard could block a legitimate non-standard client.** → Loopback Origins are allowed and no-Origin is allowed, which covers the SPA and native MCP clients; anything else is hostile by assumption for a local tool.
- **Caps could reject legitimate load.** → Sized generously (4 MB / 32 sessions / 30 min); single-user tool. Values are tunable constants.
- **Guards-only + no `project` allow-list leaves a hostile *local process* able to drive the tools against any OpenSpec workspace on the machine** (it sends a clean Host and no Origin, so the request guard cannot distinguish it; Decision 3 leaves `project` unrestricted). → Accepted residual for the single-user local model — the request guard still blocks all browser vectors, and a real local-process adversary running as the user already has broad access. Revisit with provider-neutral project scoping and/or a token if a multi-user/shared-host story emerges.

## Open Questions

- **Origin-guard opt-out**: do we need an env escape hatch for users fronting the daemon with a reverse proxy? Leaning no (non-goal: non-loopback access).
- **Provider-neutral project scoping (future)**: once data-loom supports non-Claude clients, what becomes the trust boundary for `project` (Decision 3 deferred it)? Candidates: an explicit user-maintained allow-list, or a per-session token that authorizes specific roots.
