# claude-code-integration Specification

## Purpose
TBD - created by archiving change add-connect-claude-code. Update Purpose after archive.
## Requirements
### Requirement: Register DataLoom in Claude Code
The `data-loom` CLI SHALL provide a `connect claude-code` command that registers DataLoom's MCP tools with Claude Code at user (global) scope, pointing at DataLoom's loopback HTTP MCP endpoint. The command SHALL perform the registration through Claude Code's own configuration mechanism (its CLI) and SHALL NOT read or write `~/.claude.json` directly. The registration SHALL be idempotent: running it again SHALL leave exactly one current `data-loom` entry rather than creating a duplicate.

#### Scenario: Registers at user scope
- **WHEN** the user runs `data-loom connect claude-code`
- **THEN** a user-scope `data-loom` MCP registration is present in Claude Code pointing at the daemon's loopback HTTP MCP endpoint

#### Scenario: Re-running leaves a single entry
- **WHEN** the user runs `data-loom connect claude-code` while a `data-loom` registration already exists
- **THEN** exactly one current `data-loom` entry remains, with no duplicate

#### Scenario: DataLoom does not write the Claude Code config file directly
- **WHEN** `connect claude-code` performs the registration
- **THEN** the entry is created via Claude Code's own CLI and DataLoom does not itself modify `~/.claude.json`

### Requirement: Graceful fallback when the Claude Code CLI is unavailable
When the `claude` CLI is not available on the system, `connect claude-code` SHALL NOT fail hard. It SHALL report that automated registration is unavailable and print the exact manual registration command so the user can register by hand.

#### Scenario: Claude CLI missing
- **WHEN** the user runs `data-loom connect claude-code` and no `claude` CLI is found on PATH
- **THEN** the command exits without a hard error and prints the manual `claude mcp add --transport http --scope user data-loom <loopback-mcp-url>` command

### Requirement: Claude Code reaches the tools through the daemon
Once registered, a Claude Code session SHALL be able to complete the MCP handshake and list/call DataLoom's tools, provided the DataLoom daemon is running. The integration SHALL NOT require a second MCP server process independent of the daemon; it SHALL reuse the daemon's existing loopback HTTP endpoint and its per-call project resolution.

#### Scenario: Tools available when daemon is running
- **WHEN** DataLoom is registered in Claude Code and the daemon is running, and a new Claude Code session connects
- **THEN** the handshake completes and DataLoom's tools are listed and callable

#### Scenario: Clear failure when daemon is down
- **WHEN** DataLoom is registered in Claude Code but the daemon is not running, and Claude Code attempts to connect
- **THEN** the connection fails in a way that points to starting DataLoom, rather than silently exposing no tools with no explanation

### Requirement: Remove the Claude Code registration
The CLI SHALL provide a `disconnect claude-code` command that removes DataLoom's user-scope registration from Claude Code, reversing `connect claude-code`. Removal SHALL go through Claude Code's own CLI, SHALL affect only DataLoom's own entry, and SHALL be idempotent.

#### Scenario: Disconnect removes the DataLoom entry
- **WHEN** DataLoom is registered and the user runs `data-loom disconnect claude-code`
- **THEN** the user-scope `data-loom` registration is removed and no other Claude Code MCP registration is affected

#### Scenario: Disconnect when not registered
- **WHEN** DataLoom is not registered in Claude Code and the user runs `data-loom disconnect claude-code`
- **THEN** the command succeeds and reports there was nothing to remove

### Requirement: Loopback-only security preserved
The Claude Code integration SHALL NOT weaken DataLoom's security posture. The registration SHALL point only at the loopback HTTP endpoint, and no credentials or secrets SHALL be written beyond the loopback endpoint address.

#### Scenario: No secrets in the registration
- **WHEN** `connect claude-code` creates the registration
- **THEN** the entry contains only the loopback endpoint address (and transport) — no API keys, tokens, or host secrets

### Requirement: Connect provisions the weave alias
`data-loom connect claude-code` SHALL, after registering the MCP endpoint, also write the version-stamped `/loom:weave` alias into the user's global Claude commands directory — so a fresh install gains both the tools and the command in the same session reload. This provisioning SHALL be best-effort in the same way as the registration: a failure to write the alias SHALL warn and not fail the connect. `data-loom disconnect claude-code` SHALL remove the alias when the file at the target path is identified as DataLoom's (by its version stamp), leaving files it does not recognize untouched.

#### Scenario: Connect writes the alias
- **WHEN** the user runs `data-loom connect claude-code`
- **THEN** the MCP registration is created and the `/loom:weave` alias file is written, and one reload later both the tools and the command are available

#### Scenario: Alias write failure does not fail connect
- **WHEN** `connect claude-code` registers successfully but cannot write the alias file
- **THEN** the command warns about the alias and still reports the registration as successful

#### Scenario: Disconnect removes our alias
- **WHEN** the user runs `data-loom disconnect claude-code` and the alias file carries DataLoom's version stamp
- **THEN** the alias file is removed along with the registration

#### Scenario: Unrecognized file is preserved
- **WHEN** the user runs `data-loom disconnect claude-code` and the file at the alias path is not identified as DataLoom's
- **THEN** the file is left untouched

### Requirement: On-demand registration mode
The `connect claude-code` command SHALL support an `--on-demand` flag that registers DataLoom as a user-scope stdio server invoking the shim command, instead of the default native HTTP endpoint registration. Registration SHALL still go through Claude Code's own CLI (never writing `~/.claude.json` directly) and SHALL remain idempotent. When a `data-loom` registration of the other form already exists, `connect` SHALL report the mismatch and leave a single registration of the requested form (never two `data-loom` entries). `disconnect claude-code` SHALL remove the `data-loom` registration regardless of which form it is.

#### Scenario: On-demand form registered
- **WHEN** the user runs `data-loom connect claude-code --on-demand`
- **THEN** a single user-scope stdio `data-loom` registration invoking the shim is present in Claude Code

#### Scenario: Form switch leaves one entry
- **WHEN** an HTTP-form registration exists and the user runs `connect claude-code --on-demand`
- **THEN** the command reports the switch and exactly one `data-loom` registration — the on-demand form — remains

#### Scenario: Disconnect removes either form
- **WHEN** the user runs `data-loom disconnect claude-code` with a registration of either form present
- **THEN** the `data-loom` registration is removed
