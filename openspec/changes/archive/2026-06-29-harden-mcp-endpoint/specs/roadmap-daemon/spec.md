## ADDED Requirements

### Requirement: Validate request Host and Origin
The daemon SHALL validate the `Host` and `Origin` headers on every HTTP request it serves (including the MCP endpoint, the `/api/*` routes, and static assets) and on every WebSocket upgrade. It SHALL reject a request whose `Host` is not the bound loopback host and port, and SHALL reject a request that carries an `Origin` header whose value is not an allowed loopback origin. A request with no `Origin` header SHALL be allowed (native, non-browser clients). The allowed values SHALL be derived from the actually-bound port, not a fixed constant. Rejected requests SHALL receive a generic forbidden response.

#### Scenario: Rebound Host rejected
- **WHEN** a request arrives whose `Host` header is not the bound loopback host:port (e.g. an attacker domain rebound to the loopback address)
- **THEN** the daemon rejects it with a forbidden response and performs no action

#### Scenario: Foreign Origin rejected
- **WHEN** a request (HTTP or WebSocket upgrade) carries an `Origin` header that is not an allowed loopback origin
- **THEN** the daemon rejects it and does not change state, serve MCP tools, or open the socket

#### Scenario: Native client with no Origin allowed
- **WHEN** a request arrives with a valid loopback `Host` and no `Origin` header
- **THEN** the daemon serves it normally

#### Scenario: Same-origin SPA allowed
- **WHEN** the served SPA makes a request with a loopback `Host` and a loopback `Origin`
- **THEN** the daemon serves it normally

### Requirement: Bound request body size
The daemon SHALL enforce a maximum size on request bodies it reads and SHALL reject a request whose body exceeds that maximum rather than accumulating it without limit.

#### Scenario: Oversized body rejected
- **WHEN** a request body exceeds the configured maximum size
- **THEN** the daemon stops reading it and rejects the request without unbounded memory growth

### Requirement: Contain static asset paths
The daemon SHALL serve static assets only from within its public asset directory. It SHALL resolve the requested path and SHALL refuse any request that would resolve outside that directory.

#### Scenario: Traversal outside the asset root refused
- **WHEN** a static-asset request resolves to a path outside the public asset directory
- **THEN** the daemon refuses it rather than reading the file
