# claude-desktop-integration Specification

## Purpose
TBD - created by archiving change mcp-autostart-claude-desktop. Update Purpose after archive.
## Requirements
### Requirement: Register DataLoom in Claude Desktop
The `data-loom` CLI SHALL provide a command that registers DataLoom's MCP tools with Claude Desktop by editing Claude Desktop's `claude_desktop_config.json`. The registration SHALL by default use Claude Desktop's native remote/HTTP MCP support — a URL entry pointing directly at DataLoom's loopback HTTP MCP endpoint. When the installed Claude Desktop does not support a native remote/HTTP entry, the command SHALL fall back to a stdio↔HTTP bridge that forwards to the same loopback endpoint; a flag SHALL allow forcing the bridge form. Either way the same running daemon that serves Claude Code also serves Claude Desktop. The registration SHALL be additive: it SHALL add or update only DataLoom's own entry under `mcpServers` and SHALL preserve all other existing entries and settings in the file.

#### Scenario: Native connector registration by default
- **WHEN** the user runs the Claude Desktop connect command and a `claude_desktop_config.json` exists
- **THEN** a `data-loom` entry is present under `mcpServers` pointing at the daemon's loopback HTTP MCP endpoint via Claude Desktop's native remote/HTTP form, and all pre-existing entries and settings are unchanged

#### Scenario: Bridge fallback when native is unsupported
- **WHEN** the connect command runs against a Claude Desktop that does not support a native remote/HTTP entry (or the user forces the bridge)
- **THEN** the `data-loom` entry instead wires a stdio↔HTTP bridge to the same loopback endpoint, and all pre-existing entries and settings are unchanged

#### Scenario: Config file created when absent
- **WHEN** the user runs the connect command and no `claude_desktop_config.json` exists yet
- **THEN** the command creates a minimal valid config file containing the `data-loom` entry

#### Scenario: Re-running updates in place
- **WHEN** the user runs the connect command while a `data-loom` entry already exists
- **THEN** the existing entry is updated in place without creating a duplicate

### Requirement: Claude Desktop reaches the tools through the daemon
Once registered, Claude Desktop SHALL be able to complete the MCP handshake and list/call DataLoom's tools, provided the DataLoom daemon is running. The integration SHALL NOT require a second MCP server process independent of the daemon; it SHALL reuse the daemon's existing loopback HTTP endpoint and its per-call project resolution.

#### Scenario: Tools available when daemon is running
- **WHEN** DataLoom is registered in Claude Desktop and the daemon is running, and Claude Desktop connects
- **THEN** the handshake completes and DataLoom's tools are listed and callable

#### Scenario: Clear failure when daemon is down
- **WHEN** DataLoom is registered in Claude Desktop but the daemon is not running, and Claude Desktop attempts to connect
- **THEN** the connection fails in a way that points to starting DataLoom, rather than silently exposing no tools with no explanation

### Requirement: Remove the Claude Desktop registration
The CLI SHALL provide a way to remove DataLoom's entry from `claude_desktop_config.json`, reversing the connect command. Removal SHALL delete only DataLoom's own `mcpServers` entry and SHALL leave all other entries and settings intact. Removal SHALL be idempotent.

#### Scenario: Disconnect removes only the DataLoom entry
- **WHEN** DataLoom is registered and the user runs the disconnect/removal command
- **THEN** the `data-loom` entry is removed and every other entry and setting in the config is preserved

#### Scenario: Disconnect when not registered
- **WHEN** DataLoom is not registered in Claude Desktop and the user runs the removal command
- **THEN** the command succeeds and reports there was nothing to remove

### Requirement: Loopback-only security preserved
The Claude Desktop integration SHALL NOT weaken DataLoom's security posture. The bridge SHALL connect to the loopback HTTP endpoint only, and no credentials or secrets SHALL be written into `claude_desktop_config.json` beyond the loopback endpoint address and the bridge invocation.

#### Scenario: No secrets written to config
- **WHEN** the connect command writes the `data-loom` entry
- **THEN** the entry contains only the loopback endpoint address and the bridge command/args — no API keys, tokens, or host secrets

#### Scenario: Bridge targets loopback only
- **WHEN** Claude Desktop connects through the registered bridge
- **THEN** the bridge reaches DataLoom only on the loopback interface, consistent with the daemon's loopback-only binding

