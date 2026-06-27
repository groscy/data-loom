## ADDED Requirements

### Requirement: Mirror, never launcher
The availability checking SHALL NOT spawn, start, or otherwise launch any MCP server or backing application under any circumstances. It only observes existing state; starting applications is the user's responsibility.

#### Scenario: No process is started by a check
- **WHEN** availability is checked for any server, of any transport
- **THEN** no new MCP server process or backing application is started as a result

### Requirement: URL server availability by connection
For URL-based servers (http / sse / streamable-http), the checking SHALL determine availability by connecting to the already-listening endpoint and observing whether it answers, without launching anything.

#### Scenario: Reachable endpoint reports available
- **WHEN** a URL server's endpoint is listening and answers a connection
- **THEN** the server is reported available

#### Scenario: Unreachable endpoint reports unreachable
- **WHEN** a URL server's endpoint does not answer
- **THEN** the server is reported unreachable

### Requirement: stdio server on-demand state
For stdio servers, because nothing is listening until the IDE spawns them, the checking SHALL report an "on-demand" state and SHALL additionally report "already-running" only when a process matching the server's command is found in the OS process table. It SHALL never spawn the server to determine this.

#### Scenario: Idle stdio server is on-demand
- **WHEN** a stdio server has no matching process running
- **THEN** it is reported as on-demand (not unreachable, not started)

#### Scenario: Running stdio server detected passively
- **WHEN** a process matching a stdio server's command is present in the OS process table
- **THEN** the server is reported as already-running, without any spawn

### Requirement: On-demand checking with cached result
Availability SHALL be checked on demand per server rather than by auto-probing all servers, and each result SHALL be cached with a last-checked timestamp so prior state remains visible between checks.

#### Scenario: Check is per-server and timestamped
- **WHEN** the user requests an availability check for a server
- **THEN** only that server is checked and its result is stored with a last-checked timestamp
