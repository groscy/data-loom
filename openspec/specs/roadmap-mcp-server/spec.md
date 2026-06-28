# roadmap-mcp-server Specification

## Purpose
TBD - created by archiving change add-roadmap-mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Stdio MCP server
data_loom SHALL provide a stdio MCP server mode, launchable separately from the HTTP dashboard, that an MCP client can start and that operates on a selected project's OpenSpec workspace.

#### Scenario: Server starts and lists its tools
- **WHEN** an MCP client starts the data_loom MCP server and requests its tools
- **THEN** the server completes the MCP handshake and reports its available tools

### Requirement: Expose open proposals as a tool
The server SHALL provide a tool that returns the open (non-archived) changes with their name, proposal content (Why / What Changes / Capabilities), current derived dependencies, phase, and readiness, and each change's dependency-review state (`pending` when its proposal has no `## Depends On` heading, `declared` when that heading is present). This tool SHALL be read-only.

#### Scenario: Open proposals returned
- **WHEN** the client calls the list-open-proposals tool
- **THEN** the server returns each open change's name, proposal content, current dependencies/phase/readiness, and its dependency-review state, and modifies no files

#### Scenario: Pending review state surfaced
- **WHEN** an open change's proposal has no `## Depends On` heading
- **THEN** the tool reports that change's dependency-review state as `pending`

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

### Requirement: Guide dependency review on connect
The server SHALL advertise connect-time instructions that direct the connecting agent, when any open proposal's dependency-review state is `pending`, to read those proposals, propose dependency edges (or independence) to the user, and obtain the user's confirmation before writing any declaration. The server SHALL NOT itself infer dependencies and holds no model with which to do so.

#### Scenario: Connect-time instructions advertise the review workflow
- **WHEN** an MCP client completes the handshake with the server
- **THEN** the server's advertised instructions tell the agent to review pending proposals and to confirm with the user before writing any declaration

#### Scenario: Server performs no inference of its own
- **WHEN** one or more proposals are pending review
- **THEN** the server neither computes nor writes any dependency on its own, and a declaration is written only when the agent calls a write tool

### Requirement: Declare a change independent as a tool
The server SHALL provide a tool that, given one open change name, records that the change depends on nothing by writing an empty `## Depends On` declaration into that change's proposal — moving its dependency-review state from `pending` to `declared` without adding any dependency edge. It SHALL validate that the change is a known open change, and SHALL be idempotent so that declaring an already-declared change writes nothing new.

#### Scenario: Independence written as an empty declaration
- **WHEN** the client calls the mark-independent tool with a valid open change
- **THEN** an empty `## Depends On` section is written into that change's proposal, its review state becomes `declared`, and no dependency edge is added

#### Scenario: Unknown change rejected
- **WHEN** the client calls mark-independent with a name that is not a known open change
- **THEN** the tool rejects the call and writes nothing

### Requirement: Provision the weave review command
The server SHALL provide a tool that installs a `/loom:weave` slash command into the user's global Claude commands directory, so the dependency-review workflow can be invoked as a single command from any project where the server is registered. The tool SHALL create the command's parent directory if absent, SHALL overwrite an existing command file so it installs the current version, and SHALL return the path it wrote together with guidance that Claude Code must be reloaded to pick up the command. The server SHALL surface this setup tool in its connect-time instructions, and SHALL install the command only when explicitly invoked — never automatically on connect.

#### Scenario: Command installed on request
- **WHEN** the client calls the install tool
- **THEN** the server writes the `/loom:weave` command into the user's global Claude commands directory and returns the written path plus a reload reminder

#### Scenario: Re-install overwrites with the current version
- **WHEN** the install tool is called and a command file already exists at the target path
- **THEN** the server overwrites it with the current command content rather than failing

#### Scenario: Never installed automatically on connect
- **WHEN** a client connects to the server
- **THEN** no command file is written unless the client later explicitly calls the install tool

### Requirement: Provisioning writes only a static command file
The install tool SHALL write only a static slash-command definition (the review workflow expressed as a prompt). Even though it writes outside the selected project, it SHALL NOT read, return, or write any proposal content, host configuration, environment, or credential — preserving the server's no-secrets guarantee.

#### Scenario: Only a static command is written
- **WHEN** the install tool runs
- **THEN** the only file it writes is the `/loom:weave` command definition, containing no proposal text, configuration, environment, or credentials

### Requirement: The weave command drives the confirm-gated review
The installed `/loom:weave` command SHALL instruct the agent to list the open proposals, identify those pending dependency review, propose dependency edges or independence with reasoning, obtain the user's confirmation, and only then record them via the server's dependency-writing tools. It SHALL NOT write a dependency the user has not confirmed.

#### Scenario: Weave runs the review workflow
- **WHEN** the user invokes the `/loom:weave` command in a project where the server is registered
- **THEN** the agent lists the open proposals, surfaces the ones pending review, and proposes their dependencies or independence

#### Scenario: Weave confirms before writing
- **WHEN** the agent has proposed dependencies through the weave command
- **THEN** it writes them via `set_dependency` / `mark_independent` only after the user confirms, and writes nothing the user has not confirmed
