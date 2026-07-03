## MODIFIED Requirements

### Requirement: Enable login autostart
The `data-loom` CLI SHALL provide an `autostart enable` command that registers the background daemon to launch automatically when the current user logs in to the operating system. The registration SHALL start the daemon in detached background mode (never a foreground/blocking form) and SHALL be per-user, requiring no administrator/root privilege. Enabling SHALL be idempotent: running it again when already enabled SHALL leave a single valid registration rather than creating duplicates.

Enabling SHALL also register DataLoom with Claude Code (equivalent to `connect claude-code`) so the always-on path both hosts the MCP endpoint and points the client at it. This client-registration step SHALL be best-effort: if it cannot complete (for example, the `claude` CLI is unavailable), `enable` SHALL warn and continue, and the login-item registration and daemon start SHALL still succeed. A `--no-connect` flag SHALL skip the client-registration step, paralleling the existing `--no-start` opt-out.

#### Scenario: Enable registers a login item
- **WHEN** the user runs `data-loom autostart enable`
- **THEN** a per-user login item is created that starts the DataLoom daemon in background mode on next login

#### Scenario: Enable is idempotent
- **WHEN** the user runs `data-loom autostart enable` while autostart is already enabled
- **THEN** exactly one valid registration remains and the command reports it is enabled

#### Scenario: Daemon launches on login
- **WHEN** autostart is enabled and the user logs in to the OS
- **THEN** the DataLoom daemon is started in the background without manual action, serving its loopback dashboard and MCP endpoint

#### Scenario: Enable also registers Claude Code
- **WHEN** the user runs `data-loom autostart enable` and the `claude` CLI is available
- **THEN** DataLoom is registered with Claude Code at user scope in addition to the login item being created and the daemon being started

#### Scenario: Enable continues when Claude Code registration cannot complete
- **WHEN** the user runs `data-loom autostart enable` and the client-registration step fails (for example, the `claude` CLI is not available)
- **THEN** the command warns about the client-registration step but still creates the login item and starts the daemon

#### Scenario: Opting out of client registration
- **WHEN** the user runs `data-loom autostart enable --no-connect`
- **THEN** the login item is created and the daemon is started, but DataLoom is not registered with Claude Code
