## 1. Origin/Host request guard (daemon)

- [x] 1.1 Build a loopback allowlist from the bound host + actual port (`{127.0.0.1, localhost, [::1]} × port`); pass the bound port into `startServer` rather than hardcoding 4317
- [x] 1.2 Add a guard run on every HTTP request (`/mcp`, `/api/*`, static): reject when `Host` is not in the allowlist (DNS rebinding) or when an `Origin` header is present and not in the allowlist (CSRF); allow requests with no `Origin`
- [x] 1.3 Apply the same guard to the WebSocket upgrade (`ws` `verifyClient` / `handleUpgrade`), so a hostile page cannot open a socket to the daemon
- [x] 1.4 Return `403` for rejected requests with a generic message

## 2. DoS bounds (daemon)

- [x] 2.1 Cap the request body in `readJsonBody` at 4 MB (`4 * 1024 * 1024`); destroy/reject the request when exceeded instead of accumulating
- [x] 2.2 Bound `mcpTransports`: cap at 32 concurrent sessions and reject new `initialize` past the cap; evict sessions idle beyond a 30-minute TTL (closing their transport/server and removing the map entry)

## 3. Error hygiene + asset containment (daemon)

- [x] 3.1 Make internal/unexpected 500s generic (no absolute paths, no stack); log full detail server-side only. In `mcpServer.ts`, keep tool-error messages free of unexpected host detail (validation errors echoing client-supplied input are fine)
- [x] 3.2 Replace the `rel.includes("..")` asset check with path normalization + containment assertion within `publicDir`

## 4. Docs

- [x] 4.1 README/security note: the endpoint is loopback + Host/Origin validated and holds no secrets; note that the MCP tools act on any OpenSpec workspace path by design (provider-independence) and the residual local-process risk

## 5. Verification

- [x] 5.1 Host validation: a POST to `/mcp` with `Host: evil.com` (other headers valid) is rejected `403`; a request with `Host: 127.0.0.1:<port>` passes
- [x] 5.2 Origin validation: a request with `Origin: https://evil.com` is rejected on `/mcp`, `/api/project/select`, and the WS upgrade; a request with no `Origin` (native client) succeeds; `Origin: http://127.0.0.1:<port>` succeeds
- [x] 5.3 CSRF on `/api/project/select` with a foreign `Origin` is rejected (project not switched)
- [x] 5.4 Body cap: a `/mcp` POST larger than 4 MB is rejected without unbounded memory growth
- [x] 5.5 Session cap/TTL: exceeding 32 sessions is rejected; an idle session is evicted after the TTL and its map entry removed
- [x] 5.6 Error hygiene: a forced internal error returns a generic client message while the server log retains detail
- [x] 5.7 Regression: the v0.4.0 happy paths still pass (tools/list, per-call project read/write for any valid workspace, no-arg fallback to selection, daemon-down behavior)
