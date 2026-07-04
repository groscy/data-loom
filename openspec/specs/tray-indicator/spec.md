# tray-indicator Specification

## Purpose
TBD - created by archiving change add-tray-icon. Update Purpose after archive.
## Requirements
### Requirement: Tray icon reflects daemon liveness
The running daemon SHALL display a system-tray icon while it is running and SHALL remove that icon when it stops, so that the presence of the icon is itself a truthful indicator of whether DataLoom is running. Tearing down the icon SHALL be part of normal shutdown (on `stop`, `SIGINT`, and `SIGTERM`) so the icon does not linger after the process exits.

#### Scenario: Icon appears when the daemon is running
- **WHEN** the daemon has started and its dashboard/MCP endpoint is listening on the loopback port
- **THEN** a DataLoom system-tray icon is visible

#### Scenario: Icon is removed when the daemon stops
- **WHEN** the running daemon is stopped (via `data-loom stop`, a termination signal, or the tray's own Stop action)
- **THEN** the DataLoom tray icon is removed and no longer visible

#### Scenario: No stale icon after exit
- **WHEN** the daemon process has exited
- **THEN** no DataLoom tray icon remains in the tray

### Requirement: Status tooltip
The tray icon SHALL expose a tooltip that reports the daemon status and the loopback URL it serves, so the user can read where the dashboard/MCP endpoint is reachable without opening a terminal.

#### Scenario: Tooltip shows running status and URL
- **WHEN** the user hovers the DataLoom tray icon while the daemon is running
- **THEN** the tooltip identifies DataLoom as running and includes the loopback URL (for example `http://127.0.0.1:4317`)

### Requirement: Tray context menu actions
The tray icon SHALL provide a context menu with actions that operate only on DataLoom's own daemon: open the dashboard, copy the loopback URL, and stop the daemon. Selecting Stop SHALL terminate this daemon using the same shutdown path as the `stop` lifecycle subcommand.

#### Scenario: Open Dashboard launches the loopback URL
- **WHEN** the user selects "Open Dashboard" from the tray menu
- **THEN** the daemon's loopback URL is opened in the default browser

#### Scenario: Copy URL copies the loopback address
- **WHEN** the user selects "Copy URL" from the tray menu
- **THEN** the loopback URL is placed on the system clipboard

#### Scenario: Stop terminates the daemon and clears the icon
- **WHEN** the user selects "Stop DataLoom" from the tray menu
- **THEN** the daemon shuts down (releasing the loopback port) and the tray icon is removed

### Requirement: Graceful degradation without a tray
The daemon SHALL treat the tray as an optional presentation layer. If no system tray is available or the tray fails to initialize (for example a headless or unsupported environment), the daemon SHALL continue to run normally without a tray icon and SHALL NOT crash, block, or delay startup.

#### Scenario: Headless host runs without a tray
- **WHEN** the daemon starts on a host where no system tray is available
- **THEN** the daemon starts and serves normally and simply shows no tray icon

#### Scenario: Tray initialization failure is non-fatal
- **WHEN** the tray fails to initialize while the daemon is starting
- **THEN** the failure is logged and the daemon continues running and serving its endpoint

### Requirement: Tray scope is DataLoom-only
The tray SHALL represent and control only DataLoom's own daemon. It SHALL NOT display, start, stop, or otherwise act upon any MCP server or other external application, preserving the product's mirror-not-launcher principle.

#### Scenario: Tray does not represent MCP servers
- **WHEN** the daemon has discovered MCP servers in the topology
- **THEN** the tray icon and its menu refer only to the DataLoom daemon and expose no action that starts or stops any MCP server or external application
