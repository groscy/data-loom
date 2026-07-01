## ADDED Requirements

### Requirement: Enable login autostart
The `data-loom` CLI SHALL provide an `autostart enable` command that registers the background daemon to launch automatically when the current user logs in to the operating system. The registration SHALL start the daemon in detached background mode (never a foreground/blocking form) and SHALL be per-user, requiring no administrator/root privilege. Enabling SHALL be idempotent: running it again when already enabled SHALL leave a single valid registration rather than creating duplicates.

#### Scenario: Enable registers a login item
- **WHEN** the user runs `data-loom autostart enable`
- **THEN** a per-user login item is created that starts the DataLoom daemon in background mode on next login

#### Scenario: Enable is idempotent
- **WHEN** the user runs `data-loom autostart enable` while autostart is already enabled
- **THEN** exactly one valid registration remains and the command reports it is enabled

#### Scenario: Daemon launches on login
- **WHEN** autostart is enabled and the user logs in to the OS
- **THEN** the DataLoom daemon is started in the background without manual action, serving its loopback dashboard and MCP endpoint

### Requirement: Disable login autostart
The CLI SHALL provide an `autostart disable` command that removes the login-item registration created by `enable`. Disabling SHALL be idempotent: disabling when not enabled SHALL succeed without error. Disabling SHALL NOT stop an already-running daemon (that is `stop`'s job); it SHALL only prevent future automatic launches.

#### Scenario: Disable removes the login item
- **WHEN** autostart is enabled and the user runs `data-loom autostart disable`
- **THEN** the login-item registration is removed and the daemon no longer launches automatically on next login

#### Scenario: Disable when not enabled
- **WHEN** autostart is not enabled and the user runs `data-loom autostart disable`
- **THEN** the command succeeds and reports that autostart was not enabled

### Requirement: Report autostart status
The CLI SHALL provide an `autostart status` command that reports whether login autostart is currently enabled for the user.

#### Scenario: Status reflects enabled state
- **WHEN** autostart is enabled and the user runs `data-loom autostart status`
- **THEN** it reports that autostart is enabled

#### Scenario: Status reflects disabled state
- **WHEN** autostart is not enabled and the user runs `data-loom autostart status`
- **THEN** it reports that autostart is not enabled

### Requirement: Per-OS registration mechanism
The autostart registration SHALL use the native per-user login mechanism appropriate to the host OS — a Startup-folder entry on Windows (the primary target), a LaunchAgent on macOS, and an XDG autostart entry on Linux. On an unsupported platform the command SHALL fail with a clear message rather than creating an invalid registration.

#### Scenario: Windows registration
- **WHEN** `autostart enable` runs on Windows
- **THEN** it creates a per-user Startup entry that launches the background daemon on login

#### Scenario: Unsupported platform
- **WHEN** `autostart enable` runs on a platform with no supported mechanism
- **THEN** it fails with a clear message and creates no registration
