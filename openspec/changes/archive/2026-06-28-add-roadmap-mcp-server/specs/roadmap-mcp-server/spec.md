## ADDED Requirements

### Requirement: Stdio MCP server
data_loom SHALL provide a stdio MCP server mode, launchable separately from the HTTP dashboard, that an MCP client can start and that operates on a selected project's OpenSpec workspace.

#### Scenario: Server starts and lists its tools
- **WHEN** an MCP client starts the data_loom MCP server and requests its tools
- **THEN** the server completes the MCP handshake and reports its available tools

### Requirement: Expose open proposals as a tool
The server SHALL provide a tool that returns the open (non-archived) changes with their name, proposal content (Why / What Changes / Capabilities), and current derived dependencies, phase, and readiness. This tool SHALL be read-only.

#### Scenario: Open proposals returned
- **WHEN** the client calls the list-open-proposals tool
- **THEN** the server returns each open change's name, proposal content, and current dependencies/phase/readiness, and modifies no files

### Requirement: Set a dependency as a tool
The server SHALL provide a tool that, given a `from` and a `to` change name, writes an explicit `## Depends On` declaration for `to` into `from`'s proposal. It SHALL validate that both are known open changes and that `from` differs from `to`, and SHALL not create a duplicate declaration. It SHALL NOT modify the roadmap model directly — only the proposal file.

#### Scenario: Dependency written as a declaration
- **WHEN** the client calls the set-dependency tool with valid `from` and `to`
- **THEN** a `## Depends On` entry for `to` is written into `from`'s proposal, and the roadmap recomputes deterministically from that file

#### Scenario: Invalid dependency rejected
- **WHEN** the client calls set-dependency with a name that is not a known open change, or with `from` equal to `to`
- **THEN** the tool rejects the call and writes nothing

### Requirement: No secrets exposed
The server's tools SHALL expose and accept only proposal text and change names. They SHALL NOT read, return, or accept `~/.claude.json`, environment variables, MCP server configuration, or any host secret, and the server SHALL hold no API credential of its own.

#### Scenario: Tools carry no secrets
- **WHEN** any tool returns data
- **THEN** it contains only proposal text and change identities — no configuration, environment, or credentials
