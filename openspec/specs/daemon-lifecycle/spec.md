# daemon-lifecycle Specification

## Purpose
TBD - created by archiving change mcp-autostart-claude-desktop. Update Purpose after archive.
## Requirements
### Requirement: Detached background run mode
The `data-loom` CLI SHALL support starting the daemon detached from the invoking terminal so that it keeps running after the terminal closes. In this mode the daemon SHALL NOT open the browser automatically and SHALL redirect its output to a log file, since no console is attached. The existing foreground invocation (`data-loom [project-path]`) SHALL remain unchanged and continue to run attached and open the browser.

#### Scenario: Start detaches from the terminal
- **WHEN** the user runs the background start command in a terminal and then closes that terminal
- **THEN** the daemon continues running and its dashboard/MCP endpoint remain reachable on the loopback port

#### Scenario: Foreground mode is preserved
- **WHEN** the user runs `data-loom` with only a project path (no lifecycle subcommand)
- **THEN** it runs attached in the foreground exactly as before, opening the browser on launch

### Requirement: Single-instance guard
The daemon SHALL ensure at most one background instance runs at a time on the loopback port. When a start is requested while an instance is already running, it SHALL detect this and report the already-running instance rather than starting a second one or crashing on a port bind conflict.

#### Scenario: Second start is a no-op with notice
- **WHEN** the user requests a background start while a DataLoom daemon is already running
- **THEN** no second instance is started and the command reports that DataLoom is already running

#### Scenario: Stale instance record is recovered
- **WHEN** a previous daemon exited without cleaning up its instance record and the user requests a start
- **THEN** the CLI treats the port as free (no live instance answers) and starts a new daemon

### Requirement: Lifecycle subcommands
The `data-loom` CLI SHALL provide `start`, `stop`, `restart`, and `status` subcommands to control the background daemon. `start` SHALL accept an optional project-path argument like the foreground form. `stop` SHALL terminate the running background daemon. `restart` SHALL stop any running instance and start a new one. `status` SHALL report whether a daemon is currently running and, when running, the loopback URL it serves.

#### Scenario: Status when running
- **WHEN** a background daemon is running and the user runs `data-loom status`
- **THEN** it reports that DataLoom is running and prints the loopback URL

#### Scenario: Status when not running
- **WHEN** no background daemon is running and the user runs `data-loom status`
- **THEN** it reports that DataLoom is not running

#### Scenario: Stop terminates the daemon
- **WHEN** a background daemon is running and the user runs `data-loom stop`
- **THEN** the daemon terminates, releasing the loopback port, and a subsequent `status` reports it is not running

#### Scenario: Stop when nothing is running
- **WHEN** no background daemon is running and the user runs `data-loom stop`
- **THEN** the command reports there was nothing to stop and exits without error

### Requirement: Background log file
When running detached, the daemon SHALL write its startup, error, and lifecycle output to a per-user log file in a stable DataLoom state location, so the user can diagnose a background daemon that has no attached console. The log location SHALL be discoverable (reported by `status`).

#### Scenario: Background output is captured
- **WHEN** the daemon runs detached and emits startup or error output
- **THEN** that output is appended to the DataLoom log file rather than lost to a closed terminal

#### Scenario: Log location is reported
- **WHEN** the user runs `data-loom status`
- **THEN** the reported information includes the path to the background log file

### Requirement: Update command
The `data-loom` CLI SHALL provide an `update` subcommand that upgrades the installed package to the latest published version, restarts the background daemon when one is running, and rewrites the autostart registration (including the stable launcher) when autostart is enabled — so one command leaves the user on the new version with a healthy always-on setup. Each step SHALL be reported. If the package upgrade fails, no restart or registration rewrite SHALL be attempted. When DataLoom is not installed as a global package (for example it was invoked via `npx`), the command SHALL NOT guess an upgrade mechanism; it SHALL print the appropriate manual command instead.

#### Scenario: Update upgrades, restarts, and re-registers
- **WHEN** the user runs `data-loom update` with a daemon running and autostart enabled
- **THEN** the package is upgraded, the daemon is restarted on the new version, and the autostart registration is rewritten, with each step reported

#### Scenario: Update with nothing running
- **WHEN** the user runs `data-loom update` while no daemon is running and autostart is not enabled
- **THEN** the package is upgraded and the command reports that no restart or re-registration was needed

#### Scenario: Failed upgrade aborts the rest
- **WHEN** the package upgrade step fails
- **THEN** the command reports the failure and performs no restart and no registration rewrite

#### Scenario: Non-global install is not guessed at
- **WHEN** the user runs `data-loom update` and the running command is not a global npm installation
- **THEN** the command prints the manual upgrade guidance instead of attempting an upgrade

