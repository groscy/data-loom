## ADDED Requirements

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
