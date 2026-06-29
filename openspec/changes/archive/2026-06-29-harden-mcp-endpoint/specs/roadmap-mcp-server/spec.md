## ADDED Requirements

### Requirement: Bound concurrent MCP sessions
The server SHALL bound the number of concurrent MCP client sessions it retains and SHALL release sessions that have been idle beyond a configured period. It SHALL reject new session initialization once the bound is reached, and SHALL remove an evicted or closed session's retained state so that session churn does not grow memory without limit.

#### Scenario: Session bound enforced
- **WHEN** new MCP sessions are initialized past the configured concurrent-session bound
- **THEN** the server rejects the excess initializations rather than retaining unbounded sessions

#### Scenario: Idle session evicted
- **WHEN** a session has been idle beyond the configured period
- **THEN** the server releases it and removes its retained state

### Requirement: Client errors omit host filesystem detail
For unexpected or internal failures, the error the server returns to the client SHALL be generic and SHALL NOT include absolute host filesystem paths or stack traces; full detail SHALL be retained only in server-side logs. Expected validation errors that reference client-supplied input (such as an unknown change name or a path the caller named) MAY echo that input.

#### Scenario: Internal error returns generic message
- **WHEN** an unexpected internal failure occurs while handling a tool call
- **THEN** the client receives a generic error without absolute host paths or stack detail, and the full detail is recorded server-side
