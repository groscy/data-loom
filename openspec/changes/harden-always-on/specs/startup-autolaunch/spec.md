## MODIFIED Requirements

### Requirement: Per-OS registration mechanism
The autostart registration SHALL use the native per-user mechanism appropriate to the host OS that supports supervising the launched daemon — a Scheduled Task with a logon trigger and restart-on-failure on Windows (the primary target), a LaunchAgent with crash-only KeepAlive on macOS, and a systemd user unit with restart-on-failure on Linux. On Linux hosts where systemd user services are unavailable, the registration SHALL fall back to an XDG autostart entry and report that supervision is not available. On an unsupported platform the command SHALL fail with a clear message rather than creating an invalid registration. The supervised registration SHALL run the daemon as a process the supervisor owns directly (not via a launcher that exits), with the browser suppressed and output directed to the background log.

#### Scenario: Windows registration
- **WHEN** `autostart enable` runs on Windows
- **THEN** it creates a per-user Scheduled Task, requiring no elevation, that launches the daemon on logon and restarts it on failure

#### Scenario: Windows fallback when task creation fails
- **WHEN** `autostart enable` runs on Windows and the Scheduled Task cannot be created
- **THEN** it falls back to a Startup-folder registration and reports that autostart is enabled without supervision

#### Scenario: Linux fallback without systemd
- **WHEN** `autostart enable` runs on Linux and systemd user services are unavailable
- **THEN** it registers an XDG autostart entry and reports that supervision is not available on this host

#### Scenario: Unsupported platform
- **WHEN** `autostart enable` runs on a platform with no supported mechanism
- **THEN** it fails with a clear message and creates no registration

## ADDED Requirements

### Requirement: Automatic restart after failure
When autostart is enabled on a platform with a supervising mechanism, the daemon SHALL be restarted automatically by the OS supervisor after it exits due to a failure (crash, kill, non-zero exit). Restarts SHALL be bounded (a limited count or throttled interval) so a persistently failing daemon does not restart-spin. A deliberate, clean stop SHALL NOT be restarted: `data-loom stop` (and the tray's Stop action) SHALL result in an exit the supervisor treats as successful, and the daemon SHALL remain stopped until the user starts it again or logs in anew.

#### Scenario: Crashed daemon is restarted
- **WHEN** autostart is enabled with supervision and the daemon process terminates abnormally
- **THEN** the OS supervisor starts a new daemon instance without user action, and the dashboard and MCP endpoint become reachable again

#### Scenario: Clean stop stays stopped
- **WHEN** autostart is enabled with supervision and the user runs `data-loom stop`
- **THEN** the daemon exits cleanly and is not restarted by the supervisor

#### Scenario: Restart is bounded
- **WHEN** the daemon fails repeatedly in a short window
- **THEN** the supervisor stops retrying after its bounded restart policy rather than restarting indefinitely

### Requirement: Stable launch target
The autostart registration SHALL NOT pin the absolute paths of the current Node binary and package script. It SHALL invoke a stable launcher (a small script in the DataLoom state directory) that resolves the `data-loom` command at launch time, falling back to paths recorded when the registration was written. Enabling autostart and running `data-loom update` SHALL (re)write this launcher, so Node version-manager switches and npm package relocations do not break autostart.

#### Scenario: Registration survives a package relocation
- **WHEN** autostart is enabled and the installed package's on-disk location changes (for example after an npm upgrade)
- **THEN** the next login launch still starts the daemon successfully via the launcher's PATH resolution

#### Scenario: Launcher is refreshed on enable
- **WHEN** the user runs `data-loom autostart enable`
- **THEN** the launcher script in the state directory is written with the current resolution and fallback paths

### Requirement: Legacy registration migration
Enabling autostart SHALL replace any legacy, non-supervised registration for the current user (Startup-folder shortcut on Windows, KeepAlive-less LaunchAgent on macOS, XDG entry on a systemd-capable Linux host) with the supervised form, leaving exactly one active registration. Disabling autostart SHALL remove both the supervised and any legacy registration.

#### Scenario: Enable upgrades a legacy registration
- **WHEN** a legacy Startup-folder shortcut exists and the user runs `data-loom autostart enable` on Windows
- **THEN** the shortcut is removed, the supervised Scheduled Task is created, and exactly one registration remains

#### Scenario: Disable removes all generations
- **WHEN** the user runs `data-loom autostart disable` on a host that has a legacy registration, a supervised registration, or both
- **THEN** no DataLoom autostart registration of either form remains
